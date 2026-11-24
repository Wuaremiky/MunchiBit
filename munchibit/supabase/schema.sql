-- MunchiBit · schema.sql (ejecutar en el SQL Editor de Supabase)
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  sex text check (sex in ('hombre','mujer')),
  age int check (age between 14 and 100),
  height_cm numeric check (height_cm between 100 and 250),
  weight_kg numeric check (weight_kg between 30 and 300),
  activity_level text check (activity_level in ('sedentario','ligero','moderado','intenso','atleta')),
  goal_weight_kg numeric,
  deficit_kcal int not null default 500 check (deficit_kcal in (250,500,750)),
  add_exercise_calories boolean not null default false,
  water_goal int not null default 8,
  bmr numeric, tdee numeric, daily_kcal numeric,
  protein_g numeric, carbs_g numeric, fat_g numeric,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  kcal numeric not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null,
  unique (user_id, effective_from)
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  kcal_100g numeric not null, protein_100g numeric not null,
  carbs_100g numeric not null, fat_100g numeric not null,
  serving_g numeric not null default 100,
  serving_label text not null default '100 g',
  created_by uuid references auth.users(id) on delete cascade,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  check ((is_custom and created_by is not null) or (not is_custom and created_by is null))
);
create index foods_name_idx on public.foods (lower(name));
create index foods_owner_idx on public.foods (created_by);

create table public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id uuid not null references public.foods(id) on delete cascade,
  primary key (user_id, food_id)
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  meal_type text not null check (meal_type in ('desayuno','almuerzo','cena','snack')),
  food_id uuid references public.foods(id) on delete set null,
  food_name text not null,
  quantity_g numeric not null check (quantity_g > 0),
  kcal numeric not null, protein_g numeric not null, carbs_g numeric not null, fat_g numeric not null,
  created_at timestamptz not null default now()
);
create index meal_logs_user_date_idx on public.meal_logs (user_id, date);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  type text not null,
  minutes int not null check (minutes > 0),
  kcal_burned numeric not null check (kcal_burned >= 0),
  created_at timestamptz not null default now()
);
create index exercise_logs_user_date_idx on public.exercise_logs (user_id, date);

create table public.water_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  glasses int not null default 0 check (glasses >= 0),
  primary key (user_id, date)
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null check (weight_kg between 30 and 300),
  unique (user_id, date)
);
create index weight_logs_user_date_idx on public.weight_logs (user_id, date);

-- ===== RLS =====
alter table public.profiles enable row level security;
create policy "profiles_own" on public.profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['daily_goals','favorites','meal_logs','exercise_logs','water_logs','weight_logs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_own" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
  end loop;
end $$;

alter table public.foods enable row level security;
create policy "foods_read" on public.foods for select
  using (created_by is null or created_by = auth.uid());
create policy "foods_insert_own" on public.foods for insert
  with check (created_by = auth.uid() and is_custom);
create policy "foods_update_own" on public.foods for update
  using (created_by = auth.uid()) with check (created_by = auth.uid() and is_custom);
create policy "foods_delete_own" on public.foods for delete
  using (created_by = auth.uid());

-- ===== Triggers =====
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== Permisos (GRANT) =====
-- Necesarios para que la API de Supabase pueda acceder a las tablas; RLS sigue limitando cada fila.
grant usage on schema public to anon, authenticated;
grant select on public.foods to anon, authenticated;
grant insert, update, delete on public.foods to authenticated;
grant select, insert, update, delete on
  public.profiles, public.daily_goals, public.favorites, public.meal_logs,
  public.exercise_logs, public.water_logs, public.weight_logs
  to authenticated;
