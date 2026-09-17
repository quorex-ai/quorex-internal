import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'soft';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-strong',
  secondary: 'bg-card text-ink-soft border border-card-line hover:bg-hover',
  soft: 'bg-field text-ink-soft hover:bg-card-line/60',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
}

export function Button({
  variant = 'secondary',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sub font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant],
        className,
      ].join(' ')}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
