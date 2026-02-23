CREATE TYPE agent_status AS ENUM ('draft', 'active', 'paused', 'closed');

CREATE TABLE public.agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  prompt          TEXT NOT NULL,
  parsed_rules    JSONB NOT NULL DEFAULT '{}',
  name            TEXT NOT NULL,
  avatar_seed     TEXT NOT NULL,
  status          agent_status NOT NULL DEFAULT 'draft',
  allocated_funds NUMERIC(18, 6) NOT NULL DEFAULT 0,
  total_trades    INTEGER NOT NULL DEFAULT 0,
  total_pnl       NUMERIC(18, 6) NOT NULL DEFAULT 0,
  win_rate        NUMERIC(5, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_user ON public.agents(user_id);
CREATE INDEX idx_agents_status ON public.agents(status);
