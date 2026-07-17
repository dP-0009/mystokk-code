import type { LegalDoc } from './types';

/**
 * Privacy Policy — authored for MyStokk, a private B2B inventory-sharing
 * platform used by trading and distribution businesses in the UAE. Aligned with
 * UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data
 * (PDPL). This is the single source; both web and app render from it.
 */
export const privacy: LegalDoc = {
  title: 'Privacy Policy',
  subtitle: 'How MyStokk collects, uses, and protects your personal data',
  meta: { effectiveDate: '18 July 2026', lastUpdated: '18 July 2026', version: '1.0' },

  intro: [
    {
      kind: 'p',
      text: 'MyStokk ("MyStokk", "we", "us") is a private business-to-business platform that lets trading and distribution companies share live inventory with contacts they choose, reserve and negotiate stock, and forward offers along a private chain — never to the open market. This Privacy Policy explains what personal data we process, why, the legal bases we rely on, and the rights you have.',
    },
    {
      kind: 'p',
      text: 'It is written to align with UAE Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (the "PDPL") and applies to the MyStokk mobile app and the website at www.mystokk.com. By creating an account or using MyStokk, you acknowledge the practices described here.',
    },
  ],

  sections: [
    {
      id: 'scope',
      heading: '1. Who this policy covers',
      body: [
        {
          kind: 'p',
          text: 'This policy applies to business users who register for and use MyStokk, and to anyone who opens a share link we deliver on a member’s behalf. MyStokk is intended for business use; it is not a consumer marketplace.',
        },
        {
          kind: 'p',
          text: 'MyStokk is the controller of the account and usage data described below. Inventory, pricing, and documents that members upload are content the member controls and directs us to display only to the recipients they select.',
        },
      ],
    },
    {
      id: 'collect',
      heading: '2. Personal data we collect',
      body: [
        { kind: 'p', text: 'We collect only what we need to run the platform:' },
        {
          kind: 'ul',
          items: [
            'Account and profile data: contact person name, work email, company name, mobile/WhatsApp and telephone numbers, city, country, industry, and any company logo you upload.',
            'Business content: the inventory items, product photos, documents, quantities, and prices you add, plus your network connections and your reservation and negotiation activity.',
            'Sign-in data: when you use Sign in with Google or Apple, we receive only your basic profile (name and email) to create or access your account. We never receive your Google or Apple password.',
            'Device and usage data: basic technical information needed to operate the service and deliver notifications, such as app/version, device type, a push token, and diagnostic logs.',
          ],
        },
        {
          kind: 'p',
          text: 'We do not intentionally collect special categories of personal data, and we ask that you do not upload them.',
        },
      ],
    },
    {
      id: 'use',
      heading: '3. How and why we use your data',
      body: [
        { kind: 'p', text: 'We use personal data to:' },
        {
          kind: 'ul',
          items: [
            'Create and secure your account and authenticate sign-in.',
            'Provide the core service — showing your inventory only to the specific contacts you choose, powering shares, reservations, negotiations, and the privacy chain that hides an upstream supplier’s identity and price from downstream recipients.',
            'Send transactional and (with your permission) push notifications about shares, reservations, and negotiation updates.',
            'Respond to support requests and communicate service or policy changes.',
            'Prevent fraud and abuse, verify businesses, and keep the platform safe and reliable.',
          ],
        },
        {
          kind: 'p',
          text: 'We do not use your data for advertising, we do not sell it, and we never list your inventory on a public marketplace.',
        },
      ],
    },
    {
      id: 'bases',
      heading: '4. Legal bases for processing',
      body: [
        { kind: 'p', text: 'Under the PDPL we rely on the following bases:' },
        {
          kind: 'ul',
          items: [
            'Performance of a contract — to deliver the service you sign up for.',
            'Your consent — for push notifications and, where required, certain optional features; you can withdraw consent at any time.',
            'Our legitimate business interests — to secure the platform, prevent abuse, and improve reliability, balanced against your rights.',
            'Compliance with a legal obligation — where we must retain or disclose data under applicable UAE law.',
          ],
        },
      ],
    },
    {
      id: 'sharing',
      heading: '5. How your data is shared',
      body: [
        {
          kind: 'p',
          text: 'Item details are shared only with the vendors you select, or with anyone holding a public share link you chose to create. Within the privacy chain, a recipient sees the item and your terms — never the upstream source’s identity or price.',
        },
        {
          kind: 'p',
          text: 'We use a small number of trusted service providers strictly to operate MyStokk, acting as our processors under contract:',
        },
        {
          kind: 'ul',
          items: [
            'Supabase — cloud database, authentication, and file storage.',
            'Firebase Cloud Messaging (Google) and Apple Push Notification service — push delivery.',
            'Google and Apple — Sign in with Google/Apple.',
            'Our email delivery provider — verification codes and notification emails.',
          ],
        },
        {
          kind: 'p',
          text: 'We do not share your data with third parties for their own purposes. We may disclose data if required by law, court order, or a lawful request from a competent UAE authority.',
        },
      ],
    },
    {
      id: 'transfers',
      heading: '6. International data transfers',
      body: [
        {
          kind: 'p',
          text: 'Some of our processors store or process data on servers outside the United Arab Emirates. Where personal data is transferred abroad, we take steps consistent with the PDPL to ensure an adequate level of protection, including contractual safeguards with our processors.',
        },
      ],
    },
    {
      id: 'retention',
      heading: '7. Data retention',
      body: [
        {
          kind: 'p',
          text: 'We keep your personal data for as long as your account is active. You can edit or delete your inventory at any time, and delete your account from Settings, which removes your data subject to any retention we are legally required to observe. Backups are cycled out on a rolling basis.',
        },
      ],
    },
    {
      id: 'rights',
      heading: '8. Your rights under the PDPL',
      body: [
        { kind: 'p', text: 'Subject to the conditions and exceptions in the PDPL, you have the right to:' },
        {
          kind: 'ul',
          items: [
            'Access — obtain confirmation of and a copy of the personal data we hold about you.',
            'Correction — have inaccurate or incomplete data corrected.',
            'Deletion — request erasure of your personal data.',
            'Restriction — ask us to limit how we process your data.',
            'Portability — receive your data in a structured, machine-readable format.',
            'Objection — object to certain processing based on our legitimate interests.',
            'Withdraw consent — withdraw any consent you have given, without affecting prior lawful processing.',
          ],
        },
        {
          kind: 'p',
          text: 'To exercise any of these rights, email support@mystokk.app. We will respond within the period required by law. You also have the right to lodge a complaint with the UAE Data Office if you believe your data has been handled unlawfully.',
        },
      ],
    },
    {
      id: 'security',
      heading: '9. How we protect your data',
      body: [
        {
          kind: 'p',
          text: 'We apply technical and organisational measures appropriate to the risk, including: encryption of data in transit (HTTPS/TLS); database access enforced with row-level security so each business can only reach data it is entitled to; least-privilege access controls for our team and services; and private file storage delivered through short-lived signed links rather than public URLs.',
        },
        {
          kind: 'p',
          text: 'No system is perfectly secure, but we work to protect your data and to notify you and the relevant authority of a personal-data breach where the law requires.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: '10. Cookies and local storage (website)',
      body: [
        {
          kind: 'p',
          text: 'The MyStokk website uses only strictly necessary browser storage — local storage and similar technologies — to keep you signed in and to remember essential preferences. We do not use advertising or third-party tracking cookies. You can clear this storage through your browser at any time, though doing so will sign you out.',
        },
      ],
    },
    {
      id: 'children',
      heading: '11. Children',
      body: [
        {
          kind: 'p',
          text: 'MyStokk is a business platform and is not directed at, or intended for use by, anyone under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us data, contact us and we will delete it.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '12. Changes and how to contact us',
      body: [
        {
          kind: 'p',
          text: 'We may update this policy as the product and the law evolve. When we make material changes we will update the “last updated” date above and, where appropriate, notify you in the app. Continued use after an update means you accept the revised policy.',
        },
        {
          kind: 'p',
          text: 'For any privacy question, to exercise your rights, or to request deletion of your data, contact us at support@mystokk.app.',
        },
      ],
    },
  ],
};
