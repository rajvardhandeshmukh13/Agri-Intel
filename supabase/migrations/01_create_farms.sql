-- supabase/migrations/01_create_farms.sql
-- AgriIntel Secure Farm Storage Schema for Supabase PostgreSQL
-- Compliant with Supabase Security Advisor and Row Level Security (RLS)

-- 1. Create farms table
create table if not exists public.farms (
  id text primary key,
  user_id text not null,
  name text not null default 'My Farm',
  crop text not null,
  commodity text,
  state text default 'Maharashtra',
  district text,
  village text,
  area_hectares numeric default 3.5,
  sowing_date text,
  soil_type text,
  irrigation_type text,
  lat numeric,
  lng numeric,
  field_geojson jsonb,
  input_cost_per_ha numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.farms enable row level security;

-- 3. Clean up any previous policies
drop policy if exists "Allow all users to manage farms" on public.farms;
drop policy if exists "Allow anon inserts" on public.farms;
drop policy if exists "Users can access their own farms" on public.farms;
drop policy if exists "Users can view own farms" on public.farms;
drop policy if exists "Users can insert own farms" on public.farms;
drop policy if exists "Users can update own farms" on public.farms;
drop policy if exists "Users can delete own farms" on public.farms;
drop policy if exists "Anon read demo farms" on public.farms;

-- 4. Secure Production RLS Policies: Authenticated Users own their data
create policy "Users can view own farms"
  on public.farms
  for select
  to authenticated
  using ((select auth.uid()::text) = user_id);

create policy "Users can insert own farms"
  on public.farms
  for insert
  to authenticated
  with check ((select auth.uid()::text) = user_id);

create policy "Users can update own farms"
  on public.farms
  for update
  to authenticated
  using ((select auth.uid()::text) = user_id)
  with check ((select auth.uid()::text) = user_id);

create policy "Users can delete own farms"
  on public.farms
  for delete
  to authenticated
  using ((select auth.uid()::text) = user_id);

-- 5. Read-only access for demo mode / unauthenticated preview
create policy "Anon read demo farms"
  on public.farms
  for select
  to anon
  using (user_id = 'local-user' or user_id like 'demo-%');
