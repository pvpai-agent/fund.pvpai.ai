-- =============================================
-- Migration: Conway Metabolism Engine
-- Transforms subscription model to energy-based survival system
-- =============================================

-- 1. Remove subscription columns from users
ALTER TABLE public.users
  DROP COLUMN IF EXISTS subscription_active,
  DROP COLUMN IF EXISTS subscription_tx_hash,
  DROP COLUMN IF EXISTS subscription_chain,
  DROP COLUMN IF EXISTS subscription_paid_at;

-- 2. Extend agent_status enum with 'dead'
ALTER TYPE agent_status ADD VALUE IF NOT EXISTS 'dead';

-- 3. Add metabolism columns to agents
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS energy_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capital_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS burn_rate_per_hour NUMERIC(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS died_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agents_energy_alive
  ON public.agents(energy_balance)
  WHERE status = 'active';

-- 4. Extend tx_type enum with metabolism types
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'energy_purchase';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'energy_burn';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'energy_vampire';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'energy_referral';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'capital_return';
ALTER TYPE tx_type ADD VALUE IF NOT EXISTS 'agent_mint';

-- 5. Create energy_reason enum
DO $$ BEGIN
  CREATE TYPE energy_reason AS ENUM (
    'heartbeat',
    'trade_open',
    'trade_close',
    'api_call',
    'vampire_feed',
    'blood_pack',
    'manual_topup',
    'death_drain'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6. Create energy_logs table
CREATE TABLE IF NOT EXISTS public.energy_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount        NUMERIC(18, 6) NOT NULL,
  reason        energy_reason NOT NULL,
  description   TEXT,
  energy_before NUMERIC(18, 6) NOT NULL,
  energy_after  NUMERIC(18, 6) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_energy_logs_agent ON public.energy_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_energy_logs_created ON public.energy_logs(created_at DESC);

-- 7. Extend referral_earnings with energy fields
ALTER TABLE public.referral_earnings
  ADD COLUMN IF NOT EXISTS energy_amount NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS target_agent_id UUID REFERENCES public.agents(id);
