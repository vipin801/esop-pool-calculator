/**
 * Lead form validation. Pure — no DOM, no network, no React.
 *
 * It lives apart from the modal so the rules can be tested directly rather
 * than through a rendered form, and so "what blocks submission" is one list
 * in one place instead of a set of conditions spread across JSX.
 *
 * D3: results are never gated. Only this download is.
 */

export interface LeadDraft {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly consent: boolean;
}

export type LeadField = 'name' | 'email' | 'company' | 'consent';

export type LeadErrors = Partial<Record<LeadField, string>>;

/**
 * Deliberately loose. It rejects what is obviously not an address — no `@`, no
 * dot in the domain, whitespace — and nothing else. A stricter pattern rejects
 * real addresses, and this form's job is to catch typos, not to be an RFC.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MIN_NAME_LENGTH = 2;

/**
 * Consumer mailbox providers common in India. Used only to show a nudge; a
 * founder on a personal address is still a real lead and is never blocked.
 */
export const FREE_EMAIL_DOMAINS: readonly string[] = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.in',
  'yahoo.co.in',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'rediffmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
];

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;

  const domain = email.slice(at + 1).trim().toLowerCase();

  return domain.length > 0 ? domain : null;
}

export function isFreeEmailDomain(email: string): boolean {
  const domain = emailDomain(email);

  return domain !== null && FREE_EMAIL_DOMAINS.includes(domain);
}

/**
 * The gentle flag. It is a notice and never an error: `validateLead` does not
 * return it, so it cannot reach the disabled state on the submit button.
 */
export function freeEmailDomainNotice(email: string): string | null {
  if (!EMAIL_PATTERN.test(email.trim())) return null;
  if (!isFreeEmailDomain(email)) return null;

  return 'A work email helps us send the right follow-up. A personal one is fine too.';
}

/**
 * Every reason this form will not submit, keyed by the field to point at.
 *
 * Each message says what to fix rather than what is wrong, because the founder
 * reading it is trying to finish, not to be assessed.
 */
export function validateLead(draft: LeadDraft): LeadErrors {
  const errors: LeadErrors = {};

  if (draft.name.trim().length < MIN_NAME_LENGTH) {
    errors.name = 'Enter your full name.';
  }

  if (!EMAIL_PATTERN.test(draft.email.trim())) {
    errors.email = 'Enter a valid email, like name@company.com.';
  }

  if (draft.company.trim().length < MIN_NAME_LENGTH) {
    errors.company = 'Enter your company name.';
  }

  if (!draft.consent) {
    errors.consent = 'Tick the box so we can email you the report.';
  }

  return errors;
}

export function isLeadValid(draft: LeadDraft): boolean {
  return Object.keys(validateLead(draft)).length === 0;
}

export const EMPTY_LEAD_DRAFT: LeadDraft = {
  name: '',
  email: '',
  company: '',
  consent: false,
};
