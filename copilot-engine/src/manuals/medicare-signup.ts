// Steps drafted by a free open model from Medicare & You 2027, pages 15-19 (US government work, public domain),
// checked against their pages by tools/draft_steps.py. Passages live in Octo RAG under "manual:medicare-signup".
import fs from 'node:fs';
import type { Manual } from '../guide.ts';

const draft = JSON.parse(fs.readFileSync(new URL('../../manuals/medicare-signup.steps.json', import.meta.url), 'utf8'));

export const medicareSignup: Manual = {
  id: 'medicare-signup',
  title: 'Signing up for Medicare Part A and Part B',
  business: 'Medicare & You 2027',
  steps: draft.steps.map((s: { n: number; text: string; page: number }) => ({ n: s.n, text: s.text, page: s.page })),
  passages: [],
};
export const medicareReviewed: boolean = draft.reviewed;
