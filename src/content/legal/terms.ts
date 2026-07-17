import type { LegalDoc } from './types';

/**
 * Terms of Service — the agreement governing use of MyStokk. Authored from
 * scratch for a UAE B2B inventory-sharing platform; references UAE Federal
 * Decree-Law No. 34 of 2021 on Combatting Rumours and Cybercrimes.
 */
export const terms: LegalDoc = {
  title: 'Terms of Service',
  subtitle: 'The agreement between you and MyStokk',
  meta: { effectiveDate: '18 July 2026', lastUpdated: '18 July 2026', version: '1.0' },

  intro: [
    {
      kind: 'p',
      text: 'These Terms of Service (the "Terms") govern your access to and use of MyStokk, a private business-to-business platform for sharing, reserving, negotiating, and forwarding inventory. By creating an account or using MyStokk, you agree to these Terms. If you do not agree, do not use the service.',
    },
  ],

  sections: [
    {
      id: 'acceptance',
      heading: '1. Acceptance and eligibility',
      body: [
        {
          kind: 'p',
          text: 'To use MyStokk you must be at least 18 years old and have the authority to enter into a binding agreement on behalf of the business you register. You agree to provide accurate, current, and complete registration information and to keep it up to date. You are responsible for all activity that occurs under your account and for keeping your credentials secure.',
        },
      ],
    },
    {
      id: 'service',
      heading: '2. The service',
      body: [
        {
          kind: 'p',
          text: 'MyStokk is a platform that connects businesses so they can share and forward inventory with contacts they choose. MyStokk provides the tools to communicate commercial intent — shares, reservations, counter-offers, and forwards.',
        },
        {
          kind: 'p',
          text: 'MyStokk is not a party to any sale, purchase, or other transaction between members. Members contract directly with each other. We do not take title to, inspect, warehouse, ship, or guarantee any goods, and we are not responsible for the negotiation, fulfilment, payment, quality, or delivery of any deal arranged through the platform.',
        },
      ],
    },
    {
      id: 'privacy-chain',
      heading: '3. Privacy-chain and conduct rules',
      body: [
        {
          kind: 'p',
          text: 'MyStokk’s core value is the privacy chain: when an item is forwarded, downstream recipients see the item and the forwarding member’s terms, but never the upstream source’s identity or price. You agree not to undermine this protection.',
        },
        {
          kind: 'p',
          text: 'The following are material breaches of these Terms and may result in immediate suspension or removal:',
        },
        {
          kind: 'ul',
          items: [
            'Attempting to circumvent, defeat, or reverse-engineer the identity or price masking of the privacy chain.',
            'Scraping, harvesting, or systematically extracting data from the platform by any automated or manual means.',
            'Attempting to identify, de-anonymise, or contact an upstream supplier revealed to you only through a forwarded offer.',
            'Sharing another member’s confidential information outside the platform without their consent.',
          ],
        },
      ],
    },
    {
      id: 'listings',
      heading: '4. Listings and your goods',
      body: [
        {
          kind: 'p',
          text: 'You are solely responsible for the inventory, photos, documents, descriptions, and prices you post. You represent that you lawfully own or are authorised to offer the goods you list, that your listings are accurate and not misleading, and that your goods and any resulting transaction comply with all applicable UAE laws, including import/export controls and product-safety and labelling regulations.',
        },
        { kind: 'p', text: 'You must not list, offer, or transact in:' },
        {
          kind: 'ul',
          items: [
            'Illegal goods, or goods whose sale or possession is prohibited under UAE law.',
            'Counterfeit, pirated, or IP-infringing goods.',
            'Sanctioned items or goods traded with sanctioned parties.',
            'Restricted or controlled items (for example weapons, narcotics, or other regulated products) without the required licences and approvals.',
          ],
        },
      ],
    },
    {
      id: 'acceptable-use',
      heading: '5. Acceptable use',
      body: [
        {
          kind: 'p',
          text: 'You agree to use MyStokk only for lawful, legitimate B2B trading and distribution purposes, and in compliance with UAE Federal Decree-Law No. 34 of 2021 on Combatting Rumours and Cybercrimes. In particular, you must not:',
        },
        {
          kind: 'ul',
          items: [
            'Commit fraud or post false, deceptive, or misleading trade information.',
            'Gain or attempt to gain unauthorised access to any account, data, or part of the platform.',
            'Upload malware, or interfere with, overload, or disrupt the service or its infrastructure.',
            'Impersonate any person or business, or misrepresent your affiliation.',
            'Use the platform to harass, threaten, or defame others, or to distribute unlawful content.',
          ],
        },
      ],
    },
    {
      id: 'fees',
      heading: '6. Fees',
      body: [
        {
          kind: 'p',
          text: 'MyStokk is currently free to use. We may introduce fees for some or all features in the future. If we do, we will give you at least 30 days’ notice before the fees take effect, and you may choose to stop using the paid features rather than pay.',
        },
      ],
    },
    {
      id: 'verification',
      heading: '7. Business verification',
      body: [
        {
          kind: 'p',
          text: 'To protect the network, we may verify the businesses that register — including requesting reasonable documentation. We may decline, suspend, limit, or remove any account that we are unable to verify, or that we reasonably believe is misused or unlawful.',
        },
      ],
    },
    {
      id: 'ip',
      heading: '8. Intellectual property',
      body: [
        {
          kind: 'p',
          text: 'MyStokk, including the platform, software, design, and brand, is owned by us and protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable, revocable licence to use the app and website for their intended purpose. You may not copy, modify, distribute, or create derivative works of the platform.',
        },
        {
          kind: 'p',
          text: 'You retain ownership of the inventory, photos, and documents you upload. You grant us a limited licence to host, process, and display that content solely to operate the service and to show it to the contacts you choose.',
        },
      ],
    },
    {
      id: 'disclaimer',
      heading: '9. Disclaimers',
      body: [
        {
          kind: 'p',
          text: 'The service is provided “as is” and “as available”, without warranties of any kind, whether express or implied, to the fullest extent permitted by law. We do not warrant that the service will be uninterrupted or error-free, or that any listing, member, or transaction is accurate, lawful, or reliable. Any dealings you have with other members are at your own risk.',
        },
      ],
    },
    {
      id: 'liability',
      heading: '10. Limitation of liability',
      body: [
        {
          kind: 'p',
          text: 'To the fullest extent permitted by UAE law, MyStokk is not liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of profits, revenue, data, goodwill, or goods, arising from your use of — or inability to use — the service or from any transaction between members. Nothing in these Terms excludes liability that cannot lawfully be excluded.',
        },
      ],
    },
    {
      id: 'indemnity',
      heading: '11. Indemnity',
      body: [
        {
          kind: 'p',
          text: 'You agree to indemnify and hold MyStokk harmless from any claims, losses, liabilities, and expenses (including reasonable legal fees) arising out of your content, your listings, your transactions with other members, or your breach of these Terms or of applicable law.',
        },
      ],
    },
    {
      id: 'termination',
      heading: '12. Suspension and termination',
      body: [
        {
          kind: 'p',
          text: 'You may stop using MyStokk and delete your account at any time from Settings. We may suspend or terminate your access if you breach these Terms, if verification fails, or if we reasonably believe your use is unlawful or harmful to the platform or its members. Provisions that by their nature should survive termination will do so.',
        },
      ],
    },
    {
      id: 'governing-law',
      heading: '13. Governing law and disputes',
      body: [
        {
          kind: 'p',
          text: 'These Terms are governed by the laws of the United Arab Emirates. Any dispute arising from or relating to these Terms or the service is subject to the exclusive jurisdiction of the competent courts of the United Arab Emirates.',
        },
      ],
    },
    {
      id: 'changes',
      heading: '14. Changes and contact',
      body: [
        {
          kind: 'p',
          text: 'We may update these Terms as the product evolves. When we make material changes we will update the “last updated” date above and, where appropriate, notify you in the app. Continued use after an update means you accept the revised Terms.',
        },
        { kind: 'p', text: 'Questions about these Terms? Contact us at support@mystokk.app.' },
      ],
    },
  ],
};
