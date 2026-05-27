import type { DestIcon } from '../lib/types';
import {
  IconBriefcase,
  IconBuilding,
  IconHeart,
  IconHome,
  IconPin,
  IconStar,
} from './icons';

export function DestinationIcon({
  name,
  size = 16,
  stroke = 1.75,
}: {
  name: DestIcon;
  size?: number;
  stroke?: number;
}) {
  const props = { size, stroke };
  switch (name) {
    case 'home':
      return <IconHome {...props} />;
    case 'briefcase':
      return <IconBriefcase {...props} />;
    case 'star':
      return <IconStar {...props} />;
    case 'heart':
      return <IconHeart {...props} />;
    case 'building':
      return <IconBuilding {...props} />;
    case 'pin':
    default:
      return <IconPin {...props} />;
  }
}
