-- =============================================
-- PVP AI — Full Database Setup
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Users
CREATE TABLE public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  referral_code   TEXT NOT NULL UNIQUE,
  referred_by     UUID REFERENCES public.users(id),
  balance_usdt    NUMERIC(18, 6) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON public.users(wallet_address);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);

-- 2. Agent Status Enum (includes 'dead' from metabolism engine)
CREATE TYPE agent_status AS ENUM ('draft', 'active', 'paused', 'closed', 'dead');

-- 3. Agents (with metabolism columns included)
CREATE TABLE public.agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt            TEXT NOT NULL,
  parsed_rules      JSONB NOT NULL DEFAULT '{}',
  name              TEXT NOT NULL,
  avatar_seed       TEXT NOT NULL,
  status            agent_status NOT NULL DEFAULT 'draft',
  allocated_funds   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  energy_balance    NUMERIC(18, 6) NOT NULL DEFAULT 0,
  capital_balance   NUMERIC(18, 6) NOT NULL DEFAULT 0,
  burn_rate_per_hour NUMERIC(18, 6) NOT NULL DEFAULT 0,
  died_at           TIMESTAMPTZ,
  total_trades      INTEGER NOT NULL DEFAULT 0,
  total_pnl         NUMERIC(18, 6) NOT NULL DEFAULT 0,
  win_rate          NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON public.agents(user_id);
CREATE INDEX idx_agents_status ON public.agents(status);
CREATE INDEX idx_agents_energy_alive ON public.agents(energy_balance) WHERE status = 'active';

-- 4. Transaction Types (includes metabolism types)
CREATE TYPE tx_type AS ENUM (
  'subscription', 'deposit', 'withdrawal', 'trade_pnl',
  'performance_fee', 'referral_fee', 'fund_allocation', 'fund_deallocation',
  'energy_purchase', 'energy_burn', 'energy_vampire', 'energy_referral',
  'capital_return', 'agent_mint'
);
CREATE TYPE tx_status AS ENUM ('pending', 'confirmed', 'failed');

-- 5. Transactions
CREATE TABLE public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  type            tx_type NOT NULL,
  status          tx_status NOT NULL DEFAULT 'pending',
  amount          NUMERIC(18, 6) NOT NULL,
  token           TEXT NOT NULL DEFAULT 'USDT',
  chain           TEXT,
  tx_hash         TEXT,
  description     TEXT,
  balance_before  NUMERIC(18, 6),
  balance_after   NUMERIC(18, 6),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON public.transactions(user_id);
CREATE INDEX idx_transactions_agent ON public.transactions(agent_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);

-- 6. Trade Types
CREATE TYPE trade_direction AS ENUM ('long', 'short');
CREATE TYPE trade_status AS ENUM ('open', 'closed', 'cancelled');

-- 7. Trades
CREATE TABLE public.trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL DEFAULT 'NVDA-PERP',
  direction       trade_direction NOT NULL,
  size            NUMERIC(18, 6) NOT NULL,
  leverage        INTEGER NOT NULL DEFAULT 1,
  entry_price     NUMERIC(18, 6),
  exit_price      NUMERIC(18, 6),
  realized_pnl    NUMERIC(18, 6),
  fee_amount      NUMERIC(18, 6),
  referrer_fee    NUMERIC(18, 6),
  hl_order_id     TEXT,
  trigger_reason  TEXT,
  trigger_data    JSONB,
  status          trade_status NOT NULL DEFAULT 'open',
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ
);

CREATE INDEX idx_trades_agent ON public.trades(agent_id);
CREATE INDEX idx_trades_user ON public.trades(user_id);
CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_opened ON public.trades(opened_at DESC);

-- 8. Referral Earnings (with energy fields)
CREATE TABLE public.referral_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES public.users(id),
  referred_id     UUID NOT NULL REFERENCES public.users(id),
  trade_id        UUID REFERENCES public.trades(id),
  amount          NUMERIC(18, 6) NOT NULL,
  energy_amount   NUMERIC(18, 6),
  target_agent_id UUID REFERENCES public.agents(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_earnings_referrer ON public.referral_earnings(referrer_id);

-- 9. Energy Logs
CREATE TYPE energy_reason AS ENUM (
  'heartbeat', 'trade_open', 'trade_close', 'api_call',
  'vampire_feed', 'blood_pack', 'manual_topup', 'death_drain'
);

CREATE TABLE public.energy_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  amount        NUMERIC(18, 6) NOT NULL,
  reason        energy_reason NOT NULL,
  description   TEXT,
  energy_before NUMERIC(18, 6) NOT NULL,
  energy_after  NUMERIC(18, 6) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_energy_logs_agent ON public.energy_logs(agent_id);
CREATE INDEX idx_energy_logs_created ON public.energy_logs(created_at DESC);
