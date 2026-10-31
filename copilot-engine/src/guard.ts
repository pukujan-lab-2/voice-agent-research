// Rules the code decides itself, so the model never has to get them right.
const DIGITS: Record<string, string> = {
  zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9',
};

const NATO = 'alfa alpha bravo charlie delta echo foxtrot golf hotel india juliet juliett kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu'.split(' ');
const LETTER: Record<string, string> = Object.fromEntries(NATO.map(w => [w, w === 'xray' ? 'X' : w[0].toUpperCase()]));
// Letter names as speech recognisers write them ("ess", "double-u"). Only words that are rarely anything else in a serial.
const SPOKEN: Record<string, string> = {
  ay: 'A', bee: 'B', cee: 'C', see: 'C', sea: 'C', dee: 'D', ee: 'E', ef: 'F', eff: 'F', gee: 'G', aitch: 'H', haitch: 'H',
  jay: 'J', kay: 'K', el: 'L', ell: 'L', em: 'M', en: 'N', pee: 'P', cue: 'Q', queue: 'Q', ar: 'R', ess: 'S', es: 'S',
  tee: 'T', vee: 'V', doubleu: 'W', doubleyou: 'W', ex: 'X', zed: 'Z', zee: 'Z',
};

// "It's one three three four, C, L as in Lima, S" -> "1334CLS". "LS 5734SSTD" -> "LS5734SSTD": spaces, dashes and
// letter groups the recogniser wrote in capitals are kept; "double five" -> "55".
export function spokenToSerial(text: string): string {
  let t = text.replace(/(\w)['’](s|re|m|ll|d|ve|t)\b/gi, '$1'); // "it's" must not become the letter S
  t = t.replace(/\b([a-z])\s+as\s+in\s+\w+/gi, '$1').replace(/\bdouble[\s-]+(u|you)\b/gi, 'doubleu');
  const one = (tok: string): string => {
    const w = tok.toLowerCase();
    if (w in DIGITS) return DIGITS[w];
    if (w in LETTER) return LETTER[w];
    if (w in SPOKEN) return SPOKEN[w];
    if (/^\d+$/.test(tok)) return tok;
    if (tok.length === 1 && /[a-z]/i.test(tok)) return tok.toUpperCase();
    // Mixed groups ("5734SSTD") and capital letter groups ("LS", "SSTD") are read out characters, not words.
    if (/^[A-Za-z0-9]{2,}$/.test(tok) && /\d/.test(tok) && /[A-Za-z]/.test(tok)) return tok.toUpperCase();
    if (/^[A-Z]{2,6}$/.test(tok) && !/^(OK|TV|USA|UK)$/.test(tok)) return tok;
    return '';
  };
  const out: string[] = [];
  const toks = t.match(/[A-Za-z0-9]+/g) ?? [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i].toLowerCase();
    if ((w === 'double' || w === 'triple') && i + 1 < toks.length) {
      const c = one(toks[i + 1]);
      if (c.length === 1) { out.push(c.repeat(w === 'double' ? 2 : 3)); i++; continue; }
    }
    out.push(one(toks[i]));
  }
  return out.join('');
}

// Spoken numbers inside a code: "C P two thousand" -> "C P 2000", "five oh one" stays digit by digit,
// "twenty one" -> "21". Only what codes need; a serial is still read digit by digit.
const TENS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const UNIT: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
export function spokenNumbers(text: string): string {
  return text
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+thousand(?:\s+(?:and\s+)?(one|two|three|four|five|six|seven|eight|nine))?\b/gi,
      (_, a, b) => String(UNIT[a.toLowerCase()] * 1000 + (b ? UNIT[b.toLowerCase()] : 0)))
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred(?:\s+(?:and\s+)?(one|two|three|four|five|six|seven|eight|nine))?\b/gi,
      (_, a, b) => String(UNIT[a.toLowerCase()] * 100 + (b ? UNIT[b.toLowerCase()] : 0)))
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/gi,
      (_, a, b) => String(TENS[a.toLowerCase()] + UNIT[b.toLowerCase()]))
    .replace(/\b(ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/gi,
      a => String(TENS[a.toLowerCase()]));
}

// A short code with letters and digits ("CP2000", "LTR 3172", "CP 14"), or '' when what was said isn't one.
export function spokenToCode(text: string): string {
  const v = spokenToSerial(spokenNumbers(text));
  return /^[A-Z0-9]{2,10}$/.test(v) && /\d/.test(v) && /[A-Z]/.test(v) ? v : '';
}

// "CP2000" -> "C, P, 2, 0, 0, 0": how a code or a name is read back so every character can be checked.
export const spellOut = (v: string, sep = ', '): string => [...v.replace(/[^A-Za-z0-9]/g, '')].map(c => c.toUpperCase()).join(sep);

// Why a spoken serial is not a serial yet, in words a caller can act on; '' when it is valid or nothing was heard.
export function serialProblem(raw: string, example = '1334-592C-LSD3'): string {
  if (!raw || validSerial(raw)) return '';
  const n = raw.length;
  const what = n === 12 ? 'that has no digits' : `that's ${n} character${n === 1 ? '' : 's'}`;
  return `I heard ${formatSerial(raw)}, ${what}; the serial has 12, like ${example}. Read it in groups of four.`;
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

// "priya dot raman at gmail dot com" -> "priya.raman@gmail.com". Returns '' when it is not a plausible email.
export function spokenToEmail(text: string): string {
  let t = text.trim().toLowerCase().replace(/[’]/g, "'").replace(/[.!]+$/, '');
  t = t.replace(/^(?:(?:um|uh|so|well|sure|okay|ok)[,\s]+)*(?:(?:my |the )?e-?mail(?: address)?(?: is|'s)?|it(?:'s| is))\s+/, '');
  t = t.replace(/\s+(?:at|at sign)\s+/g, '@').replace(/\s+dot\s+/g, '.').replace(/\s*(?:underscore)\s*/g, '_').replace(/\s*(?:dash|hyphen)\s*/g, '-');
  t = t.replace(/\s+/g, '');
  return validEmail(t) ? t : '';
}
export const validEmail = (s: string): boolean => /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(s);

// "oh seven seven double one, two three four five six" -> "07711 23456" style digits; '' unless 7-15 digits.
export function spokenToPhone(text: string): string {
  const t = text.toLowerCase().replace(/\b(double|triple) (\w+)/g, (_m, n: string, d: string) => Array(n === 'double' ? 2 : 3).fill(d).join(' '));
  const out: string[] = [];
  const plus = /^\s*(\+|plus\b)/.test(t);
  for (const tok of t.match(/[a-z]+|\d+/g) ?? []) {
    if (tok in DIGITS) out.push(DIGITS[tok]);
    else if (/^\d+$/.test(tok)) out.push(tok);
  }
  const d = out.join('');
  return d.length >= 7 && d.length <= 15 ? (plus ? '+' : '') + d : '';
}
