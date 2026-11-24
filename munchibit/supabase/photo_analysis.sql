-- MunchiBit · registro por foto · límite diario por usuario
-- Ejecutar una vez en el SQL Editor de Supabase.
create table if not exists public.photo_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  count int not null default 0,
  primary key (user_id, date)
);
alter table public.photo_usage enable row level security;
drop policy if exists "photo_usage_read_own" on public.photo_usage;
create policy "photo_usage_read_own" on public.photo_usage for select using (user_id = auth.uid());
grant select on public.photo_usage to authenticated;

-- Reserva una foto del día (atómico). El día se calcula en el servidor, hora de Santiago.
create or replace function public.claim_photo_slot(p_user uuid, p_limit int default 4)
returns int language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Santiago')::date; n int;
begin
  insert into public.photo_usage (user_id, date, count) values (p_user, d, 0) on conflict do nothing;
  update public.photo_usage set count = count + 1
    where user_id = p_user and date = d and count < p_limit returning count into n;
  if n is null then raise exception 'limit_reached'; end if;
  return p_limit - n;
end $$;

-- Devuelve la reserva si el análisis falló.
create or replace function public.release_photo_slot(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Santiago')::date;
begin
  update public.photo_usage set count = greatest(count - 1, 0) where user_id = p_user and date = d;
end $$;

-- Solo la Edge Function (service_role) puede llamarlas: así nadie salta el límite desde el navegador.
revoke all on function public.claim_photo_slot(uuid, int) from public, anon, authenticated;
revoke all on function public.release_photo_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_photo_slot(uuid, int) to service_role;
grant execute on function public.release_photo_slot(uuid) to service_role;
