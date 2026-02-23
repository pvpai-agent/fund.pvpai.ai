'use client';

import { useUser } from '@/hooks/useUser';
import { formatUsd } from '@/lib/utils/format';
import { Card } from '@/components/ui/Card';

export default function WithdrawPage() {
  const { user } = useUser();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-mono font-bold text-cyber-green uppercase tracking-wider">
        {'>'} Withdraw
      </h1>

      <Card variant="glow">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">
          Available Balance
        </p>
        <p className="text-3xl font-bold text-cyber-gold">
          {formatUsd(Number(user?.balance_usdt ?? 0))}
        </p>
      </Card>

      <Card className="text-center py-8">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-sm font-mono font-bold text-cyber-blue mb-2 uppercase tracking-wider">
          Coming Soon
        </h3>
        <p className="text-xs font-mono text-gray-500 max-w-sm mx-auto">
          Automated withdrawals are being developed. For now, please contact support
          to process manual withdrawals.
        </p>
        <p className="text-xs font-mono text-gray-700 mt-4">
          support@pvpai.ai
        </p>
      </Card>
    </div>
  );
}
