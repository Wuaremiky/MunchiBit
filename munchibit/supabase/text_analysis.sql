-- MunchiBit · registro por texto · límite diario propio (8) por usuario
-- Ejecutar una vez en el SQL Editor de Supabase (después de photo_analysis.sql).
alter table public.photo_usage add column if not exists text_count int not null default 0;

create or replace function public.claim_text_slot(p_user uuid, p_limit int default 8)
returns int language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Santiago')::date; n int;
begin
  insert into public.photo_usage (user_id, date, count) values (p_user, d, 0) on conflict do nothing;
  update public.photo_usage set text_count = text_count + 1
    where user_id = p_user and date = d and text_count < p_limit returning text_count into n;
  if n is null then raise exception 'limit_reached'; end if;
  return p_limit - n;
end $$;

create or replace function public.release_text_slot(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Santiago')::date;
begin
  update public.photo_usage set text_count = greatest(text_count - 1, 0) where user_id = p_user and date = d;
end $$;

revoke all on function public.claim_text_slot(uuid, int) from public, anon, authenticated;
revoke all on function public.release_text_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_text_slot(uuid, int) to service_role;
grant execute on function public.release_text_slot(uuid) to service_role;
