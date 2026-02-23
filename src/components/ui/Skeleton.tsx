import { twMerge } from 'tailwind-merge';

interface SkeletonProps { className?: string; }

export function Skeleton({ className }: SkeletonProps) {
  return <div className={twMerge('rounded shimmer', className)} />;
}
