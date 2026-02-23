CREATE TABLE public.referral_earnings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID NOT NULL REFERENCES public.users(id),
  referred_id     UUID NOT NULL REFERENCES public.users(id),
  trade_id        UUID REFERENCES public.trades(id),
  amount          NUMERIC(18, 6) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_referral_earnings_referrer ON public.referral_earnings(referrer_id);
