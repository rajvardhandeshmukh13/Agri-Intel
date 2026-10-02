// lib/utils/demo-mode.ts
// Utilities for demo mode detection and banner display

/**
 * Returns true if the app is running in demo mode.
 * Demo mode uses local JSON files instead of live APIs.
 * Always activates if NEXT_PUBLIC_DEMO_MODE=true.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Server-side check for demo mode.
 * Use this in API route handlers.
 */
export function isServerDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

/**
 * Returns the demo banner text to display in the UI.
 * Returns null if not in demo mode.
 */
export function getDemoBannerText(lang: 'en' | 'mr' | 'hi' = 'en'): string | null {
  if (!isDemoMode()) return null;
  const messages: Record<string, string> = {
    en: 'Demo data — illustrative only. Not live market or government data.',
    mr: 'डेमो माहिती — केवळ उदाहरणासाठी. हे थेट बाजार किंवा सरकारी माहिती नाही.',
    hi: 'डेमो डेटा — केवल उदाहरण के लिए। यह लाइव बाज़ार या सरकारी डेटा नहीं है।',
  };
  return messages[lang] ?? messages['en'];
}

/**
 * Wraps a service call with a demo fallback.
 * If in demo mode or the live call fails, returns the demo value.
 * Logs the source for observability.
 */
export async function withDemoFallback<T>(
  liveFn: () => Promise<T>,
  demoFn: () => Promise<T>,
  label: string
): Promise<T> {
  if (isDemoMode()) {
    console.log(`[demo-mode] Using demo data for: ${label}`);
    return demoFn();
  }
  try {
    const result = await liveFn();
    return result;
  } catch (err) {
    console.warn(`[demo-fallback] Live call failed for "${label}", using demo data.`, err);
    return demoFn();
  }
}
