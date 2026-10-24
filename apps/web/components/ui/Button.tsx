import type { ButtonHTMLAttributes } from 'react';

type Variant = 'solid' | 'gold' | 'outline';

const VARIANT_CLASSES: Record<Variant, string> = {
  solid: 'bg-ink text-white border-ink hover:bg-ink-dark',
  gold: 'bg-gold text-sur-or border-gold hover:brightness-95',
  outline: 'bg-surface text-text border-line hover:bg-bg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'outline', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[13.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
