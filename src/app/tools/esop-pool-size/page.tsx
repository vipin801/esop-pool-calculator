import type { Metadata } from 'next';
import { EsopPoolSizeClient } from './EsopPoolSizeClient';

export const metadata: Metadata = {
  title: 'How big should your ESOP pool be? | Incentiv',
  description: 'Size your ESOP pool against your hiring plan, not a rule of thumb. Free, ungated results for Indian startups.',
};

export default function EsopPoolSizePage() {
  return <EsopPoolSizeClient />;
}
