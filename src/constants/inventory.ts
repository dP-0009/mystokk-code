/** Inventory option lists + status metadata. */

/**
 * Units of measure offered across every industry/category. Grouped by kind
 * (count → packaging → weight → volume → length → area) so the dropdown reads
 * top-to-bottom from the most common trade units to the more specialised ones.
 */
export const UNITS: readonly string[] = [
  // Count
  'pcs',
  'unit',
  'pair',
  'dozen',
  'gross',
  'set',
  'item',
  // Packaging
  'box',
  'carton',
  'case',
  'crate',
  'pack',
  'pallet',
  'bundle',
  'roll',
  'reel',
  'coil',
  'bag',
  'sack',
  'drum',
  'barrel',
  'can',
  'bottle',
  'jar',
  'tube',
  'tin',
  'tray',
  'ream',
  'sheet',
  'container',
  'truckload',
  // Weight
  'mg',
  'g',
  'kg',
  'ton',
  'quintal',
  'lb',
  'oz',
  // Volume
  'ml',
  'litre',
  'gallon',
  'cubic metre',
  'cubic foot',
  // Length
  'mm',
  'cm',
  'metre',
  'km',
  'inch',
  'foot',
  'yard',
  // Area
  'sq metre',
  'sq foot',
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
