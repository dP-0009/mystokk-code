@AGENTS.md

## MOBILE REDESIGN RULES (branch: mobile-redesign)
1. THE WEB APP IS PROTECTED BY DEFAULT — do not change web output,
   visually or functionally (including the responsive mobile-browser
   view), unless the task explicitly says to. Achieve mobile changes via
   platform-specific files (Component.native.tsx / Component.web.tsx) or
   Platform.OS === 'web' guards. If a change could affect web, fork the
   file instead. Editing a shared web-rendered file (e.g. App.tsx) is
   allowed ONLY to mount a fork whose web variant is a pure passthrough,
   or under an explicit instruction, and requires stating so.

   EXCEPTION ALREADY TAKEN (do not "restore" it): the loading and brand
   -mark layer was deliberately changed on web by explicit instruction —
   see rule 13. Web is therefore NOT byte-identical to the pre-redesign
   build, and the loader/logo work is intentionally shared across both
   platforms rather than forked. Everything else on web remains
   protected.
2. Zero changes to business logic, Supabase queries, RPC calls, auth
   flows, data models, deep-link handling, or the privacy-chain
   mechanics. Presentation layer only. Reuse existing
   hooks/services/mutations.
3. The design source of truth is design/mystokk-final.html — a complete
   working HTML prototype of the target mobile app. When implementing
   any screen, open this file, find the matching SCREENS.<name>
   template, and reproduce its layout, hierarchy, spacing, colors, and
   copy in React Native.
   NOTE: this file is NOT currently in the repo. The only design file
   present is design/loader-reference.html (the loader + welcome screen,
   source of truth for rule 13). If a task references a design file that
   is absent, say so and ask — do not guess the values.
4. Design tokens (from the prototype): navy #0F2B54, blue #2E7CF6,
   blue-dark #1E5FD0, sky #56C8FF, ice #E3EEFF, muted #67768F, text
   #17233A, green #149A54, amber #B26205, red #D93030, violet #6D5BE8.
   These are the UI palette. The BRAND MARK is a separate, narrower set
   and does not use them: src/constants/brand.ts — navy #0F172A (blocks,
   dark text), primary #2563EB (accent block, the "o"), wordmark
   #0B1220. Import from brand.ts; never hardcode those three.
5. The word "Forward" must never appear in the mobile UI — the action
   is always "Share". The share icon is the share-nodes glyph (three
   circles + connecting lines), matching the existing app.
6. Approved dependencies (already installed): expo-glass-effect,
   @gorhom/bottom-sheet, expo-haptics, react-native-reanimated,
   @shopify/flash-list, expo-linear-gradient, react-native-svg,
   react-native-gesture-handler, expo-blur. Anything else: ask first.
7. TAB BAR SPEC: the bottom tab bar has FOUR tabs only — Home,
   "My inventory", Received, "Reservation Hub". There is NO Network
   tab. Tab slots are PROPORTIONAL (flex .78 / 1.08 / .88 / 1.26) so
   labels never clip; labels ~9.5px equivalent, single line, never
   wrapped; the active highlight pill spans the tab's own width (inset
   ~4px each side). The bar floats ABOVE the iOS home indicator via
   safe-area insets (safe-area bottom + ~10px). Bar side margins 10px,
   inner horizontal padding 4px.
8. NETWORK SPEC: the Network screen is a PUSHED stack screen, not a
   tab; entry point is the "My Network" stat tile on Home. It has a
   single "Network (n)" underline tab — there is NO Pending tab or
   pending pane.
9. The Notifications "Read all" control is a single-line glass pill,
   never wrapped to two lines.
10. REALTIME RULE: any Supabase Realtime channel topic must be unique
    per mount (append a per-mount random suffix), because two mounted
    components sharing one topic name crash with "cannot add
    postgres_changes callbacks after subscribe()". Channel build must
    be synchronous off its deps, with removeChannel cleanup.
11. Keep all existing routes/paths working so deep links are
    unaffected.
12. After every task, list all files created/changed and explicitly
    state whether any web-rendered file was modified.
13. LOADER POLICY (applies to app AND web; supersedes rule 1 for this
    layer). The animated four-block logo is the ONLY loading indicator
    anywhere. No ActivityIndicator, no spinner, no second loader, no
    text or wordmark in any loading state — logo only.
    - Source of truth: design/loader-reference.html (geometry, timing,
      easing). Production sequence is its 0→0.48s action portion.
    - <BrandLoader mode="loop"> for every loading state; sizes 150
      full-screen, 90 modal/sheet/section, 56 small inline.
      <BrandLoader mode="once"> only in ColdStartGate (plays once, holds).
    - In-button pending state = the button's existing disabled styling,
      NOT a loader: the loader's fly-in starts off-stage and would spill
      outside a button.
    - Four files, and the split matters:
        BrandLogo.tsx           static mark + exported LOCKUP geometry
        brandLoaderTimeline.ts  exported TIMELINE motion constants
        BrandLoader.tsx         native, Reanimated
        BrandLoader.web.tsx     web, CSS keyframes
      Both loaders import LOCKUP and TIMELINE. Never copy those values
      into a platform file — the shared constants are what keep native
      and web identical. Keep Reanimated out of the web bundle.
    - In-app UI draws the mark via <BrandLogo>, never <Image> of the
      PNG (the asset load causes visible pop-in). assets/branding/
      mystokk-logo.png is only for the app icon, native splash, favicon
      and store/social meta images.
14. A local android/ folder exists (bare-workflow leftover, gitignored).
    It OVERRIDES app.json icon/splash config, so after changing those,
    re-run `npx expo prebuild --clean` or the stale baked copy ships.
