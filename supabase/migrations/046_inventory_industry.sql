-- ------------------------------------------------------------
-- INVENTORY INDUSTRY (optional)
-- ------------------------------------------------------------
-- The Add/Edit Item form now offers optional Industry + Category dropdowns
-- (mirroring the company-profile taxonomy). `category` already exists; add a
-- nullable `industry` column so items can be classified/filtered by industry.
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS industry TEXT;
