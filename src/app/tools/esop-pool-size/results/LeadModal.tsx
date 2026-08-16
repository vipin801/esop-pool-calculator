'use client';

import { useState } from 'react';
import type { Stage } from '@/lib/esop';
import { STAGE_LABEL } from '../lib/labels';

export interface Lead {
  readonly name: string;
  readonly email: string;
  readonly company: string;
  readonly stage: Stage;
  readonly consent: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com'];

interface LeadModalProps {
  readonly open: boolean;
  readonly stage: Stage;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (lead: Lead) => void;
}

export function LeadModal({ open, stage, busy, onClose, onSubmit }: LeadModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!open) return null;

  const nameValid = name.trim().length > 1;
  const emailValid = EMAIL_RE.test(email);
  const companyValid = company.trim().length > 1;
  const isFreeDomain = FREE_DOMAINS.some((d) => email.toLowerCase().endsWith(`@${d}`));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!nameValid || !emailValid || !companyValid || !consent) return;
    onSubmit({ name: name.trim(), email: email.trim(), company: company.trim(), stage, consent });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-lg border border-border bg-raised p-5 shadow-panel">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Download the detailed report</h2>
            <p className="mt-1 text-2xs leading-4 text-faint">
              A PDF with your inputs, the recommendation and the compliance checklist.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border p-1 text-sub hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded border border-border bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-strong"
            />
            {touched && !nameValid ? <p className="mt-1 text-2xs text-danger">Enter your full name.</p> : null}
          </div>
          <div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Work email"
              className="w-full rounded border border-border bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-strong"
            />
            {touched && !emailValid ? (
              <p className="mt-1 text-2xs text-danger">Enter a valid email, like name@company.com.</p>
            ) : isFreeDomain ? (
              <p className="mt-1 text-2xs text-faint">A work email helps us send the right follow-up. Personal is fine too.</p>
            ) : null}
          </div>
          <div>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company"
              className="w-full rounded border border-border bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-strong"
            />
            {touched && !companyValid ? <p className="mt-1 text-2xs text-danger">Enter your company name.</p> : null}
          </div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-accent"
            />
            <span className="text-2xs leading-4 text-sub">Incentiv can email me about this report and its products.</span>
          </label>
          {touched && !consent ? <p className="text-2xs text-danger">Tick the box so we can email the report.</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded border border-accent bg-accent px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? 'Preparing…' : 'Download report'}
          </button>
        </form>
        <p className="mt-3 text-2xs leading-4 text-faint">Stage on file: {STAGE_LABEL[stage]}.</p>
      </div>
    </div>
  );
}
