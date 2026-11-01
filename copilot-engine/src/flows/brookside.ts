import type { Flow } from '../types.ts';
import type { Passage } from '../guide.ts';

// Pediatric clinic booking (fictional Brookside Pediatrics, as in the demo video).
export const brookside: Flow = {
  id: 'brookside-booking',
  business: 'Brookside Pediatrics',
  intro: "Hi, thanks for calling Brookside Pediatrics. I can help you book a visit for your child.",
  scope: 'I can only help with booking a visit at Brookside Pediatrics here.',
  doneMessage: 'Your request is ready.',
  fields: [
    { name: 'child_name', label: "child's full name", kind: 'name', question: "What's your child's full name?", aliases: ['child', 'kid', 'son', 'daughter', 'patient'] },
    {
      name: 'visit_type', label: 'visit type', kind: 'choice', options: ['Well-child checkup', 'Sick visit', 'Vaccination'],
      synonyms: {
        'Well-child checkup': ['checkup', 'check-up', 'check up', 'physical', 'annual', 'well child', 'well visit', 'routine'],
        'Sick visit': ['sick', 'ill', 'fever', 'cough', 'ear infection', 'not feeling well', 'rash'],
        Vaccination: ['vaccine', 'shot', 'shots', 'jab', 'immunization', 'flu shot', 'booster'],
      },
      question: 'Is this a well-child checkup, a sick visit, or a vaccination?', aliases: ['visit', 'appointment type', 'reason'],
    },
    {
      name: 'preferred_day', label: 'preferred day', kind: 'choice', options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      synonyms: { Monday: ['mon'], Tuesday: ['tue', 'tues'], Wednesday: ['wed'], Thursday: ['thu', 'thurs'], Friday: ['fri'], Saturday: ['sat'] },
      question: 'Which day works best for you?', aliases: ['day', 'date'], hint: 'We are open Monday to Friday, and Saturday mornings.',
    },
    {
      name: 'preferred_time', label: 'preferred time', kind: 'choice', options: ['Morning', 'Afternoon'],
      synonyms: { Morning: ['am', 'a.m.', 'before lunch', 'early'], Afternoon: ['pm', 'p.m.', 'after lunch', 'later in the day'] },
      question: 'Would morning or afternoon be better?', aliases: ['time'],
    },
    { name: 'parent_name', label: "parent's name", kind: 'name', question: 'And your name, as the parent or guardian?', aliases: ['parent', 'guardian', 'your name', 'my name'] },
    { name: 'phone', label: 'phone number', kind: 'phone', question: "What's the best phone number to reach you?", aliases: ['phone', 'number', 'cell', 'mobile'] },
    { name: 'email', label: 'email address', kind: 'email', question: "And what's your email address?", aliases: ['email', 'e-mail'] },
  ],
};

// The clinic's own front-desk notes: the only source for answers to side questions.
export const brooksideDocs: Passage[] = [
  { id: 'hours', text: 'Brookside Pediatrics is open Monday to Friday from 8 am to 6 pm, and Saturday from 9 am to 12 noon. We are closed on Sundays and public holidays.' },
  { id: 'address', text: 'The clinic is at 214 Brookside Avenue, second floor, above the pharmacy. Free parking is available behind the building.' },
  { id: 'bring', text: "Please bring your child's insurance card, their vaccination record, and a list of any medicines they take. Arrive 10 minutes early for the first visit." },
  { id: 'insurance', text: 'We accept most major insurance plans, including Medicaid and CHIP. Self-pay well-child visits cost $120; a sick visit costs $95.' },
  { id: 'cancel', text: 'To cancel or move an appointment, call us at least 24 hours ahead. Late cancellations may be charged a $25 fee.' },
  { id: 'vaccines', text: 'We give all routine childhood vaccines and the yearly flu vaccine. COVID-19 vaccines are available for children 6 months and older.' },
  { id: 'sameday', text: 'Sick visits are usually seen the same day or the next day. If your child has trouble breathing, call 911 or go to the nearest emergency room.' },
  { id: 'newpatients', text: 'Yes, we are accepting new patients from newborns up to age 18.' },
  { id: 'length', text: 'A well-child checkup takes about 30 minutes; a sick visit or a vaccination usually takes 15 to 20 minutes.' },
];
