import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border',
  {
    variants: {
      variant: {
        default: 'bg-lumine-lavender-pale text-lumine-sage-dark border-lumine-lavender-pale',
        success: 'bg-lumine-success/10 text-lumine-success border-lumine-success/20',
        danger: 'bg-lumine-danger/10 text-lumine-danger border-lumine-danger/20',
        warning: 'bg-lumine-gold/10 text-lumine-gold border-lumine-gold/20',
        sage: 'bg-lumine-sage/10 text-lumine-sage border-lumine-sage/20',
        outline: 'border-lumine-lavender-pale text-lumine-charcoal',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
