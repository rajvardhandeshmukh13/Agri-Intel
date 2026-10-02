// app/(dashboard)/page.tsx
// Root route (/) — Always lands on the Landing Page upon refresh or visiting the site.
// Features a complete, ordered sequence of farmer action buttons and guided workflow.

'use client';

import { LandingPage } from '@/components/landing/LandingPage';

export default function RootLandingPage() {
  return <LandingPage />;
}
