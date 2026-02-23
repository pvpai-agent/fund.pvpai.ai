CREATE TYPE trade_direction AS ENUM ('long', 'short');
CREATE TYPE trade_status AS ENUM ('open', 'closed', 'cancelled');

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
