const ONBOARDING_KEY = 'conveyrx.onboarding.v1';
const ONBOARDING_VERSION = 1;

interface OnboardingPayload {
  version: number;
  seenIds: string[];
}

export function loadSeenIds(): Set<string> {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return new Set();
    const payload = JSON.parse(raw) as OnboardingPayload;
    return payload.version === ONBOARDING_VERSION ? new Set(payload.seenIds) : new Set();
  } catch {
    return new Set();
  }
}

export function saveSeenIds(seen: ReadonlySet<string>): void {
  try {
    const payload: OnboardingPayload = { version: ONBOARDING_VERSION, seenIds: [...seen] };
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(payload));
  } catch {
    /* empty */
  }
}

export function clearSeenIds(): void {
  try {
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    /* empty */
  }
}
