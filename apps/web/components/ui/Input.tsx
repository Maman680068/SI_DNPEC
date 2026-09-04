import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, className = '', ...props }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-semibold text-text">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-text focus:border-accent focus:outline focus:outline-2 focus:outline-accent ${className}`}
        {...props}
      />
    </div>
  );
}
