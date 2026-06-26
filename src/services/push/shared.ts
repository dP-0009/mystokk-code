import type { MainTabParamList } from '../../navigation';

/** Platform-agnostic push helpers/types (no native imports). */

export interface PushData {
  type?: string;
  related_id?: string;
}

export type PushNavigate = (data: PushData) => void;

/** Map a notification type to the tab it should deep-link to. */
export function pushTargetTab(type: string | undefined): keyof MainTabParamList | null {
  if (!type) return null;
  if (type.startsWith('reservation')) return 'Reservations';
  if (type === 'share_received') return 'Received';
  if (type.startsWith('connection')) return 'Network';
  return null;
}
