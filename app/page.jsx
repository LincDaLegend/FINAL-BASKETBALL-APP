'use client';

import dynamic from 'next/dynamic';

// Load BusinessApp client-side only (uses localStorage)
const BusinessApp = dynamic(
  () => import('../src/components/business/App.jsx'),
  { ssr: false }
);

export default function Page() {
  return <BusinessApp />;
}
