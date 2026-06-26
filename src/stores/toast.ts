import { create } from 'zustand';

/**
 * Global, stacking toast system. Call `toast('message')` (defaults to success)
 * or a variant helper — `toast.success(...)`, `toast.error(...)`,
 * `toast.info(...)`, `toast.delete(...)` — from anywhere (services, screens).
 * `<ToastHost/>` (mounted once in App.tsx) renders the stack bottom-right.
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'delete';

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

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'success') =>
    set((s) => ({ toasts: [...s.toasts, { id: ++counter, message, variant }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

type ToastFn = ((message: string, variant?: ToastVariant) => void) & {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  delete: (message: string) => void;
};

/** Imperative helper for non-component code. Bare call defaults to success. */
export const toast = ((message: string, variant: ToastVariant = 'success'): void =>
  useToast.getState().show(message, variant)) as ToastFn;

toast.success = (message: string): void => useToast.getState().show(message, 'success');
toast.error = (message: string): void => useToast.getState().show(message, 'error');
toast.info = (message: string): void => useToast.getState().show(message, 'info');
toast.delete = (message: string): void => useToast.getState().show(message, 'delete');
