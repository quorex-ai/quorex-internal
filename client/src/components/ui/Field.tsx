import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-[10px] border border-card-line bg-card px-4 py-2.5 text-body text-ink placeholder:text-muted focus:border-brand focus:outline-none disabled:bg-field disabled:text-muted';

export function Label({ children }: { children: ReactNode }): JSX.Element {
  return <span className="text-sub font-medium text-ink-soft">{children}</span>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  const { className = '', ...rest } = props;
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  const { className = '', ...rest } = props;
  return <textarea className={`${CONTROL} resize-y ${className}`} {...rest} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  const { className = '', ...rest } = props;
  return <select className={`${CONTROL} pr-10 ${className}`} {...rest} />;
}

/** Selecteur compact en pilule bordee, comme « Cette semaine ▾ » de la reference. */
export function PillSelect(props: SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  const { className = '', ...rest } = props;
  return (
    <select
      className={`max-w-[240px] truncate rounded-full border border-card-line bg-card px-4 py-1.5 text-sub text-ink-soft focus:border-brand focus:outline-none ${className}`}
      {...rest}
    />
  );
}

export function FieldError({ message }: { message: string | null }): JSX.Element | null {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-pill-pink px-4 py-3 text-sub text-pill-pink-ink">
      {message}
    </p>
  );
}
