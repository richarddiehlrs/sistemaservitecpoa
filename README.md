# ServitecPoa ERP

ERP completo para assistência técnica de eletrodomésticos — **domicílio** e **oficina**. Gestão de **clientes**, **ordens de serviço**, **painel de atendimentos**, **agenda**, **equipe de campo**, **financeiro**, **DRE**, **portal do cliente** e **notificações profissionais**.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage + Realtime) · PWA com notificações push.

**Deploy:** [Vercel](https://vercel.com) · Repositório: [github.com/richarddiehlrs/sistemaservitecpoa](https://github.com/richarddiehlrs/sistemaservitecpoa)

---

## Funcionalidades

### Clientes e equipamentos
- Cadastro com busca de endereço por CEP (ViaCEP).
- **Editar** e **excluir** clientes (lista e detalhe).
- Histórico de ordens de serviço e equipamentos por cliente.
- Múltiplos equipamentos vinculados (tipo, marca, modelo, série, voltagem).

### Ordens de serviço (OS)

**Tipos de atendimento:**
- **Domicílio** — técnico obrigatório, data e turno da visita; agenda automática; status inicial conforme fluxo de campo.
- **Oficina** — técnico opcional, sem agenda obrigatória; status inicial `em_analise`; **etiqueta QR** para impressora de etiquetas.

**Abertura e edição:**
- Cliente existente ou novo (gravado automaticamente).
- Itens de serviço e peças com custo, venda e totais automáticos.
- **Visita técnica** (domicílio) com opção de abater ou somar ao total do cliente.
- Prioridade (baixa, normal, alta, urgente), garantia, forma de pagamento e observações.

**Status completos:**
`aberta` · `em_analise` · `aguardando_aprovacao` · `aprovada` · `em_roteiro` · `em_execucao` · `aguardando_peca` · `cliente_ausente` · `concluida` · `entregue` · `cancelada` · `garantia`

**Campo e documentos:**
- Histórico de mudanças de status.
- **Assinatura do cliente** e **assinatura do técnico** (canvas na OS).
- **Cliente ausente:** foto comprobatória + observação (exige assinatura do técnico).
- Fotos do equipamento (antes/depois/outro) no Storage Supabase.
- Envio ao cliente por **WhatsApp/e-mail** com link do portal.
- **Impressão / PDF** A4 com 2 vias (cliente + empresa), QR do portal, assinaturas e bloco cliente ausente.
- **QR PIX** (CNPJ) e **QR Google Avaliações** na OS impressa e no portal.

**Oficina — etiqueta e leitura QR:**
- Ao criar OS de oficina, abre automaticamente a **impressão da etiqueta** (formato 100×50 mm).
- Etiqueta com QR + dados do cliente, equipamento e defeito.
- Botão **Etiqueta QR** na página da OS (oficina).
- Página **`/escanear`** — leitura por câmera ou digitação; abre a OS direto.
- Ícone de QR na barra superior; busca global aceita código/URL do QR.

**Gestão:**
- Lista com filtros por status, busca e coluna de técnico.
- **Exclusão em cascata** — remove agendamentos, lançamentos financeiros e dados vinculados.
- Edição e exclusão de lançamentos no financeiro.

### Painel de atendimentos (`/painel`)
- Visão operacional em tempo real.
- **Metade domicílio** — kanban por status (análise, orçamento, roteiro, peça, ausente, garantia).
- **Metade oficina** — grade 12×14 com posições coloridas por status.
- Link direto para cada OS; contador e legenda de status.

### Agenda
- Visualização semanal (manhã / tarde) de todos os técnicos.
- Visitas **criadas automaticamente** ao abrir/editar OS de domicílio.
- Sincronização de status OS ↔ agenda.
- Check-in e check-out com **GPS**.
- **Excluir visita** na agenda.
- Filtro por técnico; link direto para a OS em cada card.

### Campo (técnicos e admin)

**Técnico (`/campo`):**
- Painel com alertas: visitas hoje, OS atrasadas, sem assinatura, sem check-in.
- Agenda do dia com check-in/out e link para a OS.
- Lista de ordens atribuídas (prioridade e data da visita).
- Compartilhamento de GPS em tempo real.
- Despesas de campo (combustível, alimentação etc.) → financeiro pendente.
- **Pull-to-refresh** para atualizar dados no celular.
- Login redireciona para `/campo`.

**Admin / atendente (Central de campo):**
- Mapa com última posição GPS dos técnicos.
- Equipe técnica, atendimentos do dia e ordens em campo.
- **Pull-to-refresh** na central.

### Portal público do cliente (`/os/[token]`)
- Acompanhamento da OS sem login (token único).
- Status da visita com etapas visuais.
- **Timeline** com histórico de status.
- Orçamento com itens e total.
- Aprovação do orçamento com assinatura digital → **notifica admin/atendente**.
- Bloco **cliente ausente** com assinatura do técnico e foto.
- **QR PIX** e **QR Google** para pagamento e avaliação.
- Impressão completa da página (`/imprimir/portal/[token]`).

### Financeiro
- Lançamentos de receita e despesa.
- Contas a receber e **a pagar** com vencimento, juros, multa e pagamento parcial.
- Lançamento automático da OS (receita + custo de peças).
- Despesas de campo do técnico (origem `campo`, status pendente).
- Fluxo de caixa e despesas recorrentes.
- Edição e exclusão de lançamentos.
- Filtro de vencidos e exportação CSV.

### Relatórios e DRE
- DRE por mês ou ano (regime de competência).
- Relatórios gerenciais (comissão por técnico, etc.).
- Dashboard com gráficos, meta de faturamento e **badges de alerta**.

### Catálogo, configurações e usuários
- Catálogo de serviços e peças.
- Configurações da empresa (logo, termos, mensagem WhatsApp, comissão).
- Usuários com papéis: **admin**, **atendente**, **tecnico**.
- **Manutenção** (`/manutencao`) — limpeza de agendamentos e lançamentos órfãos (admin).
- Busca global (clientes, OS por número; aceita QR/código colado).

### Alertas e notificações (centro profissional)

**Sino no topo** — atualização em tempo real (Supabase Realtime) + polling:

| Alerta | Quem vê |
|--------|---------|
| Eventos recentes (histórico) | Todos |
| OS com visita atrasada | Todos (técnico: só as suas) |
| Oficina parada (análise/peça há X dias) | Admin / atendente |
| Aguardando aprovação do cliente | Admin / atendente |
| Cliente ausente — reagendar | Admin / atendente |
| Despesas de campo pendentes | Admin / atendente |
| Visitas pendentes hoje | Todos |
| Contas a receber e **a pagar** | Quem tem financeiro |
| Meta de faturamento abaixo de 70% | Quem tem financeiro |

**Eventos que geram notificação + push:**
- Nova OS atribuída ao técnico
- Cliente aprova orçamento no portal
- Técnico registra cliente ausente
- Despesa de campo lançada
- Mudança de status relevante da OS

**Preferências por usuário** (`/configuracoes/alertas`):
- Ativar/desativar cada tipo de alerta.
- Push no celular (admin, atendente e técnico).
- Dias para alerta de oficina parada.
- E-mail resumo diário (opcional, via Resend).

**Ações no sino:**
- Marcar evento como lido ao clicar.
- Marcar todas como lidas.
- Link para configurar alertas.

### PWA
- Instalável no celular (manifest + service worker).
- Cache network-first para uso em campo.
- Notificações push (Web Push + VAPID) para todos os perfis.

---

## Perfis de acesso

| Papel | Acesso principal |
|-------|------------------|
| **Admin** | Tudo: dashboard, painel, agenda, OS, clientes, financeiro, DRE, usuários, configurações, manutenção, central de campo, alertas |
| **Atendente** | Operação + financeiro + relatórios + central de campo + alertas (sem usuários/config empresa) |
| **Técnico** | Campo, agenda própria, OS próprias, clientes, despesas de campo, escanear OS, alertas |

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
| 10 | `0010_os_tecnico_assinatura.sql` | Assinatura técnico, cliente ausente |
| 11 | `0011_integracao_tecnico.sql` | `tecnico_id` na agenda, portal |
| 12 | `0012_push_portal.sql` | Push subscriptions, histórico no portal |
| 13 | `0013_tipo_atendimento.sql` | Tipo domicílio/oficina na OS (**obrigatório para painel**) |
| 14 | `0014_notificacoes.sql` | Centro de notificações, preferências, Realtime (**obrigatório para alertas**) |

3. Em **Authentication → Users**, crie usuários e defina o papel em **Usuários** do sistema.
4. Técnicos: `papel: tecnico` e `ativo: true` para aparecer no select da OS.
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
| `NEXT_PUBLIC_SITE_URL` | Sim | URL do site (QR, portal, etiquetas) |
| `NEXT_PUBLIC_EMPRESA_*` | Não | Cabeçalho da OS em PDF |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push | Chave pública Web Push |
| `VAPID_PRIVATE_KEY` | Push | Chave privada Web Push |
| `VAPID_SUBJECT` | Push | `mailto:seu@email.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim* | Notificações, push e ações server-side |
| `CRON_SECRET` | E-mail | Protege cron de resumo diário |
| `RESEND_API_KEY` | E-mail | Envio de e-mail resumo (opcional) |
| `EMAIL_FROM` | E-mail | Remetente (ex.: `ServitecPoa <noreply@empresa.com>`) |

\* Obrigatória para push e centro de notificações em produção.

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

Acesse http://localhost:3000 — técnicos → `/campo`; demais papéis → `/dashboard`.

---

## Deploy (Vercel)

1. Importe o repositório na Vercel.
2. Configure **todas** as variáveis de ambiente.
3. O `vercel.json` inclui cron diário às 7h para e-mail resumo (`/api/cron/resumo-diario`).
4. Faça **Redeploy** após alterar variáveis.
5. No Supabase → **Authentication → URL Configuration**, adicione a URL da Vercel.

---

## Estrutura do projeto

```
supabase/migrations/       # Scripts SQL (rodar na ordem no Supabase)
scripts/gen-vapid.mjs      # Gera chaves push no .env.local
public/sw.js               # Service worker (cache + push)
vercel.json                # Cron resumo diário de alertas
src/
  middleware.ts            # Auth e redirecionamento por papel
  lib/
    permissoes.ts          # Matriz admin / atendente / técnico
    agenda-os.ts           # Sincronização OS → agenda
    limpar-os.ts           # Exclusão em cascata da OS
    push.ts                # Web Push (VAPID)
    notificacoes.ts        # Centro de notificações + push integrado
    alertas.ts             # Regras de alertas operacionais
    os-scan.ts             # Parse de QR/código da OS
    email-resumo.ts        # E-mail resumo diário (Resend)
    pix.ts / qrcode.ts     # QR PIX e imagens QR
  types/database.ts
  components/
    notifications.tsx      # Sino com Realtime
    painel-atendimentos.tsx
    preferencias-alertas-form.tsx
    os-qr-scanner.tsx
    etiqueta-os-print.tsx
    pull-to-refresh.tsx
    portal-qr-codes.tsx
  app/
    login/
    os/[token]/            # Portal público do cliente
    api/cron/resumo-diario/
    imprimir/
      os/[id]/             # Impressão 2 vias A4
      portal/[token]/      # Impressão portal
      etiqueta-os/[id]/    # Etiqueta oficina 100×50mm
    (app)/
      dashboard/
      painel/              # Painel domicílio + oficina
      escanear/            # Leitor QR da OS
      agenda/
      ordens/
      clientes/
      campo/               # Técnico + central admin
      financeiro/
      dre/
      relatorios/
      catalogo/
      manutencao/          # Limpeza de órfãos
      usuarios/
      configuracoes/
        alertas/           # Preferências de notificações
      notificacoes/        # Actions marcar lida
```

---

## Fluxos operacionais

### Domicílio
1. Admin/atendente abre **Nova OS** → tipo **Domicílio** → técnico, data e turno.
2. Visita entra na **Agenda** e no **Campo** do técnico (push se ativado).
3. Técnico faz check-in, executa serviço, assina a OS.
4. Cliente aprova orçamento pelo **portal** → notificação para a loja.
5. OS concluída → **financeiro** → DRE.

### Oficina
1. Abrir OS → tipo **Oficina** → impressão automática da **etiqueta QR**.
2. Colar etiqueta no equipamento.
3. Técnico/atendente **escaneia QR** (`/escanear`) → abre a OS.
4. Acompanhar no **Painel** (grade 12×14).
5. Alertas de oficina parada no sino e dashboard.

### Cliente ausente
1. Técnico assina a OS e registra ausência com foto.
2. Admin/atendente recebe **push + notificação**.
3. Reagendar data na edição da OS.

---

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/dashboard` | Visão geral e alertas rápidos |
| `/painel` | Kanban domicílio + grade oficina |
| `/ordens` | Lista e gestão de OS |
| `/escanear` | Abrir OS pelo QR da etiqueta |
| `/campo` | Painel técnico ou central admin |
| `/agenda` | Calendário semanal |
| `/financeiro` | Receitas, despesas, vencidos |
| `/manutencao` | Limpar dados órfãos |
| `/configuracoes/alertas` | Preferências de notificações |
| `/os/[token]` | Portal do cliente (público) |
| `/imprimir/etiqueta-os/[id]` | Etiqueta QR oficina |

---

## Próximas melhorias (sugeridas)

- Controle de estoque de peças.
- NFS-e Porto Alegre (certificado A1/A3).
- WhatsApp automático (lembrete de visita, orçamento pronto).
- Bloqueio de conclusão sem assinatura/check-out.
- Reagendamento automático após cliente ausente.

---

© ServitecPoa — Sistema de gestão para assistência técnica.
