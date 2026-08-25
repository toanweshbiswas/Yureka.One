import * as React from 'react'
import { cn } from '@shared/lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-clay text-black hover:bg-clay/90',
  outline: 'border border-white/15 bg-transparent hover:bg-white/[0.06]',
  ghost: 'hover:bg-white/[0.06]',
  secondary: 'bg-white/[0.08] text-white hover:bg-white/[0.12]',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-8 rounded-xl px-3 text-[12px]',
  lg: 'h-11 rounded-2xl px-6',
  icon: 'h-10 w-10',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-[14px] font-semibold tracking-[-0.01em] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-clay/50 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
