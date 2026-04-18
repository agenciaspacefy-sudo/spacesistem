# Spacefy Finance

Controle financeiro interno da agência Spacefy Marketing.

- **Backend**: Node + Express + SQLite (`better-sqlite3`)
- **Frontend**: React + Vite
- **Banco**: arquivo `backend/spacefy.db` (criado automaticamente)

## Rodando

Abra dois terminais.

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Sobe em `http://localhost:3001`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Sobe em `http://localhost:5173`. O Vite já faz proxy de `/api` para a porta 3001.

## Funcionalidades

- **Recebimentos**: cadastro/edição/exclusão (data, cliente, serviço, mês ref, valor, vencimento, status Pago/Pendente/Atrasado).
- **Gastos**: cadastro/edição/exclusão (data, categoria, descrição, mês ref, valor, forma de pagamento).
- **Resumo Mensal**: tabela automática com receita recebida, total de gastos, lucro líquido e margem % por mês. Só considera recebimentos com status **Pago**.
- **Edição inline**: clique em qualquer célula da tabela para editar. `Enter` confirma, `Esc` cancela.
- **Filtro por mês**: input no topo filtra todas as abas. Botão "Limpar" mostra tudo.

## Estrutura

```
spacefy-finance/
├── backend/
│   ├── db.js           # schema + conexão SQLite
│   ├── server.js       # Express + rotas REST
│   └── spacefy.db      # gerado ao rodar
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── styles.css
        ├── api/client.js
        ├── utils.js
        └── components/
            ├── Recebimentos.jsx
            ├── Gastos.jsx
            ├── Resumo.jsx
            └── EditableCell.jsx
```

## Notas

- Sem autenticação — uso local apenas.
- Backup: copie `backend/spacefy.db` (e os arquivos `-wal` / `-shm` se existirem).
- Formato `mês ref.`: `YYYY-MM` (o input `<month>` já produz esse formato).
