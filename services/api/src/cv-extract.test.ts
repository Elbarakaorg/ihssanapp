import { describe, expect, it } from 'vitest';

import { createOpenAiCvExtractor, normalizeExtraction } from './cv-extract.js';

describe('normalizeExtraction', () => {
  it('keeps valid data and drops invalid entries', () => {
    const result = normalizeExtraction({
      headline: ' Cardiologist ', bio: null, specialties: ['Cardiology', 'Cardiology', 'x'.repeat(80)], languages: ['FR', 'klingon', 'ar'],
      years_experience: '12',
      experience: [
        { kind: 'work', title: 'Cardiologist', organization: 'CHU', start_year: 2015, end_year: null },
        { kind: 'work', title: 'Bad dates', organization: 'CHU', start_year: 2015, end_year: 2010 },
        { kind: 'hobby', title: 'Chess', organization: 'Club', start_year: 2000 },
      ],
    });
    expect(result.headline).toBe('Cardiologist');
    expect(result.languages).toEqual(['fr', 'ar']);
    expect(result.years_experience).toBe(12);
    expect(result.experience).toHaveLength(1);
  });
});

describe('createOpenAiCvExtractor', () => {
  it('is disabled without a key', () => expect(createOpenAiCvExtractor({})).toBeNull());

  it('reads the model output and reports provider failures', async () => {
    const ok = createOpenAiCvExtractor({ apiKey: 'k', fetchImpl: async () => new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: '{"headline":"GP","experience":[]}' }] }] })) });
    expect((await ok!('JVBERi0')).headline).toBe('GP');
    const down = createOpenAiCvExtractor({ apiKey: 'k', fetchImpl: async () => new Response('x', { status: 500 }) });
    await expect(down!('JVBERi0')).rejects.toMatchObject({ status: 502 });
    const busy = createOpenAiCvExtractor({ apiKey: 'k', fetchImpl: async () => new Response('x', { status: 429 }) });
    await expect(busy!('JVBERi0')).rejects.toMatchObject({ status: 429 });
  });
});
