/**
 * One-off icon generator. Reads the master brand logo and writes the app icon
 * set. iOS icons must be fully opaque (no alpha), so icon.png/favicon.png get a
 * white background; the Android adaptive foreground stays transparent.
 *
 * Run: node scripts/generate-icons.js
 */
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '..', 'assets', 'branding', 'mystokk-logo.png');
const OUT = path.join(__dirname, '..', 'assets');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function make(canvas, logoFraction, background, outName, opaque) {
  const logoSize = Math.round(canvas * logoFraction);
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: TRANSPARENT })
    .toBuffer();
  const offset = Math.round((canvas - logoSize) / 2);
  let img = sharp({ create: { width: canvas, height: canvas, channels: 4, background } }).composite([
    { input: logo, top: offset, left: offset },
  ]);
  // iOS icons must have NO alpha channel — flatten + drop alpha to true RGB.
  if (opaque) img = img.flatten({ background }).removeAlpha();
  await img.png().toFile(path.join(OUT, outName));
  console.log(`  ${outName} — ${canvas}x${canvas}, logo ${Math.round(logoFraction * 100)}%${opaque ? ' (opaque RGB)' : ''}`);
}

(async () => {
  console.log('Generating icons from assets/branding/mystokk-logo.png');
  await make(1024, 0.68, WHITE, 'icon.png', true); // iOS/app icon — opaque white, no alpha
  await make(1024, 0.62, TRANSPARENT, 'adaptive-icon.png', false); // Android adaptive foreground
  await make(48, 0.68, WHITE, 'favicon.png', true); // web favicon — white
  console.log('Done.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
