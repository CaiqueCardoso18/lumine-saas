import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-lumine-lavender-pale', className)}
      {...props}
    />
  );
}

export { Skeleton };
