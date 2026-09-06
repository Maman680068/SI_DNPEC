'use client';

import { useState, type InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, className = '', type, ...props }: FieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  const isPassword = type === 'password';
  const [visible, setVisible] = useState(false);

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-semibold text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && visible ? 'text' : type}
          className={`w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-text focus:border-accent focus:outline focus:outline-2 focus:outline-accent ${isPassword ? 'pr-16' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold text-text-faint hover:text-text"
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        )}
      </div>
    </div>
  );
}
