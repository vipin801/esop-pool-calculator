/**
 * The lead form's rules, tested directly rather than through a rendered form.
 *
 * D3 puts a gate on exactly one thing — the report download — so what this
 * gate lets through and what it blocks is worth pinning. The rules live in
 * `leadValidation.ts` precisely so these assertions can be about the rules and
 * not about the JSX that happens to render them.
 */

import { describe, expect, it } from 'vitest';

import {
  EMPTY_LEAD_DRAFT,
  FREE_EMAIL_DOMAINS,
  emailDomain,
  freeEmailDomainNotice,
  isFreeEmailDomain,
  isLeadValid,
  validateLead,
  type LeadDraft,
} from '../lib/leadValidation';

const VALID: LeadDraft = {
  name: 'Asha Menon',
  email: 'asha@northstar.co.in',
  company: 'Northstar Labs',
  consent: true,
};

function withField<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]): LeadDraft {
  return { ...VALID, [key]: value };
}

describe('a complete lead passes', () => {
  it('accepts every field filled and consent given', () => {
    expect(validateLead(VALID)).toEqual({});
    expect(isLeadValid(VALID)).toBe(true);
  });

  it('trims before measuring, so spaces are not a name', () => {
    expect(isLeadValid(withField('name', '   '))).toBe(false);
    expect(isLeadValid(withField('company', '  '))).toBe(false);
    expect(isLeadValid(withField('email', '  asha@northstar.co.in  '))).toBe(true);
  });
});

describe('the empty form blocks, and says so field by field', () => {
  it('reports all four reasons at once rather than one at a time', () => {
    const errors = validateLead(EMPTY_LEAD_DRAFT);

    expect(Object.keys(errors).sort()).toEqual(['company', 'consent', 'email', 'name']);
    expect(isLeadValid(EMPTY_LEAD_DRAFT)).toBe(false);
  });

  it('says what to fix, not what is wrong', () => {
    const errors = validateLead(EMPTY_LEAD_DRAFT);

    // Every message is an instruction. A founder reading it is trying to
    // finish, not to be assessed.
    for (const message of Object.values(errors)) {
      expect(message).toMatch(/^(Enter|Tick)\b/);
    }
  });
});

describe('each field blocks on its own', () => {
  it('blocks a missing or one-character name', () => {
    expect(validateLead(withField('name', '')).name).toBe('Enter your full name.');
    expect(validateLead(withField('name', 'A')).name).toBeDefined();
    expect(validateLead(withField('name', 'Jo')).name).toBeUndefined();
  });

  it('blocks a missing or one-character company', () => {
    expect(validateLead(withField('company', '')).company).toBe('Enter your company name.');
    expect(validateLead(withField('company', 'X')).company).toBeDefined();
  });

  it('blocks until consent is ticked, and never on a technicality elsewhere', () => {
    expect(validateLead(withField('consent', false)).consent).toBe(
      'Tick the box so we can email you the report.',
    );
    expect(Object.keys(validateLead(withField('consent', false)))).toEqual(['consent']);
  });
});

describe('email format', () => {
  const rejected = [
    '',
    'asha',
    'asha@',
    '@northstar.co.in',
    'asha@northstar',
    'asha northstar@x.com',
    'asha@northstar.c',
    'asha@@northstar.com',
  ];

  for (const email of rejected) {
    it(`rejects ${JSON.stringify(email)}`, () => {
      expect(validateLead(withField('email', email)).email).toBe(
        'Enter a valid email, like name@company.com.',
      );
    });
  }

  const accepted = [
    'asha@northstar.co.in',
    'asha.menon@northstar.com',
    'asha+esop@northstar.io',
    'a@b.co',
    "o'brien@northstar.ie",
  ];

  for (const email of accepted) {
    it(`accepts ${JSON.stringify(email)}`, () => {
      expect(validateLead(withField('email', email)).email).toBeUndefined();
    });
  }
});

describe('free email domains are flagged gently, and never blocked', () => {
  it('never turns a free domain into an error', () => {
    for (const domain of FREE_EMAIL_DOMAINS) {
      const draft = withField('email', `founder@${domain}`);

      expect(validateLead(draft), domain).toEqual({});
      expect(isLeadValid(draft), domain).toBe(true);
    }
  });

  it('does return a notice for one, so the nudge exists', () => {
    expect(freeEmailDomainNotice('founder@gmail.com')).toMatch(/work email/i);
    expect(isFreeEmailDomain('founder@GMAIL.COM')).toBe(true);
  });

  it('says nothing about a company domain', () => {
    expect(freeEmailDomainNotice('asha@northstar.co.in')).toBeNull();
    expect(isFreeEmailDomain('asha@northstar.co.in')).toBe(false);
  });

  it('says nothing at all until the address is otherwise valid', () => {
    // The nudge would otherwise appear mid-typing, on "founder@gmail.c".
    expect(freeEmailDomainNotice('founder@gmail')).toBeNull();
    expect(freeEmailDomainNotice('')).toBeNull();
  });

  it('reads the domain after the last @, not the first', () => {
    expect(emailDomain('a@b@northstar.com')).toBe('northstar.com');
    expect(emailDomain('no-at-sign')).toBeNull();
  });
});
