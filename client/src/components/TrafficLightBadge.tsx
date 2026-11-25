import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { TrafficLight } from '@shared/types';

interface TrafficLightBadgeProps {
  status: TrafficLight;
  label?: string;
  compact?: boolean;
}

const CONFIG: Record<
  TrafficLight,
  {
    defaultLabel: string;
    classes: string;
    dotClass: string;
    Icon: typeof CheckCircle2;
  }
> = {
  green: {
    defaultLabel: 'Einsatzbereit',
    classes:
      'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800/80',
    dotClass: 'bg-emerald-500',
    Icon: CheckCircle2,
  },
  yellow: {
    defaultLabel: 'Warnung',
    classes:
      'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800/80',
    dotClass: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  red: {
    defaultLabel: 'Gesperrt',
    classes:
      'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-800/80',
    dotClass: 'bg-red-500',
    Icon: XCircle,
  },
};

export function TrafficLightBadge({ status, label, compact = false }: TrafficLightBadgeProps) {
  const cfg = CONFIG[status];
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${cfg.classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label ?? cfg.defaultLabel}</span>
    </span>
  );
}

export function TrafficLightDot({ status }: { status: TrafficLight }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${CONFIG[status].dotClass}`}
      aria-hidden="true"
    />
  );
}
