'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-mono uppercase tracking-wider text-cyber-green mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={twMerge(
            clsx(
              'w-full bg-cyber-dark border border-terminal-border rounded px-3 py-2',
              'font-mono text-sm text-cyber-green placeholder:text-gray-600',
              'focus:outline-none focus:border-cyber-green focus:ring-1 focus:ring-cyber-green/50',
              'transition-colors duration-200',
              error && 'border-cyber-red focus:border-cyber-red focus:ring-cyber-red/50',
              className
            )
          )}
          {...props}
        />
        {error && <p className="mt-1 text-xs font-mono text-cyber-red">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
