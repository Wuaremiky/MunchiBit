-- MunchiBit · actividad del día (gasto pasivo: caminar, aseo, tareas del hogar)
-- Ejecutar una vez en el SQL Editor de Supabase.
create table if not exists public.activity_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  level text not null check (level in ('normal', 'activo', 'muy_activo')),
  primary key (user_id, date)
);
alter table public.activity_logs enable row level security;
drop policy if exists "activity_logs_own" on public.activity_logs;
create policy "activity_logs_own" on public.activity_logs for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.activity_logs to authenticated;
