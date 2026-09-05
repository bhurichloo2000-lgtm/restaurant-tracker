-- ============================================================
-- RESTAURANT TRACKER - SUPABASE DATABASE SCHEMA
-- Production Database Architecture
-- Single Restaurant | Income Tracking Only (No Profit / No Cost)
-- ============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SETTINGS TABLE
-- Stores restaurant-wide configuration (shared password, restaurant info)
CREATE TABLE IF NOT EXISTS public.settings (
    id INT PRIMARY KEY DEFAULT 1,
    shared_password TEXT NOT NULL,
    restaurant_name TEXT NOT NULL DEFAULT 'Restaurant Tracker',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insert initial default password if not exists
INSERT INTO public.settings (id, shared_password, restaurant_name)
VALUES (1, 'YOUR_SHARED_PASSWORD', 'Restaurant Tracker')
ON CONFLICT (id) DO UPDATE SET shared_password = EXCLUDED.shared_password;

-- 3. MENU ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INT NOT NULL DEFAULT 30,
    icon TEXT DEFAULT '🍽️',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial Menu Items
INSERT INTO public.menu_items (id, name, price, icon, active)
VALUES 
    ('pork', 'หมูกระทะ', 30, '🥩', true),
    ('chicken', 'ไก่กระทะ', 30, '🍗', true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, price = EXCLUDED.price, icon = EXCLUDED.icon;

-- 4. ADDONS TABLE
CREATE TABLE IF NOT EXISTS public.addons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price INT NOT NULL DEFAULT 5,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial Add-ons
INSERT INTO public.addons (id, name, price, active)
VALUES 
    ('porkSlices', 'หมูชิ้น', 5, true),
    ('pork3', 'หมู 3 ชิ้น', 5, true),
    ('cabbage', 'ผักกาด', 5, true),
    ('morningGlory', 'ผักบุ้ง', 5, true),
    ('glassNoodles', 'วุ้นเส้น', 5, true),
    ('chickenTender', 'สันในไก่', 5, true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, price = EXCLUDED.price;

-- 5. ORDERS TABLE
-- Stores primary order-level info (Revenue tracking only, NO profit/cost)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    staff_name TEXT NOT NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_amount INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for date filtering and fast sorting
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON public.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON public.orders(ordered_at DESC);

-- 6. ORDER ITEMS TABLE
-- Stores individual main items and add-ons belonging to each order
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('menu', 'addon')),
    item_name TEXT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price INT NOT NULL,
    subtotal INT GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 7. SESSIONS TABLE
-- Stores server-backed session tokens created by Edge Function
CREATE TABLE IF NOT EXISTS public.sessions (
    token TEXT PRIMARY KEY,
    staff_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON public.sessions(token);

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- SETTINGS: Strictly private. Only service_role can access (Never exposed to anon)
DROP POLICY IF EXISTS "Deny anon on settings" ON public.settings;
CREATE POLICY "Deny anon on settings" ON public.settings
    FOR ALL TO anon USING (false);

-- MENU ITEMS: Read-only for anon users
DROP POLICY IF EXISTS "Allow anon read menu" ON public.menu_items;
CREATE POLICY "Allow anon read menu" ON public.menu_items
    FOR SELECT TO anon USING (active = true);

-- ADDONS: Read-only for anon users
DROP POLICY IF EXISTS "Allow anon read addons" ON public.addons;
CREATE POLICY "Allow anon read addons" ON public.addons
    FOR SELECT TO anon USING (active = true);

-- ORDERS: Allow read and insert for anon/authenticated POS devices
DROP POLICY IF EXISTS "Allow anon read orders" ON public.orders;
CREATE POLICY "Allow anon read orders" ON public.orders
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon insert orders" ON public.orders;
CREATE POLICY "Allow anon insert orders" ON public.orders
    FOR INSERT TO anon WITH CHECK (true);

-- Explicitly DO NOT allow UPDATE or DELETE on orders (Rule: persistent records, no delete)
DROP POLICY IF EXISTS "Disallow delete orders" ON public.orders;

-- ORDER ITEMS: Allow read and insert
DROP POLICY IF EXISTS "Allow anon read order_items" ON public.order_items;
CREATE POLICY "Allow anon read order_items" ON public.order_items
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon insert order_items" ON public.order_items;
CREATE POLICY "Allow anon insert order_items" ON public.order_items
    FOR INSERT TO anon WITH CHECK (true);

-- Enable Realtime for multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
