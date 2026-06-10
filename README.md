# ServitecPoa ERP

ERP completo para assistência técnica de eletrodomésticos. Gestão de **clientes**, **equipamentos**, **ordens de serviço** (com impressão em PDF de 2 vias em A4), **financeiro** (contas a receber/pagar) e **DRE**.

Stack: **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Auth)**. Pronto para deploy na **Vercel**.

## Funcionalidades

- **Clientes**: cadastro com busca automática de endereço pelo CEP (ViaCEP), histórico de OS e equipamentos por cliente.
- **Ordens de Serviço**:
  - Abertura informando cliente existente **ou** novo cliente (gravado automaticamente).
  - Cadastro/seleção do equipamento, defeito relatado, diagnóstico e serviço executado.
  - Itens de serviço e peças com cálculo automático.
  - **Visita técnica** cobrada e **abatida do valor total** quando o serviço é aprovado.
  - Controle de status com histórico, prioridade, garantia e previsão.
  - **Impressão em PDF com 2 vias (cliente e empresa) em uma única folha A4.**
- **Financeiro**: lançamentos de receitas e despesas, contas a receber/pagar, marcação de pagamento, filtros por período/tipo/situação, indicadores de saldo.
- **DRE**: Demonstração do Resultado por mês ou ano (regime de competência), com lucro bruto, despesas e margem líquida.
- **Autenticação** via Supabase Auth.

## Pré-requisitos

- Node.js 18.18+ (recomendado 20+)
- Conta no [Supabase](https://supabase.com)
- Conta no [GitHub](https://github.com) e [Vercel](https://vercel.com) (para deploy)

## 1. Instalação

```bash
npm install
```

## 2. Configurar o Supabase

1. Crie um projeto em https://supabase.com.
2. Em **SQL Editor**, cole e execute o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Isso cria todas as tabelas, views (DRE/fluxo de caixa), políticas de segurança (RLS) e categorias financeiras padrão.
3. Em **Authentication → Users**, crie o primeiro usuário (e-mail e senha) para acessar o sistema.
   - Opcional: em **Authentication → Providers → Email**, desative "Confirm email" para facilitar o primeiro acesso.
4. Em **Project Settings → API**, copie a `Project URL` e a `anon public key`.

## 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key

NEXT_PUBLIC_EMPRESA_NOME="ServitecPoa Assistência Técnica"
NEXT_PUBLIC_EMPRESA_CNPJ="00.000.000/0001-00"
NEXT_PUBLIC_EMPRESA_TELEFONE="(51) 00000-0000"
NEXT_PUBLIC_EMPRESA_EMAIL="contato@servitecpoa.com.br"
NEXT_PUBLIC_EMPRESA_ENDERECO="Rua Exemplo, 123 - Porto Alegre/RS"
```

Os dados da empresa aparecem no cabeçalho da OS em PDF.

## 4. Rodar localmente

```bash
npm run dev
```

Acesse http://localhost:3000 e faça login com o usuário criado no Supabase.

## 5. Deploy (GitHub + Vercel)

1. Crie um repositório no GitHub e envie o código:

```bash
git init
git add .
git commit -m "ServitecPoa ERP - versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/servitecpoa-erp.git
git push -u origin main
```

2. Na Vercel, clique em **Add New → Project** e importe o repositório.
3. Em **Environment Variables**, adicione as mesmas variáveis do `.env.local`.
4. Clique em **Deploy**.
5. No Supabase, em **Authentication → URL Configuration**, adicione a URL da Vercel em "Site URL" e "Redirect URLs".

## Estrutura do projeto

```
supabase/migrations/0001_init.sql   # Schema do banco (rode no Supabase)
src/
  middleware.ts                     # Proteção de rotas (auth)
  lib/                              # Supabase clients, formatação, CEP, helpers
  types/database.ts                 # Tipos do banco
  components/                       # Componentes de UI e formulários
  app/
    login/                          # Tela de login
    (app)/                          # Área autenticada (com sidebar)
      dashboard/                    # Indicadores gerais
      clientes/                     # Cadastro e histórico de clientes
      ordens/                       # Ordens de serviço
      financeiro/                   # Contas a receber/pagar
      dre/                          # Demonstração do Resultado
    imprimir/os/[id]/               # Impressão da OS (2 vias A4)
```

## Próximos passos sugeridos

- Controle de estoque de peças (planejado para uma próxima fase).
- Múltiplos usuários com perfis/permissões (técnico, atendente, admin).
- Envio da OS por WhatsApp/e-mail.
- Relatórios gerenciais e gráficos no dashboard.

---

© ServitecPoa — Sistema de gestão para assistência técnica.
