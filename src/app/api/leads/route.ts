/**
 * The lead endpoint.
 *
 * D3: the results are never gated. This is the report download alone, and it
 * is deliberately not a gate on the answer — the founder already has every
 * number on screen before this route is ever called.
 *
 * The client posts here and then generates the PDF locally whatever this
 * returns, so an outage here costs a lead record and never a report.
 */

import { NextResponse } from 'next/server';
import { emailDomain, validateLead, type LeadDraft } from '@/app/tools/esop-pool-size/lib/leadValidation';
import { STAGES, type Stage } from '@/lib/esop';

interface LeadPayload extends LeadDraft {
  readonly stage: Stage;
}

/**
 * Nothing on this route is authenticated, so every string is bounded before it
 * is validated, echoed or logged. These are generous against a real name or
 * company and mean a megabyte of text cannot be posted into a log line.
 */
const MAX_FIELD_LENGTH = 200;

function parseLead(body: unknown): LeadPayload | null {
  if (typeof body !== 'object' || body === null) return null;

  const record = body as Record<string, unknown>;
  const { name, email, company, consent, stage } = record;

  if (typeof name !== 'string' || typeof email !== 'string' || typeof company !== 'string') return null;
  if (typeof consent !== 'boolean') return null;
  if (typeof stage !== 'string' || !STAGES.includes(stage as Stage)) return null;
  if (name.length > MAX_FIELD_LENGTH || email.length > MAX_FIELD_LENGTH || company.length > MAX_FIELD_LENGTH) {
    return null;
  }

  return { name, email, company, consent, stage: stage as Stage };
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a JSON body.' }, { status: 400 });
  }

  const lead = parseLead(body);
  if (lead === null) {
    return NextResponse.json({ ok: false, error: 'Send a name, email, company, consent and stage.' }, { status: 400 });
  }

  /** Validated again here: a client-side check is a convenience, not a control. */
  const errors = validateLead(lead);
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, errors }, { status: 422 });
  }

  /**
   * Not persisted. There is no store wired to this project yet, so the record
   * goes to the server log and the route exists so the client has one place to
   * post to when there is one. Logged with the email domain rather than the
   * address, because a server log is the wrong home for a mailbox.
   */
  console.info('[lead]', {
    company: lead.company.trim(),
    stage: lead.stage,
    emailDomain: emailDomain(lead.email),
    consent: lead.consent,
  });

  return NextResponse.json({ ok: true });
}
