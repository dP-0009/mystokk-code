import { create } from 'zustand';

/**
 * Global, stacking toast system. Two equivalent ways to fire a toast:
 *   • Imperative (services + non-component code, and components too):
 *       import { toast } from '../stores/toast';
 *       toast.success('Saved!');
 *   • Hook (spec API, inside components):
 *       const { toast } = useToast();
 *       toast.error('Something went wrong');
 *
 * Variants: success · error · info · warning · delete.
 * `<ToastHost/>` (mounted once in App.tsx) renders the stack bottom-right.
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning' | 'delete';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

/** Reactive store — consumed by <ToastHost/> to render the live stack. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'success') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++counter, message, variant }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

type ToastFn = ((message: string, variant?: ToastVariant) => void) & {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  delete: (message: string) => void;
};

/** Imperative helper. Bare call defaults to success. */
export const toast = ((message: string, variant: ToastVariant = 'success'): void =>
  useToastStore.getState().show(message, variant)) as ToastFn;

toast.success = (message: string): void => useToastStore.getState().show(message, 'success');
toast.error = (message: string): void => useToastStore.getState().show(message, 'error');
toast.info = (message: string): void => useToastStore.getState().show(message, 'info');
toast.warning = (message: string): void => useToastStore.getState().show(message, 'warning');
toast.delete = (message: string): void => useToastStore.getState().show(message, 'delete');

/**
 * Hook form of the toast API (spec): `const { toast } = useToast();`.
 * Returns the same imperative helper, so `toast.success(...)` works in any
 * component without subscribing it to store updates.
 */
export function useToast(): { toast: ToastFn } {
  return { toast };
}
