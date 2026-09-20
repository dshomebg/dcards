import { Badge } from '@/components/ui/badge';
import { effectivePlan, PLAN_LABELS } from '@/modules/platform';

type Props = Readonly<{ plan: 'free' | 'pro'; planExpiresAt: Date | null }>;

/** Записаният план плюс „изтекъл", когато действащият вече е друг. */
export function PlanBadge({ plan, planExpiresAt }: Props) {
  const expired = effectivePlan({ plan, planExpiresAt }) !== plan;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge tone={plan === 'pro' ? 'brand' : 'neutral'}>
        {PLAN_LABELS[plan]}
      </Badge>
      {expired && <Badge tone="danger">изтекъл</Badge>}
    </span>
  );
}
