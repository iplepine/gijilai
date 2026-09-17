import { getPreviewPath, getPreviewScenario, QUICK_ASSESSMENT_HREF } from './preview';

describe('public parenting preview links', () => {
  it.each([null, undefined, '', 'unknown', ['tantrum'], '__proto__', 'https://example.com'])('defaults invalid scenario %p without reflecting input', (input) => {
    expect(getPreviewScenario(input)).toBe('transition');
  });

  it.each(['transition', 'separation', 'tantrum'] as const)('round trips the fixed scenario %s', (scenario) => {
    const url = new URL(getPreviewPath(scenario), 'https://gijilai.com');
    expect(url.pathname).toBe('/preview');
    expect(getPreviewScenario(url.searchParams.get('scenario'))).toBe(scenario);
    expect([...url.searchParams.keys()]).toEqual(['scenario']);
  });

  it('requires child intake before starting the assessment after authentication', () => {
    const url = new URL(QUICK_ASSESSMENT_HREF, 'https://gijilai.com');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toBe('/intake');
  });
});
