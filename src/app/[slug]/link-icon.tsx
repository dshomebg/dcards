// Иконка по тип линк — SVG от сървъра, без JS. Lucide няма марковите знаци
// (LinkedIn, Facebook…), затова те са общи иконки със същия смисъл.

import {
  AtSign,
  Briefcase,
  Camera,
  Globe,
  Link,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Play,
  Send,
} from 'lucide-react';

import type { ProfileLinkType } from '@/modules/platform';

const ICONS: Readonly<Record<ProfileLinkType, LucideIcon>> = {
  phone: Phone,
  email: Mail,
  website: Globe,
  linkedin: Briefcase,
  facebook: AtSign,
  instagram: Camera,
  tiktok: Music2,
  youtube: Play,
  whatsapp: MessageCircle,
  viber: MessageCircle,
  telegram: Send,
  address: MapPin,
  custom: Link,
};

export function LinkIcon({ type }: { readonly type: ProfileLinkType }) {
  const Icon = ICONS[type];
  return (
    <Icon
      aria-hidden
      size={20}
      className="shrink-0 text-(--profile-accent)"
      strokeWidth={1.75}
    />
  );
}
