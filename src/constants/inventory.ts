/** Inventory option lists + status metadata. */

export const UNITS: readonly string[] = [
  'pcs',
  'box',
  'carton',
  'pallet',
  'set',
  'pair',
  'dozen',
  'kg',
  'g',
  'ton',
  'litre',
  'ml',
  'metre',
  'roll',
  'sheet',
  'unit',
];

export const CURRENCIES: readonly string[] = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'JPY', 'CNY'];

export type InventoryStatus =
  | 'active'
  | 'partially_allocated'
  | 'partially_reserved'
  | 'sold_out'
  | 'archived';

/** Filter pills on the list screen → status enum (null = All). */
export const INVENTORY_FILTERS: ReadonlyArray<{ label: string; status: InventoryStatus | null }> = [
  { label: 'All', status: null },
  { label: 'Active', status: 'active' },
  { label: 'Partially Reserved', status: 'partially_reserved' },
  { label: 'Sold Out', status: 'sold_out' },
  { label: 'Archived', status: 'archived' },
];
