-- =====================================================================
-- ServitecPoa ERP - Storage (fotos da OS e logo da empresa)
-- Rode no SQL Editor do Supabase APÓS 0003.
-- =====================================================================

-- Buckets públicos (leitura via URL pública; upload restrito a autenticados)
insert into storage.buckets (id, name, public)
values ('os-fotos', 'os-fotos', true), ('empresa', 'empresa', true)
on conflict (id) do nothing;

-- Leitura pública dos arquivos desses buckets
drop policy if exists "servitec public read" on storage.objects;
create policy "servitec public read" on storage.objects
  for select to public
  using (bucket_id in ('os-fotos', 'empresa'));

-- Upload por usuários autenticados
drop policy if exists "servitec auth insert" on storage.objects;
create policy "servitec auth insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('os-fotos', 'empresa'));

-- Atualização por usuários autenticados
drop policy if exists "servitec auth update" on storage.objects;
create policy "servitec auth update" on storage.objects
  for update to authenticated
  using (bucket_id in ('os-fotos', 'empresa'))
  with check (bucket_id in ('os-fotos', 'empresa'));

-- Exclusão por usuários autenticados
drop policy if exists "servitec auth delete" on storage.objects;
create policy "servitec auth delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('os-fotos', 'empresa'));
