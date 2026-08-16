'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { copyText, toCsv } from '../lib/csv';

interface CopyCsvButtonProps {
  readonly headers: readonly string[];
  readonly rows: readonly (string | number)[][];
}

export function CopyCsvButton({ headers, rows }: CopyCsvButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const ok = await copyText(toCsv(headers, rows));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-2xs text-sub transition-colors duration-150 hover:text-ink"
    >
      {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy as CSV'}
    </button>
  );
}
