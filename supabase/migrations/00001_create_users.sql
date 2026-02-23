CREATE TABLE public.users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  TEXT NOT NULL UNIQUE,
  display_name    TEXT,
  referral_code   TEXT NOT NULL UNIQUE,
  referred_by     UUID REFERENCES public.users(id),
  balance_usdt    NUMERIC(18, 6) NOT NULL DEFAULT 0,
  subscription_active  BOOLEAN NOT NULL DEFAULT false,
  subscription_tx_hash TEXT,
  subscription_chain   TEXT,
  subscription_paid_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON public.users(wallet_address);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
