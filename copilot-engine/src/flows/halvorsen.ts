import type { Flow } from '../types.ts';

export const halvorsen: Flow = {
  id: 'halvorsen-warranty',
  business: 'Halvorsen Home',
  intro: "Hi, I'm the Halvorsen Home copilot. I can help you start a warranty claim.",
  scope: 'I can only help with Halvorsen Home warranty claims here.',
  doneMessage: "Your claim is submitted. You'll get a confirmation by email.",
  fields: [
    { name: 'name', label: 'name', question: "What's your name?", kind: 'name' },
    {
      name: 'serial', label: 'serial number', kind: 'serial', aliases: ['serial'],
      question: "What's the serial number on the inside of the door? Say the digits and letters slowly.",
      hint: 'It has 12 digits and letters.',
    },
    { name: 'problem', label: 'problem', question: "What's the problem?", kind: 'text', aliases: ['issue', 'error'] },
    {
      name: 'visit_time', label: 'visit time', kind: 'choice', options: ['morning', 'afternoon'],
      synonyms: { morning: ['before lunch', 'early', 'a.m.', 'am'], afternoon: ['after lunch', 'later', 'p.m.', 'pm'] }, aliases: ['time', 'visit'],
      question: 'Would you like a visit in the morning or the afternoon?',
    },
  ],
};
