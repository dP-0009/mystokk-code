/**
 * Static option lists for onboarding + filters.
 *
 * INDUSTRIES powers the Industry picker; CATEGORIES powers the multi-select
 * pills (stored as vendors.categories text[] — these feed the Share Modal
 * filters later). COUNTRIES powers the Country picker.
 */

export const INDUSTRIES: readonly string[] = [
  'Consumer Electronics',
  'Mobile & Accessories',
  'Computers & IT Hardware',
  'Home Appliances',
  'Audio & Video',
  'Wearables & Smart Devices',
  'Gaming & Entertainment',
  'Automotive Parts',
  'Industrial Equipment',
  'Building Materials',
  'Apparel & Textiles',
  'Footwear & Bags',
  'Health & Beauty',
  'Food & Beverage',
  'Furniture & Home Decor',
  'Toys & Hobbies',
  'Sports & Outdoors',
  'Stationery & Office',
  'Jewellery & Watches',
  'General Trading',
];

export const CATEGORIES: readonly string[] = [
  'Audio',
  'Mobile Accessories',
  'Smart Home',
  'Wearables',
  'Laptops & Tablets',
  'Cameras',
  'Gaming',
  'Power & Charging',
  'Networking',
  'TV & Displays',
  'Home Appliances',
  'Kitchen',
  'Lighting',
  'Cables & Adapters',
  'Storage & Memory',
  'Spare Parts',
];

/**
 * Maps a product industry to its specific sub-categories. Drives the dependent
 * Industry → Category pickers in the inventory form: choosing an industry
 * narrows the Category options to just the relevant ones.
 */
export const INVENTORY_INDUSTRY_CATEGORIES: Record<string, readonly string[]> = {
  'Timber/Wood': ['Hardwood', 'Softwood', 'Plywood', 'MDF', 'Veneer'],
  Electronics: ['Consumer', 'Components', 'Semiconductors', 'Accessories'],
  Textiles: ['Fabric', 'Garments', 'Raw Fiber', 'Home Textiles'],
  Metals: ['Steel', 'Aluminum', 'Copper', 'Iron', 'Alloys'],
  Chemicals: ['Industrial', 'Agricultural', 'Pharmaceutical'],
  'Food & Agriculture': ['Grains', 'Spices', 'Oils', 'Perishables'],
  General: ['General Merchandise'],
};

/** Industry options for the inventory form (keys of the category mapping). */
export const INVENTORY_INDUSTRIES: readonly string[] = Object.keys(INVENTORY_INDUSTRY_CATEGORIES);

/**
 * Company-profile (Settings) industry → category mapping. Selecting an industry
 * narrows the category pills to just its relevant ones.
 *
 * NOTE: the 'Food & Agriculture' list is a sensible default — the source spec
 * was truncated for that industry, so adjust if the intended list differs.
 */
