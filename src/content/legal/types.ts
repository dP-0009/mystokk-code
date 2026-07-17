/**
 * Legal content — shared types. The Privacy Policy, Terms of Service, and FAQ
 * are authored once in this folder and rendered by BOTH the web pages and the
 * native app screens. No legal text lives anywhere else.
 */

export interface LegalMeta {
  effectiveDate: string;
  lastUpdated: string;
  version: string;
}

/** A block inside a section: a paragraph or a bullet list. */
export type LegalBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

export interface LegalSection {
  id: string;
  heading: string;
  body: LegalBlock[];
}

/** Privacy Policy / Terms of Service shape. */
export interface LegalDoc {
  title: string;
  subtitle: string;
  meta: LegalMeta;
  /** Lead paragraph(s) shown before the numbered sections. */
  intro: LegalBlock[];
  sections: LegalSection[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: string;
  name: string;
  items: FaqItem[];
}

export interface FaqDoc {
  title: string;
  subtitle: string;
  meta: LegalMeta;
  categories: FaqCategory[];
}
