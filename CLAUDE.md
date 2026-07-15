@AGENTS.md

## MOBILE REDESIGN RULES (branch: mobile-redesign)
1. STRICT — THE WEB APP IS FINISHED AND MUST NOT BE TOUCHED. Zero
   changes to web output, visually or functionally, including the
   responsive mobile-browser view. Achieve ALL mobile changes via
   platform-specific files (Component.native.tsx / Component.web.tsx)
   or Platform.OS === 'web' guards. Never edit what web renders. If a
   change could affect web, fork the file instead. Editing a shared
   web-rendered file (e.g. App.tsx) is allowed ONLY to mount a fork
   whose web variant is a pure passthrough, and requires stating so.
2. Zero changes to business logic, Supabase queries, RPC calls, auth
   flows, data models, deep-link handling, or the privacy-chain
   mechanics. Presentation layer only. Reuse existing
   hooks/services/mutations.
3. The design source of truth is design/mystokk-final.html — a complete
   working HTML prototype of the target mobile app. When implementing
   any screen, open this file, find the matching SCREENS.<name>
   template, and reproduce its layout, hierarchy, spacing, colors, and
   copy in React Native.
4. Design tokens (from the prototype): navy #0F2B54, blue #2E7CF6,
   blue-dark #1E5FD0, sky #56C8FF, ice #E3EEFF, muted #67768F, text
   #17233A, green #149A54, amber #B26205, red #D93030, violet #6D5BE8.
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
