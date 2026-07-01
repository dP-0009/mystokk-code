import { create } from 'zustand';

/**
 * Global confirmation-dialog store. Powers a single in-app <ConfirmHost/> modal
 * (mounted once in App.tsx) so every confirm-then-act flow — delete, remove,
 * revoke, sign out — uses the same styled modal on web AND native, instead of
 * the browser's `window.confirm` sandbox (which `Alert.alert` can't replace on
 * react-native-web). Fire it imperatively via `confirmAction(...)`.
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (delete/remove/revoke). */
  destructive?: boolean;
  onConfirm: () => void;
}

interface ConfirmState {
  current: (ConfirmOptions & { id: number }) | null;
  open: (opts: ConfirmOptions) => void;
  close: () => void;
}

let counter = 0;

export const useConfirmStore = create<ConfirmState>((set) => ({
  current: null,
  open: (opts) => set({ current: { ...opts, id: ++counter } }),
  close: () => set({ current: null }),
}));

/**
 * Show the in-app confirmation modal. `onConfirm` fires only when the user taps
 * the confirm button; cancelling (button, backdrop, or Escape) does nothing.
 */
export function confirmAction(opts: ConfirmOptions): void {
  useConfirmStore.getState().open(opts);
}
