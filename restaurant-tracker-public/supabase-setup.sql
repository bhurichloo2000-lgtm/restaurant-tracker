-- ============================================================
-- RESTAURANT TRACKER - SUPABASE SETUP SCRIPT
-- Copy and paste this into your Supabase project SQL Editor, then click "RUN"
-- ============================================================

-- 1. Create orders table (Revenue only, No profit/cost)
create table if not exists public.orders (
    id text primary key,
    staff_name text not null,
    order_date date not null default current_date,
    ordered_at timestamptz not null default now(),
    main_item text not null,
    main_price int not null default 30,
    addons jsonb not null default '[]'::jsonb,
    total int not null,
    date text not null,
    created_at timestamptz default now()
);

-- 2. Create settings table (Stores shared restaurant password)
create table if not exists public.settings (
    id int primary key default 1,
    shared_password text not null default 'YOUR_SHARED_PASSWORD',
    restaurant_name text not null default 'Restaurant Tracker',
    updated_at timestamptz default now(),
    constraint single_row_check check (id = 1)
);

-- Insert default shared password
insert into public.settings (id, shared_password, restaurant_name)
values (1, 'YOUR_SHARED_PASSWORD', 'Restaurant Tracker')
on conflict (id) do update set shared_password = excluded.shared_password;

-- 3. Enable Row Level Security (RLS)
alter table public.orders enable row level security;
alter table public.settings enable row level security;

-- 4. Policies (Allow staff devices to read & insert orders)
drop policy if exists "Allow read orders" on public.orders;
create policy "Allow read orders" on public.orders for select using (true);

drop policy if exists "Allow insert orders" on public.orders;
create policy "Allow insert orders" on public.orders for insert with check (true);

drop policy if exists "Allow read settings" on public.settings;
create policy "Allow read settings" on public.settings for select using (true);

-- 5. Enable Supabase Realtime for Live Multi-Device Sync
alter publication supabase_realtime add table public.orders;
