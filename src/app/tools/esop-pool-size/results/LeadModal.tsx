'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { STAGES, type Stage } from '@/lib/esop';
import { STAGE_LABEL } from '../lib/labels';
import {
  EMPTY_LEAD_DRAFT,
  freeEmailDomainNotice,
  isLeadValid,
  validateLead,
  type LeadDraft,
  type LeadField,
} from '../lib/leadValidation';
import { SelectField } from '../ui/SelectField';

export interface Lead extends LeadDraft {
  readonly stage: Stage;
}

interface LeadModalProps {
  readonly open: boolean;
  readonly stage: Stage;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (lead: Lead) => void;
}

const INPUT_CLASSES =
  'w-full rounded border border-border bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-strong';

export function LeadModal({ open, stage, busy, onClose, onSubmit }: LeadModalProps) {
  const [draft, setDraft] = useState<LeadDraft>(EMPTY_LEAD_DRAFT);
  const [leadStage, setLeadStage] = useState<Stage>(stage);
  const [touched, setTouched] = useState<Partial<Record<LeadField, boolean>>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();

  /** Prefilled from the inputs, and re-synced if the founder changes stage behind the modal. */
  const [syncedStage, setSyncedStage] = useState(stage);
  if (syncedStage !== stage) {
    setSyncedStage(stage);
    setLeadStage(stage);
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const errors = validateLead(draft);
  const valid = isLeadValid(draft);
  const emailNotice = freeEmailDomainNotice(draft.email);

  function set<K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function markTouched(field: LeadField) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function errorFor(field: LeadField): string | undefined {
    return touched[field] ? errors[field] : undefined;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;

    onSubmit({
      name: draft.name.trim(),
      email: draft.email.trim(),
      company: draft.company.trim(),
      consent: draft.consent,
      stage: leadStage,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (!dialogRef.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${fieldId}-title`}
        className="w-full max-w-md rounded-lg border border-border bg-raised p-5 shadow-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={`${fieldId}-title`} className="text-[15px] font-semibold text-ink">
              Download the detailed report
            </h2>
            <p className="mt-1 text-2xs leading-4 text-faint">
              An A4 PDF: your inputs and their provenance, the roll-forward, the charts, the cap table and the
              compliance checklist. Your results on screen stay free.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded border border-border p-1 text-sub hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor={`${fieldId}-name`} className="mb-1 block text-2xs font-medium text-sub">
              Full name
            </label>
            <input
              id={`${fieldId}-name`}
              value={draft.name}
              autoComplete="name"
              aria-invalid={errorFor('name') !== undefined}
              aria-describedby={errorFor('name') ? `${fieldId}-name-error` : undefined}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => markTouched('name')}
              className={INPUT_CLASSES}
            />
            {errorFor('name') ? (
              <p id={`${fieldId}-name-error`} className="mt-1 text-2xs text-danger">
                {errorFor('name')}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={`${fieldId}-email`} className="mb-1 block text-2xs font-medium text-sub">
              Work email
            </label>
            <input
              id={`${fieldId}-email`}
              type="email"
              value={draft.email}
              autoComplete="email"
              aria-invalid={errorFor('email') !== undefined}
              aria-describedby={errorFor('email') ? `${fieldId}-email-error` : undefined}
              onChange={(e) => set('email', e.target.value)}
              onBlur={() => markTouched('email')}
              className={INPUT_CLASSES}
            />
            {errorFor('email') ? (
              <p id={`${fieldId}-email-error`} className="mt-1 text-2xs text-danger">
                {errorFor('email')}
              </p>
            ) : emailNotice ? (
              /* Gentle: a notice in the muted tone, never an error, never a block. */
              <p className="mt-1 text-2xs text-faint">{emailNotice}</p>
            ) : null}
          </div>

          <div>
            <label htmlFor={`${fieldId}-company`} className="mb-1 block text-2xs font-medium text-sub">
              Company name
            </label>
            <input
              id={`${fieldId}-company`}
              value={draft.company}
              autoComplete="organization"
              aria-invalid={errorFor('company') !== undefined}
              aria-describedby={errorFor('company') ? `${fieldId}-company-error` : undefined}
              onChange={(e) => set('company', e.target.value)}
              onBlur={() => markTouched('company')}
              className={INPUT_CLASSES}
            />
            {errorFor('company') ? (
              <p id={`${fieldId}-company-error`} className="mt-1 text-2xs text-danger">
                {errorFor('company')}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor={`${fieldId}-stage`} className="mb-1 block text-2xs font-medium text-sub">
              Stage
            </label>
            <SelectField
              id={`${fieldId}-stage`}
              value={leadStage}
              onChange={setLeadStage}
              options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
            />
            <p className="mt-1 text-2xs text-faint">Prefilled from your inputs.</p>
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={draft.consent}
              onChange={(e) => {
                set('consent', e.target.checked);
                markTouched('consent');
              }}
              className="mt-0.5 h-3.5 w-3.5 accent-accent"
            />
            <span className="text-2xs leading-4 text-sub">
              Incentiv can email me about this report and its products.
            </span>
          </label>
          {errorFor('consent') ? <p className="text-2xs text-danger">{errorFor('consent')}</p> : null}

          <button
            type="submit"
            disabled={!valid || busy}
            className="w-full rounded border border-accent bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Preparing the PDF…' : 'Download report'}
          </button>

          {!valid ? (
            <p className="text-2xs leading-4 text-faint">
              Fill in your name, a valid email and your company, and tick the box, to continue.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
