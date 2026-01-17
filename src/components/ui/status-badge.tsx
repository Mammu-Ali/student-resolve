import { cn } from '@/lib/utils';
import { Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'submitted' | 'in_review' | 'resolved';
  className?: string;
}

const statusConfig = {
  submitted: {
    label: 'Submitted',
    icon: AlertCircle,
    className: 'bg-status-submitted/10 text-status-submitted border-status-submitted/20',
  },
  in_review: {
    label: 'In Review',
    icon: Clock,
    className: 'bg-status-in-review/10 text-status-in-review border-status-in-review/20',
  },
  resolved: {
    label: 'Resolved',
    icon: CheckCircle,
    className: 'bg-status-resolved/10 text-status-resolved border-status-resolved/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
