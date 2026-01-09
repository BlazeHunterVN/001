-- =================================================================
-- COMPLETE FIX (V3 FINAL) - RUN THIS ENTIRE SCRIPT TO FIX EVERYTHING
-- =================================================================
-- This script does 4 things:
-- 1. Fixes the "Ambiguous Column" error.
-- 2. Fixes the "Senior Admin" case sensitivity issue.
-- 3. Grants "Senior Admin" role to your email automatically.
-- 4. Recreates all necessary functions from scratch to be safe.

-- STEP 1: DROP OLD FUNCTIONS (CLEAN SLATE)
DROP FUNCTION IF EXISTS public.manage_get_admins;
DROP FUNCTION IF EXISTS public.manage_admin_upsert;
DROP FUNCTION IF EXISTS public.manage_admin_delete;
DROP FUNCTION IF EXISTS public.get_admin_role;

-- STEP 2: ENSURE TABLE & COLUMN EXIST
CREATE TABLE IF NOT EXISTS public.admin_access (
  email text primary key,
  access_key text,
  role text default 'admin'
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'admin_access' AND column_name = 'role') THEN
        ALTER TABLE public.admin_access ADD COLUMN role text default 'admin';
    END IF;
END $$;

-- STEP 3: RECREATE FUNCTIONS WITH FIXES (CASE INSENSITIVE + ALIASES)

-- Function 1: Get Admin Role (Public helper)
CREATE OR REPLACE FUNCTION public.get_admin_role(p_email text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM public.admin_access WHERE email = p_email;
$$;

-- Function 2: Get All Admins (Protected, Case Insensitive, Fixed Ambiguity)
CREATE OR REPLACE FUNCTION public.manage_get_admins(
    p_email text,
    p_key text
)
RETURNS TABLE (
    email text,
    access_key text,
    role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_role text;
BEGIN
    -- Fix: Use 'aa' alias to avoid ambiguity
    SELECT aa.role INTO v_current_user_role 
    FROM public.admin_access aa
    WHERE aa.email = p_email AND aa.access_key = p_key;

    -- Fix: LOWER() for case-insensitivity
    IF LOWER(v_current_user_role) <> 'senior admin' THEN
        RAISE EXCEPTION 'Unauthorized: Senior Admin Access Required (Your role is: %)', v_current_user_role;
    END IF;

    RETURN QUERY 
    SELECT aa.email, aa.access_key, aa.role 
    FROM public.admin_access aa;
END;
$$;

-- Function 3: Add/Edit Admin (Protected)
CREATE OR REPLACE FUNCTION public.manage_admin_upsert(
    p_requester_email text,
    p_requester_key text,
    p_target_email text,
    p_target_key text,
    p_target_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_role text;
BEGIN
    SELECT aa.role INTO v_current_user_role 
    FROM public.admin_access aa
    WHERE aa.email = p_requester_email AND aa.access_key = p_requester_key;

    IF LOWER(v_current_user_role) <> 'senior admin' THEN
        RAISE EXCEPTION 'Unauthorized: Senior Admin Access Required';
    END IF;

    INSERT INTO public.admin_access (email, access_key, role)
    VALUES (p_target_email, p_target_key, p_target_role)
    ON CONFLICT (email) DO UPDATE
    SET access_key = excluded.access_key,
        role = excluded.role;

    RETURN json_build_object('status', 'success');
END;
$$;

-- Function 4: Delete Admin (Protected)
CREATE OR REPLACE FUNCTION public.manage_admin_delete(
    p_requester_email text,
    p_requester_key text,
    p_target_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_user_role text;
BEGIN
    SELECT aa.role INTO v_current_user_role 
    FROM public.admin_access aa
    WHERE aa.email = p_requester_email AND aa.access_key = p_requester_key;

    IF LOWER(v_current_user_role) <> 'senior admin' THEN
        RAISE EXCEPTION 'Unauthorized: Senior Admin Access Required';
    END IF;

    IF p_requester_email = p_target_email THEN
        RAISE EXCEPTION 'Cannot delete yourself';
    END IF;

    DELETE FROM public.admin_access WHERE email = p_target_email;
    
    RETURN json_build_object('status', 'deleted');
END;
$$;

-- STEP 4: FORCE UPDATE YOUR ROLE
-- This ensures you are definitely a Senior Admin
UPDATE public.admin_access 
SET role = 'Senior Admin' 
WHERE email = 'blazehunter01062008@gmail.com';

-- Verify the result
SELECT * FROM public.admin_access;
