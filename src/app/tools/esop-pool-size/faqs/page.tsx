import type { Metadata } from 'next';
import { FaqsClient } from './FaqsClient';

export const metadata: Metadata = {
  title: 'FAQs | ESOP Pool Sizing | Incentiv',
  description: 'Answers to the questions Indian founders ask most about ESOP pool sizing, grants, strike price and compliance.',
};

export default function FaqsPage() {
  return <FaqsClient />;
}
