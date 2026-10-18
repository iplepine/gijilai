import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentAgeNotice } from './AssessmentAgeNotice';

function render(birthDate: string) {
    return renderToStaticMarkup(createElement(AssessmentAgeNotice, { birthDate }));
}

function birthDateYearsAgo(years: number) {
    const date = new Date();
    return `${date.getFullYear() - years}-01-01`;
}

describe('AssessmentAgeNotice', () => {
    it('renders nothing for an empty or in-range birth date', () => {
        expect(render('')).toBe('');
        expect(render(birthDateYearsAgo(5))).toBe('');
    });

    it('shows the matching guidance for children outside ages 3–7', () => {
        expect(render(birthDateYearsAgo(1))).toContain('ageNotice.tooYoung');
        const older = render(birthDateYearsAgo(10));
        expect(older).toContain('ageNotice.title');
        expect(older).toContain('ageNotice.tooOld');
    });
});
