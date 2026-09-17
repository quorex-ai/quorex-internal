import { initials } from '../../lib/format';

/** Deux utilisateurs seulement : la teinte est derivee du nom, stable dans le temps. */
const TONES = [
  'bg-pill-blue text-pill-blue-ink',
  'bg-pill-pink text-pill-pink-ink',
  'bg-pill-green text-pill-green-ink',
] as const;

function tone(name: string): string {
  let sum = 0;
  for (const char of name) sum += char.codePointAt(0) ?? 0;
  return TONES[sum % TONES.length]!;
}

interface AvatarProps {
  name: string;
  size?: number;
  /** Bordure blanche quand les avatars sont empiles. */
  stacked?: boolean;
}

export function Avatar({ name, size = 32, stacked = false }: AvatarProps): JSX.Element {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        tone(name),
        stacked ? 'border-2 border-card' : '',
      ].join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
