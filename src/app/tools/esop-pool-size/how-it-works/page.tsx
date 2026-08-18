import type { Metadata } from 'next';
import { HowItWorksClient } from './HowItWorksClient';

export const metadata: Metadata = {
  title: 'How this works | ESOP Pool Sizing | Incentiv',
  description: 'How the ESOP pool sizing tool works: how it solves for a pool, tracks grants, and what it never assumes.',
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
