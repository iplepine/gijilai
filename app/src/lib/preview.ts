export const PREVIEW_SCENARIOS = ['transition', 'separation', 'tantrum'] as const;
export type PreviewScenario = typeof PREVIEW_SCENARIOS[number];

export function getPreviewScenario(value: unknown): PreviewScenario {
  return PREVIEW_SCENARIOS.find((scenario) => scenario === value) ?? 'transition';
}

export function getPreviewPath(scenario: PreviewScenario) {
  return `/preview?${new URLSearchParams({ scenario: getPreviewScenario(scenario) })}`;
}

// New visitors must enter child details and consent before the quick assessment.
export const QUICK_ASSESSMENT_HREF = `/login?${new URLSearchParams({ redirect: '/intake' })}`;
