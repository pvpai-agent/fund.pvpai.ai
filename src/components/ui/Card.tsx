import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'terminal' | 'glow';
}

export function Card({ className, variant = 'default', children, ...props }: CardProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'rounded-lg border p-4',
          variant === 'default' && 'border-terminal-border bg-cyber-dark',
          variant === 'terminal' && 'border-cyber-green/30 bg-terminal-bg font-mono scanlines',
          variant === 'glow' && 'border-cyber-green/50 bg-cyber-dark neon-border',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
}
