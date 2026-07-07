// generate_apple_secret.js
// Generates the Apple "Secret Key (for OAuth)" JWT that Supabase needs.
//
// USAGE:
// 1. npm install jsonwebtoken
// 2. Fill in the 4 values below
// 3. node generate_apple_secret.js
// 4. Copy the printed JWT into Supabase's "Secret Key (for OAuth)" field

const jwt = require("jsonwebtoken");
const fs = require("fs");

// ---- FILL THESE IN ----
const TEAM_ID = "HBH7MFW8UP";                  // Your Apple Team ID
const KEY_ID = "7LCW3HLUWG";                    // The Sign in with Apple Key ID
const CLIENT_ID = "com.ecozoe.mystokk.service"; // Your Services ID
const PRIVATE_KEY_PATH = "./AuthKey_7LCW3HLUWG.p8"; // Path to your downloaded .p8 file
// ------------------------

const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

const token = jwt.sign(
  {
    iss: TEAM_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180, // 180 days (max allowed by Apple)
    aud: "https://appleid.apple.com",
    sub: CLIENT_ID,
  },
  privateKey,
  {
    algorithm: "ES256",
    header: {
      alg: "ES256",
      kid: KEY_ID,
    },
  }
);

console.log("\nYour Apple OAuth Secret Key (paste this into Supabase):\n");
console.log(token);
console.log("\nThis token expires in 180 days — set a reminder to regenerate it.\n");
