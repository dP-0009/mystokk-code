/**
 * Cross-platform confirmation dialog.
 *
 * Re-exported from the global confirm store so the whole app shows the same
 * in-app <ConfirmHost/> modal (web + native) instead of the browser's
 * `window.confirm` sandbox. Kept at this path for back-compat with existing
 * `import { confirmAction } from '../utils/confirm'` call sites.
 */
export { confirmAction } from '../stores/confirm';
export type { ConfirmOptions } from '../stores/confirm';
