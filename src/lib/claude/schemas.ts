import { z } from 'zod';

export const TriggerSchema = z.object({
  type: z.enum(['keyword', 'price_level', 'time_based', 'momentum']),
  condition: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});

export const RiskManagementSchema = z.object({
  max_position_size_pct: z.number().min(1).max(100),
  stop_loss_pct: z.number().min(0.5).max(50),
  take_profit_pct: z.number().min(0.5).max(100),
  max_leverage: z.number().min(1).max(10),
  max_daily_trades: z.number().min(1).max(20),
});

export const TradingStrategySchema = z.object({
  name: z.string(),
  description: z.string(),
  assets: z.array(z.string()).min(1),
  direction_bias: z.enum(['long', 'short', 'both']),
  triggers: z.array(TriggerSchema).min(1),
  risk_management: RiskManagementSchema,
  keywords: z.array(z.string()),
});

export type TradingStrategy = z.infer<typeof TradingStrategySchema>;