export const SETTINGS_INDUSTRY_CATEGORIES: Record<string, readonly string[]> = {
  'Agriculture & Food': ['Grains & Cereals', 'Fruits & Vegetables', 'Dairy Products', 'Meat & Poultry', 'Seafood', 'Beverages', 'Edible Oils', 'Spices & Condiments', 'Processed Foods', 'Animal Feed', 'Others'],
  'Textiles & Apparel': ['Fabrics', 'Yarn & Thread', 'Garments', 'Home Textiles', 'Footwear', 'Leather Goods', 'Apparel Accessories', 'Raw Fiber', 'Technical Textiles', 'Workwear', 'Others'],
  'Chemicals & Petrochemicals': ['Industrial Chemicals', 'Specialty Chemicals', 'Polymers & Plastics', 'Fertilizers', 'Paints & Coatings', 'Adhesives', 'Lubricants', 'Pharmaceutical Ingredients', 'Agrochemicals', 'Dyes & Pigments', 'Others'],
  'Metals & Mining': ['Steel', 'Aluminum', 'Copper', 'Iron Ore', 'Precious Metals', 'Scrap Metal', 'Minerals', 'Alloys', 'Metal Sheets', 'Pipes & Tubes', 'Others'],
  'Electronics & Technology': ['Consumer Electronics', 'Components', 'Semiconductors', 'Computers & IT Hardware', 'Mobile & Accessories', 'Networking Equipment', 'Displays', 'Cables & Connectors', 'Industrial Electronics', 'Audio & Video', 'Others'],
  'Machinery & Equipment': ['Industrial Machinery', 'Construction Equipment', 'Agricultural Machinery', 'Machine Tools', 'Pumps & Valves', 'Generators', 'Material Handling', 'CNC Machines', 'Packaging Machinery', 'Spare Parts', 'Others'],
  Automotive: ['Vehicles', 'Auto Parts', 'Tires & Rubber', 'Automotive Electronics', 'Engine Components', 'Body Parts', 'Interior Components', 'Lubricants & Fluids', 'Tools & Equipment', 'Electric Vehicle Parts', 'Others'],
  'Construction & Building Materials': ['Cement & Concrete', 'Steel & Rebar', 'Glass', 'Ceramics & Tiles', 'Wood & Timber', 'Roofing Materials', 'Insulation', 'Plumbing Supplies', 'Electrical Supplies', 'Prefabricated Structures', 'Others'],
  'Energy & Utilities': ['Oil & Gas', 'Coal', 'Renewable Energy Equipment', 'Power Equipment', 'Energy Storage', 'Smart Grid Components', 'Solar Panels', 'Wind Turbines', 'Transformers', 'Meters & Instruments', 'Others'],
  'Healthcare & Pharmaceuticals': ['Medicines', 'Medical Devices', 'Diagnostic Equipment', 'Hospital Supplies', 'Personal Protective Equipment', 'Laboratory Equipment', 'Nutraceuticals', 'Veterinary Products', 'Surgical Instruments', 'Healthcare IT', 'Others'],
  'Consumer Goods': ['Personal Care', 'Household Products', 'Packaging', 'Stationery', 'Toys & Games', 'Sports Equipment', 'Luggage & Bags', 'Kitchenware', 'Furniture', 'Home Decor', 'Others'],
  'Logistics & Packaging': ['Packaging Materials', 'Pallets & Containers', 'Warehouse Equipment', 'Shipping Supplies', 'Labels & Tags', 'Stretch Film', 'Corrugated Boxes', 'Protective Packaging', 'Cold Chain Equipment', 'Tracking Systems', 'Others'],
  Others: ['General Trade', 'Multi-Industry', 'Miscellaneous', 'Others'],
};

/** Settings Industry picker options (keys of the category mapping). */
export const SETTINGS_INDUSTRIES: readonly string[] = Object.keys(SETTINGS_INDUSTRY_CATEGORIES);

/** Finds the industry that owns a given category, or '' if none (e.g. legacy data). */
export function industryForCategory(category?: string | null): string {
  if (!category) return '';
  for (const [industry, cats] of Object.entries(INVENTORY_INDUSTRY_CATEGORIES)) {
    if (cats.includes(category)) return industry;
  }
  return '';
}

export const COUNTRIES: readonly string[] = [
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Kuwait',
  'Bahrain',
  'Oman',
  'India',
  'Pakistan',
  'Bangladesh',
  'Sri Lanka',
  'China',
  'Hong Kong',
  'Singapore',
  'Malaysia',
  'Indonesia',
  'Thailand',
  'Vietnam',
  'Philippines',
  'Japan',
  'South Korea',
  'Turkey',
  'Egypt',
  'Jordan',
  'Lebanon',
  'Iraq',
  'United Kingdom',
  'Germany',
  'France',
  'Netherlands',
  'Spain',
  'Italy',
  'United States',
  'Canada',
  'Australia',
  'South Africa',
  'Nigeria',
  'Kenya',
  'Brazil',
];
