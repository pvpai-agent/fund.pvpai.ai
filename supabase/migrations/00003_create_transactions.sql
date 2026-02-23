CREATE TYPE tx_type AS ENUM (
  'subscription', 'deposit', 'withdrawal', 'trade_pnl',
  'performance_fee', 'referral_fee', 'fund_allocation', 'fund_deallocation'
);
CREATE TYPE tx_status AS ENUM ('pending', 'confirmed', 'failed');

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
