'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={twMerge(
          clsx(
            'relative inline-flex items-center justify-center font-mono font-bold uppercase tracking-wider transition-all duration-200',
            'border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-cyber-black',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            variant === 'primary' && 'border-cyber-green text-cyber-green bg-cyber-green/10 hover:bg-cyber-green/20 focus:ring-cyber-green',
            variant === 'secondary' && 'border-cyber-blue text-cyber-blue bg-cyber-blue/10 hover:bg-cyber-blue/20 focus:ring-cyber-blue',
            variant === 'danger' && 'border-cyber-red text-cyber-red bg-cyber-red/10 hover:bg-cyber-red/20 focus:ring-cyber-red',
            variant === 'ghost' && 'border-transparent text-gray-400 hover:text-cyber-green hover:bg-cyber-green/5',
            size === 'sm' && 'px-3 py-1.5 text-xs',
            size === 'md' && 'px-5 py-2.5 text-sm',
            size === 'lg' && 'px-8 py-3.5 text-base',
            className
          )
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
