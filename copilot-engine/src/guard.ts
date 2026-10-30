// Rules the code decides itself, so the model never has to get them right.
const DIGITS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

const NATO = 'alfa alpha bravo charlie delta echo foxtrot golf hotel india juliet juliett kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu'.split(' ');
const LETTER: Record<string, string> = Object.fromEntries(NATO.map(w => [w, w === 'xray' ? 'X' : w[0].toUpperCase()]));

// "It's one three three four, C, L as in Lima, S" -> "1334CLS"
export function spokenToSerial(text: string): string {
  let t = text.replace(/(\w)['’](s|re|m|ll|d|ve|t)\b/gi, '$1'); // "it's" must not become the letter S
  t = t.replace(/\b([a-z])\s+as\s+in\s+\w+/gi, '$1');
  const out: string[] = [];
  for (const tok of t.match(/[A-Za-z0-9]+/g) ?? []) {
    const w = tok.toLowerCase();
    if (w in DIGITS) out.push(DIGITS[w]);
    else if (w in LETTER) out.push(LETTER[w]);
    else if (/^\d+$/.test(tok)) out.push(tok);
    else if (tok.length === 1 && /[a-z]/i.test(tok)) out.push(tok.toUpperCase());
    else if (/^[A-Za-z0-9]{2,}$/.test(tok) && /\d/.test(tok) && /[A-Za-z]/.test(tok)) out.push(tok.toUpperCase());
  }
  return out.join('');
}

export const validSerial = (s: string): boolean => /^[A-Z0-9]{12}$/.test(s) && /\d/.test(s);
export const formatSerial = (s: string): string => s.match(/.{1,4}/g)?.join('-') ?? s;

export type YesNo = 'yes' | 'no' | 'unclear';
const HEDGE = /\b(maybe|not sure|unsure|i guess|depends|hmm+|um+|uh+|let me think)\b/i;
const NO = /\b(no|nope|wait|not yet|stop|cancel|hold on|don'?t)\b/i;
const YES = /\b(yes|yeah|yep|go ahead|confirm|submit it|do it|go for it|absolutely|please do|sure|correct|that'?s right|right)\b/i;

// A hedge or a "no" always beats a "yes", and anything unclear is never a yes.
export function yesNo(text: string): YesNo {
  if (HEDGE.test(text)) return 'unclear';
  if (NO.test(text)) return 'no';
  if (YES.test(text)) return 'yes';
  return 'unclear';
}

export const wantsChange = (text: string): boolean => /\b(change|fix|correct that|different)\b/i.test(text);
