import { getRandomExamples } from './consultExamples';

function birthDateYearsAgo(years: number): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  return date.toISOString().slice(0, 10);
}

describe('consultExamples', () => {
  it('provides 50 Korean examples for each age and gender bucket', () => {
    const cases = [
      birthDateYearsAgo(1),
      birthDateYearsAgo(4),
      birthDateYearsAgo(8),
      birthDateYearsAgo(12),
    ];

    for (const birthDate of cases) {
      for (const gender of ['male', 'female']) {
        const examples = getRandomExamples(birthDate, gender, 50, 'ko');
        expect(examples).toHaveLength(50);
        expect(new Set(examples.map((example) => example.label)).size).toBe(50);
      }
    }
  });

  it('keeps the default chip count small', () => {
    expect(getRandomExamples(birthDateYearsAgo(4), 'female', undefined, 'ko')).toHaveLength(5);
  });
});
