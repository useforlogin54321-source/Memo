-- 1. Ensure firms table has user_id and is unique per user
ALTER TABLE public.firms ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.firms DROP CONSTRAINT IF EXISTS firms_name_key;

-- 2. Ensure products, memos, etc. are linked to user_id or firm_id correctly
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.memos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 3. Enable RLS on all tables
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_items ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS "Users can see only their own firms" ON public.firms;
CREATE POLICY "Users can see only their own firms" ON public.firms
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see only their own products" ON public.products;
CREATE POLICY "Users can see only their own products" ON public.products
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see only their own memos" ON public.memos;
CREATE POLICY "Users can see only their own memos" ON public.memos
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can see only their own memo items" ON public.memo_items;
CREATE POLICY "Users can see only their own memo items" ON public.memo_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.memos
            WHERE memos.id = memo_items.memo_id
            AND memos.user_id = auth.uid()
        )
    );
