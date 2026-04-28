# Configuração do Stripe — Trial e Paywall do SpaceSystem

Este guia descreve como ligar o sistema de assinatura do SpaceSystem ao Stripe.
Sem essas variáveis configuradas, o trial de 7 dias funciona normalmente, mas
**nenhum pagamento é processado** — usuários expirados ficam bloqueados sem
forma de assinar.

---

## 1. Variáveis de ambiente no Railway

No painel do Railway → projeto **spacesistem** → serviço **web** → aba
**Variables** (ou **Settings → Variables**), adicione:

| Variável | Valor | Onde pegar |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` (ou `sk_test_...` para testes) | https://dashboard.stripe.com/apikeys → "Secret key" → "Reveal live key" |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Após criar o webhook (passo 2), o Stripe mostra o "Signing secret" |

> ⚠️ Nunca commite essas chaves no Git. O `.env.example` mostra as variáveis
> com valores em branco — só.

Depois de salvar as duas variáveis, o Railway reinicia o serviço automaticamente.
No log você deve ver:

```
[stripe] SDK habilitado
```

Se ainda aparecer `STRIPE_SECRET_KEY não configurada`, recarregue o deploy.

---

## 2. Criar o webhook no Dashboard do Stripe

1. Abra https://dashboard.stripe.com/webhooks
2. Clique em **Add endpoint**
3. **Endpoint URL**: cole a URL pública do seu Railway com `/webhook/stripe`
   no final. Exemplos:
   - Produção: `https://web-production-e05e.up.railway.app/webhook/stripe`
   - Substitua pelo seu domínio real do Railway
4. **Description**: "SpaceSystem — paywall"
5. **Events to send**: clique em **Select events** e marque:
   - `checkout.session.completed` ← ativar assinatura
   - `customer.subscription.deleted` ← cancelamento bloqueia acesso
   - `invoice.payment_failed` ← log para acompanhamento
6. Clique em **Add endpoint**
7. Na tela do endpoint criado, em **Signing secret**, clique em
   **Reveal** e copie o valor `whsec_...`
8. Cole esse valor em `STRIPE_WEBHOOK_SECRET` no Railway (passo 1)

---

## 3. Verificar links de pagamento

Os links já estão hardcoded no frontend:

- Mensal: `https://buy.stripe.com/bJecN53WU2wT5lO2n97ss06`
- Anual: `https://buy.stripe.com/aFafZheBy0oL5lO6Dp7ss07`

Esses são **Payment Links** do Stripe. Quando um usuário clica em "Assinar",
o Stripe coleta o e-mail e processa o pagamento. O webhook
`checkout.session.completed` chega ao backend com o e-mail informado e o
sistema cruza com o usuário cadastrado no SpaceSystem.

> **Importante**: o e-mail usado no checkout do Stripe **deve** ser o mesmo
> do cadastro no SpaceSystem para ativar a assinatura automaticamente.

---

## 4. Como o sistema funciona

### Fluxo do usuário

1. Usuário cria conta → trial de **7 dias** começa automaticamente
2. Banner azul/amarelo/vermelho no topo conforme o trial avança
3. Após 7 dias sem assinar → **acesso bloqueado** (HTTP 402 em todas as rotas
   `/api/*`, exceto `/auth/*`)
4. Tela de paywall mostra os planos com botões para o checkout do Stripe
5. Após o pagamento, o webhook é disparado → sistema marca
   `assinatura_ativa = 1` e plano = `'mensal'` ou `'anual'`
6. Próximo `/auth/me` retorna o usuário desbloqueado

### Estados do usuário (`usuarios.plano`)

| Plano | Significa |
|---|---|
| `trial` | Em período de teste de 7 dias |
| `mensal` | Assinatura mensal ativa |
| `anual` | Assinatura anual ativa |
| `expirado` | Trial venceu sem assinatura **ou** assinatura cancelada |

### Eventos do webhook

| Evento Stripe | Ação no SpaceSystem |
|---|---|
| `checkout.session.completed` | Salva `stripe_customer_id` + `stripe_subscription_id`, `assinatura_ativa = 1`, define `plano` por `interval` (`month` → mensal, `year` → anual) |
| `customer.subscription.deleted` | `assinatura_ativa = 0`, `plano = 'expirado'` → bloqueia acesso |
| `invoice.payment_failed` | Apenas loga no console (no futuro: enviar e-mail) |

---

## 5. Testar localmente (opcional)

Para testar o webhook sem precisar de domínio público:

```bash
# 1. Instale Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# 2. Encaminha eventos do Stripe para seu localhost
stripe listen --forward-to localhost:3001/webhook/stripe

# 3. O CLI imprime um whsec_... — cole em backend/.env como STRIPE_WEBHOOK_SECRET

# 4. Em outro terminal, dispare um evento de teste
stripe trigger checkout.session.completed
```

---

## 6. Troubleshooting

**Banner de trial não aparece**
- Verifique que o usuário tem `trial_inicio` e `trial_fim` no banco
  (a migração idempotente faz backfill em usuários antigos)

**Sistema bloqueia mas usuário já assinou**
- Confira no log se `[stripe] usuário X@Y ativado no plano mensal` apareceu
- Se não, o webhook não chegou ou falhou na assinatura — verifique o painel
  do Stripe → Webhooks → endpoint → "Recent events"
- O e-mail usado no checkout precisa ser **idêntico** ao do cadastro
  (case-insensitive)

**Webhook retorna 400 "signature error"**
- O `STRIPE_WEBHOOK_SECRET` no Railway não bate com o do dashboard
- Re-copie o valor no Stripe e cole no Railway, depois redeploy

**Webhook retorna 503 "Stripe não configurado"**
- Faltou definir `STRIPE_SECRET_KEY` no Railway
