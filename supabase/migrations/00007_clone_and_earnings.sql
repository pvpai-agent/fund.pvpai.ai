-- =============================================
-- Migration: Clone tracking + Creator earnings
-- Enables clone referral system and profit claiming
-- =============================================

-- 1. Add clone_parent_id to agents (tracks which agent was cloned from)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS clone_parent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agents_clone_parent ON public.agents(clone_parent_id)
  WHERE clone_parent_id IS NOT NULL;

-- 2. Add creator_earnings to agents (accumulated unclaimed creator fees)
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS creator_earnings NUMERIC(18, 6) NOT NULL DEFAULT 0;

-- 3. Add tx_type enums for new transaction types
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'creator_fee';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'creator_claim';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'clone_fuel_referral';
