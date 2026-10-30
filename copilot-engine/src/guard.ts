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
const NO = /\b(no|nope|nah|wait|not yet|stop|cancel|hold on|don'?t|wrong|incorrect|not (right|correct|quite|really)|isn'?t (right|correct)|that'?s not)\b/i;
const YES = /\b(yes|yeah|yep|go ahead|confirm|submit it|do it|go for it|absolutely|please do|sure|correct|that'?s right|right)\b/i;

// A hedge or a "no" always beats a "yes", and anything unclear is never a yes.
// A yes must be short and not a question: "sure, how much does it cost?" is not a confirmation.
export function yesNo(text: string): YesNo {
  if (HEDGE.test(text)) return 'unclear';
  if (NO.test(text)) return 'no';
  if (YES.test(text) && !text.includes('?') && text.trim().split(/\s+/).length <= 8) return 'yes';
  return 'unclear';
}

export const wantsChange = (text: string): boolean => /\b(change|fix|correct that|different)\b/i.test(text);

// Small talk, filler and silence are never answers. Code handles them so the model cannot turn "thanks" into a name.
const FILLER = /^\s*(hello|hi|hey|thanks|thank you|one (sec|second|moment)|just a (sec|second|moment)|hold on( a (sec|second))?|what|pardon|sorry|are you there|okay|ok|um+|uh+|er|hmm+|give me a (sec|second|moment)|let me think|can you repeat( that)?|come again|never ?mind)\W*$/i;
export function isFiller(text: string): boolean {
  const t = text.trim();
  return t === '' || FILLER.test(t) || (HEDGE.test(t) && t.split(/\s+/).length <= 4);
}

const NAME_STOP = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'can', 'could', 'would', 'do', 'does', 'is', 'are', 'was', 'the', 'a', 'an', 'my', 'your', 'it', 'that', 'this', 'please', 'thanks', 'thank', 'hello', 'yes', 'no', 'not', 'much', 'i', 'we', 'you', 'about', 'for', 'with', 'and', 'or', 'to', 'of', 'in', 'on', 'have', 'need', 'want', 'help', 'me', 'sorry', 'okay', 'ok', 'hmm', 'um', 'uh', 'maybe', 'sure', 'wait', "i'd", 'rather', 'prefer', 'say', "don't", "won't", 'nope', 'nah', 'skip', 'pass']);

// "um, my name is Priya Rossi" -> "Priya Rossi". Returns '' when the text is not plausibly just a name.
export function parseName(said: string): string {
  let t = said.trim().replace(/[\u2019]/g, "'").replace(/[.!]+$/, '');
  // Declining to give a name is not a name ("I'd rather not say", "prefer not to").
  if (/\b(rather not|prefer not|don'?t want to|won'?t say|not telling|skip (it|this|that))\b/i.test(t)) return '';
  t = t.replace(/^(?:(?:um|uh|er|so|well|hi|hello|actually|sorry)[,\s]+)+/i, '');
  t = t.replace(/^(?:(?:change|make|set) (?:my )?name (?:to|as)|my name(?:'s| is)|name(?:'s| is)|it(?:'s| is)|this is|i(?:'m| am)|call me|they call me|you can call me)\s+/i, '');
  t = t.replace(/^(?:actually|really|just|now)\s+/i, '');
  t = t.replace(/,?\s+not\s+.+$/i, '').replace(/\s+(?:here|speaking|calling)$/i, '').replace(/[,;]+$/, '').trim();
  const words = t.split(/\s+/);
  if (!t || t.includes('?') || /\d/.test(t) || words.length > 4) return '';
  if (words.some(w => NAME_STOP.has(w.toLowerCase().replace(/[^a-z']/g, '')))) return '';
  if (!words.every(w => /^[A-Za-z][A-Za-z'.\-]*$/.test(w))) return '';
  return t;
}

// Does every word of the model's cleaned-up value actually appear in what the customer said?
export function grounded(value: string, said: string): boolean {
  const tok = (x: string) => x.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const have = new Set(tok(said));
  return tok(value).length > 0 && tok(value).every(w => have.has(w));
}

export const stripFiller = (t: string): string => t.trim().replace(/^(?:(?:um|uh|er|so|well|basically|like)[,\s]+)+/i, '').trim();
