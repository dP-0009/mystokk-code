import type { FaqDoc } from './types';

/** Frequently asked questions — grouped by category. Single source for web + app. */
export const faq: FaqDoc = {
  title: 'FAQ',
  subtitle: 'Answers to common questions about MyStokk',
  meta: { effectiveDate: '18 July 2026', lastUpdated: '18 July 2026', version: '1.0' },

  categories: [
    {
      id: 'getting-started',
      name: 'Getting started',
      items: [
        {
          question: 'What is MyStokk?',
          answer:
            'MyStokk is a private B2B platform for trading and distribution businesses. You can share live stock with contacts you choose, reserve and negotiate inventory, and forward offers to trusted contacts — never to the open market.',
        },
        {
          question: 'Who is MyStokk for?',
          answer:
            'It is built for businesses — traders, distributors, wholesalers, and suppliers — that move inventory within trusted networks. It is not a public consumer marketplace.',
        },
        {
          question: 'How do I sign up?',
          answer:
            'Create an account with your work email, or use Sign in with Google or Apple, then complete a short business profile. You can start adding inventory and building your network right away.',
        },
        {
          question: 'Is MyStokk free?',
          answer:
            'Yes, MyStokk is currently free to use. If we introduce fees for any features in the future, we will give at least 30 days’ notice first.',
        },
      ],
    },
    {
      id: 'privacy-chain',
      name: 'Privacy & the privacy chain',
      items: [
        {
          question: 'Who can see my inventory?',
          answer:
            'Only the vendors you explicitly share an item with, or anyone you send a public share link to. Your catalog is never publicly listed or searchable.',
        },
        {
          question: 'What is the “privacy chain”?',
          answer:
            'When you forward an item that was shared with you, your contact sees the item with your price and remark — while the original supplier’s identity and price stay hidden. Every link in the chain only ever sees the person directly above them.',
        },
        {
          question: 'If I forward an item, does the recipient see who I got it from?',
          answer:
            'No. The upstream source’s identity and price are masked. Your recipient sees the item and your terms only. Attempting to de-anonymise an upstream supplier is against our Terms.',
        },
        {
          question: 'Is my inventory ever shown on a public marketplace?',
          answer:
            'Never. MyStokk does not list or advertise your inventory publicly. Items are visible only to the specific contacts you choose, or to holders of a share link you created.',
        },
      ],
    },
    {
      id: 'sharing-network',
      name: 'Sharing & your network',
      items: [
        {
          question: 'How do I share an item?',
          answer:
            'Open an item and tap Share, then choose the vendors in your network who should see it, or generate a public share link. You set the price and remark your recipients will see.',
        },
        {
          question: 'How do I add vendors to my network?',
          answer:
            'Open My Network → Add Vendor to invite a contact by email, or bulk-upload a spreadsheet. Vendors who already have a MyStokk account connect instantly; others receive an invite.',
        },
        {
          question: 'What is a share link?',
          answer:
            'A share link lets someone view a specific item you shared, even if they are not yet on MyStokk. You can revoke a link at any time from the item’s Manage Shares screen.',
        },
      ],
    },
    {
      id: 'reservations',
      name: 'Reservations & negotiation',
      items: [
        {
          question: 'How do reservations work?',
          answer:
            'A buyer reserves a quantity at your listed price or at an offered price. From there each side can accept, reject, or counter — and you can pass a request through to your own supplier while keeping the chain private.',
        },
        {
          question: 'How does negotiation work?',
          answer:
            'Each side can counter, accept, or reject an offer in a turn-based thread. Negotiation is capped per side, and the full history stays attached to the reservation so both parties can see how terms were reached.',
        },
      ],
    },
    {
      id: 'account-data',
      name: 'Account, data & notifications',
      items: [
        {
          question: 'How do I edit or delete my inventory?',
          answer:
            'Open any item to edit its details, photos, or documents, or to delete it. Changes take effect immediately for anyone you have shared it with.',
        },
        {
          question: 'How do I delete my account?',
          answer:
            'Go to Settings and choose to delete your account. This removes your data subject to any retention we are legally required to keep. You can also email support@mystokk.app to request access to or deletion of your data.',
        },
        {
          question: 'How do I manage notifications?',
          answer:
            'You control push notifications from Settings and from your device settings. You can turn the master toggle and individual alert types (new shares, reservation requests, reservation updates, counter offers) on or off at any time.',
        },
      ],
    },
    {
      id: 'security-signin',
      name: 'Security & sign-in',
      items: [
        {
          question: 'How is my data protected?',
          answer:
            'Data is encrypted in transit, and database access is enforced with row-level security so each business can only reach data it is entitled to. Photos and documents are kept private and delivered through short-lived signed links.',
        },
        {
          question: 'What happens when I sign in with Google or Apple?',
          answer:
            'We receive only your basic profile (name and email) to create or access your account. We never receive your Google or Apple password, and we do not post anything to those accounts.',
        },
      ],
    },
  ],
};
