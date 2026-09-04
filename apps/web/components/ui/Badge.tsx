import type { HTMLAttributes } from 'react';

type Tone = 'accent' | 'gold' | 'sage' | 'clay' | 'muted';

const TONE_CLASSES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  gold: 'bg-gold-soft text-ink',
  sage: 'bg-sage-soft text-sage',
  clay: 'bg-clay-soft text-clay',
  muted: 'bg-bg text-text-muted',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = 'muted', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-block rounded-[5px] px-2 py-0.5 text-[10px] font-bold tracking-wide ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  );
}
