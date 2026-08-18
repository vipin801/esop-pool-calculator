/**
 * Which of the three onboarding screens (design.md §4) a required dot-path
 * belongs to, and whether that screen's own required fields have all been
 * touched. D10: tiering itself never depends on the screen — `lib/visibility.ts`
 * is untouched — this only groups the *existing* required paths for the
 * purpose of gating "Continue", the same way `lib/completeness.ts` already
 * gates the single result on the same set.
 */
export type OnboardingScreen = 0 | 1 | 2;

export function screenForPath(path: string): OnboardingScreen {
  if (path.startsWith('hiring.')) return 1;
  if (
    path === 'company.postMoneyValuation' ||
    path === 'growth.valuationGrowthPctPerYear' ||
    path.startsWith('grantPolicy.strikePolicy') ||
    path === 'grantPolicy.fairValue.theta'
  ) {
    return 2;
  }
  return 0;
}

export function requiredPathsForScreen(screen: OnboardingScreen, required: readonly string[]): string[] {
  return required.filter((path) => screenForPath(path) === screen);
}

export function isScreenComplete(screen: OnboardingScreen, required: readonly string[], touched: ReadonlySet<string>): boolean {
  return requiredPathsForScreen(screen, required).every((path) => touched.has(path));
}
