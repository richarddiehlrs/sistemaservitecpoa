# ServitecPoa ERP

ERP completo para assistência técnica de eletrodomésticos em domicílio. Gestão de **clientes**, **ordens de serviço**, **agenda**, **equipe de campo**, **financeiro**, **DRE** e **portal do cliente**.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage) · PWA com notificações push.

**Deploy:** [Vercel](https://vercel.com) · Repositório: [github.com/richarddiehlrs/sistemaservitecpoa](https://github.com/richarddiehlrs/sistemaservitecpoa)

---

## Funcionalidades

### Clientes e equipamentos
- Cadastro com busca de endereço por CEP (ViaCEP).
- Histórico de ordens de serviço e equipamentos por cliente.
- Múltiplos equipamentos vinculados (tipo, marca, modelo, série, voltagem).

### Ordens de serviço (OS)
- Abertura com cliente existente ou novo (gravado automaticamente).
- **Técnico cadastrado obrigatório** (usuários com papel `tecnico` em Usuários).
- Ao salvar, a **visita entra automaticamente na agenda** do técnico (data + turno obrigatórios).
- Itens de serviço e peças com custo, venda e totais automáticos.
- **Visita técnica** com opção de abater ou somar ao total do cliente.
- Status completos: aberta, em análise, aguardando aprovação, aprovada, em roteiro, em execução, aguardando peça, **cliente ausente**, concluída, entregue, cancelada, garantia.
- Histórico de mudanças de status.
- Prioridade, garantia, forma de pagamento e observações.
- **Assinatura do cliente** e **assinatura do técnico** (canvas na OS).
- **Cliente ausente:** foto comprobatória + observação (exige assinatura do técnico já salva).
- Fotos do equipamento (antes/depois/outro) no Storage Supabase.
- Envio ao cliente por **WhatsApp/e-mail** com link do portal.
- **Impressão / PDF** em folha A4 com 2 vias (cliente + empresa), QR do portal, assinaturas e bloco cliente ausente.
- Exclusão de OS e lançamentos financeiros vinculados (admin).
- Edição e exclusão de lançamentos no financeiro.
- Lista com filtros por status, busca e coluna de técnico (admin/atendente).
- **Push no celular do técnico** quando admin/atendente atribui ou reatribui uma OS.

### Agenda
- Visualização semanal (manhã / tarde) de todos os técnicos.
- Visitas **criadas automaticamente** ao abrir/editar a OS — não é necessário agendar manualmente.
- Sincronização de status OS ↔ agenda (em execução, concluída, cliente ausente, cancelada).
- Check-in e check-out com **GPS** (coordenadas no atendimento).
- Filtro por técnico (admin/atendente).
- Indicadores: pendentes, em atendimento, realizados na semana.
- Link direto para a OS em cada card.

### Campo (técnicos e admin)

**Técnico (`/campo`):**
- Painel com alertas: visitas hoje, OS atrasadas, sem assinatura, sem check-in.
- Agenda do dia com check-in/out e link para a OS.
- Lista de ordens atribuídas (prioridade e data da visita).
- Compartilhamento de GPS em tempo real.
- Despesas de campo (gasolina, almoço etc.) lançadas no financeiro.
- **Ativar notificações push** no PWA (novo atendimento atribuído).
- Login redireciona automaticamente para `/campo`.

**Admin / atendente (`/campo` — Central de campo):**
- Mapa com última posição GPS dos técnicos.
- Equipe técnica, atendimentos do dia e ordens em campo.
- Contagem de OS por técnico.

### Portal público do cliente (`/os/[token]`)
- Acompanhamento da OS sem login (token único por ordem).
- Status da visita com etapas visuais (aberta → roteiro → atendimento → concluída).
- **Timeline** com histórico de status.
- Orçamento com itens e total (visita abatida ou somada).
- Aprovação do orçamento com assinatura digital.
- Bloco **cliente ausente** com assinatura do técnico e foto comprobatória.
- Impressão da página.

### Financeiro
- Lançamentos de receita e despesa.
- Contas a receber/pagar com vencimento, juros, multa e pagamento parcial.
- Lançamento automático da OS (receita + custo de peças).
- Fluxo de caixa e despesas recorrentes (fixas mensais).
- Edição e exclusão de lançamentos.
- Filtro de vencidos e exportação CSV.

### Relatórios e DRE
- DRE por mês ou ano (regime de competência).
- Relatórios gerenciais (comissão por técnico, etc.).
- Dashboard com gráficos receita × despesa, OS por status, meta de faturamento e alertas rápidos.

### Catálogo, configurações e usuários
- Catálogo de serviços e peças para agilizar itens na OS.
- Configurações da empresa (logo, termos, mensagem WhatsApp, comissão).
- Usuários com papéis: **admin**, **atendente**, **tecnico** — permissões por módulo.
- Busca global no topo (clientes, OS, etc.).

### Alertas (sino no topo)
- OS com visita atrasada.
- Aguardando aprovação do cliente.
- Cliente ausente (reagendar).
- Visitas pendentes hoje.
- Contas a receber vencidas ou a vencer (admin/atendente).
- Filtrado por papel (técnico vê apenas o que é dele).

### PWA
- Instalável no celular (manifest + service worker).
- Cache network-first para uso em campo.
- Notificações push para técnicos (Web Push + VAPID).

---

## Perfis de acesso

| Papel      | Acesso principal |
|-----------|------------------|
| **Admin** | Tudo: dashboard, agenda, OS, clientes, financeiro, DRE, usuários, configurações, central de campo |
| **Atendente** | Operação + financeiro + relatórios + central de campo (sem usuários/config) |
| **Técnico** | Campo, agenda própria, OS próprias, clientes, despesas de campo |

---

## Pré-requisitos

- Node.js 18.18+ (recomendado 20+)
- Conta no [Supabase](https://supabase.com)
- Conta no [GitHub](https://github.com) e [Vercel](https://vercel.com) (deploy)

---

## Instalação

```bash
npm install
```

---

## Configurar o Supabase

1. Crie um projeto em https://supabase.com.
2. No **SQL Editor**, execute as migrations **na ordem**:

| Ordem | Arquivo | Conteúdo principal |
|-------|---------|-------------------|
| 1 | `0001_init.sql` | Tabelas base, RLS, categorias financeiras, views DRE |
| 2 | `0002_agenda.sql` | Agenda de atendimentos |
| 3 | `0003_pro.sql` | Portal público (`os_publica`, aprovação) |
| 4 | `0004_storage.sql` | Bucket de fotos da OS |
| 5 | `0005_turnos_custo.sql` | Turnos e custo nos itens |
| 6 | `0006_status_roteiro.sql` | Status em roteiro |
| 7 | `0007_financeiro_pro.sql` | Financeiro avançado |
| 8 | `0008_tecnico_permissoes.sql` | Perfis, check-in, despesas campo |
| 9 | `0009_tecnico_gps.sql` | GPS e posições do técnico |
| 10 | `0010_os_tecnico_assinatura.sql` | Técnico obrigatório, cliente ausente, assinatura |
| 11 | `0011_integracao_tecnico.sql` | `tecnico_id` na agenda, backfill, portal |
| 12 | `0012_push_portal.sql` | Push subscriptions, histórico no portal |

3. Em **Authentication → Users**, crie usuários e em **Usuários** do sistema defina o papel (`admin`, `atendente`, `tecnico`).
4. Técnicos precisam de `papel: tecnico` e `ativo: true` para aparecer no select da OS.
5. Copie **Project URL** e **anon key** em Project Settings → API.

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

| Variável | Obrigatória | Uso |
|----------|-------------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave pública |
| `NEXT_PUBLIC_SITE_URL` | Sim | URL do site (QR code e portal) |
| `NEXT_PUBLIC_EMPRESA_*` | Não | Cabeçalho da OS em PDF |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push | Chave pública Web Push |
| `VAPID_PRIVATE_KEY` | Push | Chave privada Web Push |
| `VAPID_SUBJECT` | Push | `mailto:seu@email.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Push | Enviar notificação ao técnico (só servidor) |

Gerar chaves VAPID:

```bash
node scripts/gen-vapid.mjs
```

Ou: `npx web-push generate-vapid-keys`

---

## Rodar localmente

```bash
npm run dev
```

Acesse http://localhost:3000 — técnicos vão para `/campo`; demais papéis para `/dashboard`.

---

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure **todas** as variáveis de ambiente (incluindo VAPID e `SUPABASE_SERVICE_ROLE_KEY` para push).
3. Faça **Redeploy** após alterar variáveis.
4. No Supabase → **Authentication → URL Configuration**, adicione a URL da Vercel em Site URL e Redirect URLs.

---

## Estrutura do projeto

```
supabase/migrations/     # Scripts SQL (rodar na ordem no Supabase)
scripts/gen-vapid.mjs    # Gera chaves push no .env.local
public/sw.js             # Service worker (cache + push)
src/
  middleware.ts          # Auth e redirecionamento por papel
  lib/
    permissoes.ts        # Matriz admin / atendente / técnico
    agenda-os.ts         # Sincronização OS → agenda
    push.ts              # Envio de notificações push
    alertas.ts           # Regras de alertas do sino
  types/database.ts
  components/            # UI, formulários, mapa GPS, push, portal
  app/
    login/
    os/[token]/          # Portal público do cliente
    imprimir/os/[id]/    # Impressão 2 vias A4
    (app)/               # Área autenticada
      dashboard/
      agenda/
      ordens/
      clientes/
      campo/             # Técnico + central admin
      financeiro/
      dre/
      relatorios/
      catalogo/
      usuarios/
      configuracoes/
```

---

## Fluxo operacional recomendado

1. **Admin** cadastra técnicos em Usuários (`papel: tecnico`).
2. **Admin/atendente** abre **Nova OS** → cliente, técnico, data e turno → salvar.
3. A visita aparece na **Agenda** e no **Campo** do técnico (push se ativado).
4. **Técnico** faz check-in no atendimento, executa serviço, assina a OS, fotos se necessário.
5. Se cliente ausente → registra foto + observação (com assinatura já feita).
6. **Cliente** aprova orçamento pelo **portal** (link/WhatsApp).
7. OS concluída → lançamento no **financeiro** → **DRE** e relatórios.

---

## Próximas melhorias (sugeridas)

- Controle de estoque de peças.
- Bloqueio de conclusão da OS sem assinatura/check-out.
- Reagendamento automático após cliente ausente.
- Push com lembrete de visita (ex.: 1h antes).
- RLS mais restritiva por `tecnico_id` no banco.

---

© ServitecPoa — Sistema de gestão para assistência técnica.
