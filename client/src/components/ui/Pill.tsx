import {
  MILESTONE_STATUS_LABELS,
  TASK_STATUS_LABELS,
  type MilestoneStatus,
  type TaskStatus,
} from '@quorex/shared';

/**
 * Pilules de statut : le texte porte toujours l'information, la couleur ne fait
 * que l'appuyer.
 */
const TONES = {
  green: 'bg-pill-green text-pill-green-ink',
  pink: 'bg-pill-pink text-pill-pink-ink',
  blue: 'bg-pill-blue text-pill-blue-ink',
  gray: 'bg-pill-gray text-pill-gray-ink',
} as const;

type Tone = keyof typeof TONES;

const TASK_TONES: Record<TaskStatus, Tone> = {
  todo: 'pink',
  in_progress: 'green',
  review: 'gray',
  done: 'blue',
};

const MILESTONE_TONES: Record<MilestoneStatus, Tone> = {
  upcoming: 'pink',
  in_progress: 'green',
  closed: 'blue',
};

interface PillProps {
  label: string;
  tone?: Tone;
  className?: string;
}

export function Pill({ label, tone = 'gray', className = '' }: PillProps): JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sub font-medium ${TONES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}

export function TaskStatusPill({ status }: { status: TaskStatus }): JSX.Element {
  return <Pill label={TASK_STATUS_LABELS[status]} tone={TASK_TONES[status]} />;
}

export function MilestoneStatusPill({ status }: { status: MilestoneStatus }): JSX.Element {
  return <Pill label={MILESTONE_STATUS_LABELS[status]} tone={MILESTONE_TONES[status]} />;
}

/** Marqueur de retard, toujours accompagne du mot « retard ». */
export function LatePill(): JSX.Element {
  return <Pill label="En retard" tone="pink" />;
}
