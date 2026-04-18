# Autenticação — Spacefy Finance

Sistema de login com e-mail/senha (JWT em cookie httpOnly) + Google OAuth (Passport).

## 1. Variáveis de ambiente

Crie um arquivo `.env` na pasta `backend/` (baseado em `.env.example`):

```env
JWT_SECRET=<string-longa-aleatoria>
SESSION_SECRET=<outra-string-longa-aleatoria>
GOOGLE_CLIENT_ID=<preencher-apos-criar-no-google-cloud>
GOOGLE_CLIENT_SECRET=<preencher-apos-criar-no-google-cloud>
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3001
```

### Gerando segredos fortes

No terminal (precisa ter o Node instalado):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Rode duas vezes — um valor para `JWT_SECRET`, outro para `SESSION_SECRET`.

## 2. Criar credenciais no Google Cloud Console

### Passo a passo

1. Acesse: https://console.cloud.google.com/
2. **Criar projeto** (ou selecionar um existente). Dê um nome como *"Spacefy Finance"*.
3. Menu lateral → **APIs e Serviços** → **Tela de consentimento OAuth**.
   - **Tipo de usuário**: `Externo` (depois é só deixar em modo de teste enquanto desenvolve).
   - Preencha: Nome do app (`Spacefy Finance`), e-mail de suporte, e-mail do desenvolvedor.
   - **Escopos**: adicione `.../auth/userinfo.email` e `.../auth/userinfo.profile`.
   - **Usuários de teste**: adicione seu próprio e-mail Gmail (enquanto o app está em modo teste).
   - Salvar.
4. Menu lateral → **APIs e Serviços** → **Credenciais** → **+ Criar credenciais** → **ID do cliente OAuth**.
   - Tipo de aplicativo: **Aplicativo da Web**.
   - Nome: `Spacefy Finance — dev`.
   - **Origens JavaScript autorizadas**: `http://localhost:5173`
   - **URIs de redirecionamento autorizados**: `http://localhost:3001/auth/google/callback`
   - Clicar em **Criar**.
5. Copie o **Client ID** e o **Client Secret** exibidos.
6. Cole no arquivo `.env`:
   ```env
   GOOGLE_CLIENT_ID=1234567890-abcdef.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxx
   ```

### Quando for para produção

- Adicionar o domínio real em "Origens JavaScript autorizadas" (ex.: `https://finance.spacefy.com.br`).
- Adicionar em "URIs de redirecionamento": `https://api.spacefy.com.br/auth/google/callback`.
- Atualizar `FRONTEND_URL` e `BACKEND_URL` no `.env` do servidor.
- Em `backend/auth.js` mudar `secure: false` para `secure: true` no cookie (HTTPS).
- Publicar o app na tela de consentimento (sai do modo teste).

## 3. Rotas de autenticação

| Método | Rota                    | Descrição                                 |
|--------|-------------------------|-------------------------------------------|
| POST   | `/auth/register`        | Cria conta com nome, e-mail e senha       |
| POST   | `/auth/login`           | Entra com e-mail e senha                  |
| POST   | `/auth/logout`          | Sai (limpa cookie)                        |
| GET    | `/auth/me`              | Retorna `{ user }` ou `{ user: null }`    |
| GET    | `/auth/config`          | Retorna `{ googleEnabled: boolean }`      |
| GET    | `/auth/google`          | Inicia OAuth com Google                   |
| GET    | `/auth/google/callback` | Callback do Google (redireciona ao front) |

Todas as rotas `/api/*` passam pelo middleware `requireAuth` — retornam **401** se o cookie JWT não for válido. O frontend intercepta o 401 e joga o usuário de volta para a tela de login.

## 4. Cookies

- Nome: `spacefy_token`
- `httpOnly: true` (não acessível via JS)
- `sameSite: lax`
- `secure: false` em dev (mudar para `true` em produção com HTTPS)
- TTL: **7 dias**

## 5. Senhas

- Hash com **bcryptjs** (10 rounds).
- Mínimo 6 caracteres no registro.

## 6. Teste rápido

1. `npm install` no diretório `backend/` (já feito).
2. Garanta que o `.env` existe e os segredos estão preenchidos.
3. `npm run dev` no backend.
4. `npm run dev` no frontend.
5. Acesse http://localhost:5173 — a tela de login aparece.
6. Criar conta → login → dashboard.
7. Para Google: preencha `GOOGLE_CLIENT_ID`/`SECRET`, reinicie o backend, clique em "Continuar com Google".
