import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  variant?: 'green' | 'blue' | 'red' | 'gold' | 'gray';
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
}

export function Badge({ variant = 'green', children, className, pulse }: BadgeProps) {
  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider',
          variant === 'green' && 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30',
          variant === 'blue' && 'bg-cyber-blue/10 text-cyber-blue border border-cyber-blue/30',
          variant === 'red' && 'bg-cyber-red/10 text-cyber-red border border-cyber-red/30',
          variant === 'gold' && 'bg-cyber-gold/10 text-cyber-gold border border-cyber-gold/30',
          variant === 'gray' && 'bg-gray-800 text-gray-400 border border-gray-700',
          className
        )
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span className={clsx(
            'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
            variant === 'green' && 'bg-cyber-green',
            variant === 'blue' && 'bg-cyber-blue',
            variant === 'red' && 'bg-cyber-red',
            variant === 'gold' && 'bg-cyber-gold',
            variant === 'gray' && 'bg-gray-400',
          )} />
          <span className={clsx(
            'relative inline-flex rounded-full h-2 w-2',
            variant === 'green' && 'bg-cyber-green',
            variant === 'blue' && 'bg-cyber-blue',
            variant === 'red' && 'bg-cyber-red',
            variant === 'gold' && 'bg-cyber-gold',
            variant === 'gray' && 'bg-gray-400',
          )} />
        </span>
      )}
      {children}
    </span>
  );
}
