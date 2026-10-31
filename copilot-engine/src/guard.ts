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
  // a short letter prefix right before a number is the code's letters, however the recogniser cased it ("cp 14")
  const v = spokenToSerial(spokenNumbers(text).replace(/\b([a-z]{2,4})(?=\s*\d)|\b(cp|lt|ltr|ls)\b/gi, m => m.toUpperCase()));
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

const NAME_STOP = new Set(['what', 'where', 'when', 'why', 'how', 'who', 'can', 'could', 'would', 'do', 'does', 'is', 'are', 'was', 'the', 'a', 'an', 'my', 'your', 'it', 'that', 'this', 'please', 'thanks', 'thank', 'hello', 'yes', 'no', 'not', 'much', 'i', 'we', 'you', 'about', 'for', 'with', 'and', 'or', 'to', 'of', 'in', 'on', 'have', 'need', 'want', 'help', 'me', 'sorry', 'okay', 'ok', 'hmm', 'um', 'uh', 'maybe', 'sure', 'wait', "i'd", 'rather', 'prefer', 'say', "don't", "won't", 'nope', 'nah', 'skip', 'pass', 'yeah', 'yep', 'its']);

// "um, my name is Priya Rossi" -> "Priya Rossi". Returns '' when the text is not plausibly just a name.
export function parseName(said: string): string {
  let t = said.trim().replace(/[\u2019]/g, "'").replace(/[.!]+$/, '');
  // Declining to give a name is not a name ("I'd rather not say", "prefer not to").
  if (/\b(rather not|prefer not|don'?t want to|won'?t say|not telling|skip (it|this|that))\b/i.test(t)) return '';
  t = t.replace(/^(?:(?:um|uh|er|so|well|hi|hello|actually|sorry|yeah|yes|yep|ok|okay|sure|right)[,\s]+)+/i, '');
  t = t.replace(/^(?:(?:change|make|set) (?:my )?name (?:to|as)|my name(?:'s| is)|name(?:'s| is)|it(?:'s| is)|this is|i(?:'m| am)|call me|they call me|you can call me)\s+/i, '');
  t = t.replace(/^(?:actually|really|just|now)\s+/i, '');
  // spelled out: "D U C  N G U Y E N" -> "Duc Nguyen" (a long pause or a comma between words); "D U C, Duc Nguyen"
  // -> the spoken name, with the spelled word in place of the spoken one that starts with the same letter
  const word = (letters: string) => { const w = letters.replace(/[^A-Za-z]/g, '').toLowerCase(); return w[0].toUpperCase() + w.slice(1); };
  const spelledThenSaid = /^((?:[A-Za-z][\s.-]+)+[A-Za-z])\s*,\s*(.+)$/.exec(t);
  if (spelledThenSaid) {
    const sp = word(spelledThenSaid[1]);
    const rest = spelledThenSaid[2].split(/\s+/);
    const i = rest.findIndex(w => w[0]?.toLowerCase() === sp[0].toLowerCase());
    if (i >= 0) rest[i] = sp;
    t = rest.join(' ');
  } else if (/^[A-Za-z](?:[\s,.-]+[A-Za-z])+$/.test(t)) {
    t = t.split(/\s{2,}|\s*,\s*/).map(word).join(' ');
  }
  t = t.replace(/,?\s+not\s+.+$/i, '').replace(/\s+(?:here|speaking|calling)$/i, '').replace(/[,;]+$/, '').trim();
  const words = t.split(/\s+/);
  if (!t || t.includes('?') || /\d/.test(t) || words.length > 4) return '';
  if (words.some(w => NAME_STOP.has(w.toLowerCase().replace(/[^a-z']/g, '')))) return '';
  if (!words.every(w => /^[A-Za-z][A-Za-z'.-]*$/.test(w))) return '';
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

// ---- Dates and digit strings, for identity checks.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_ABBR: Record<string, number> = Object.fromEntries(MONTHS.flatMap((m, i) => [[m, i + 1], [m.slice(0, 3), i + 1], ...(m === 'september' ? [['sept', 9]] : [])]));
const ORDINAL: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };

// "March third, nineteen eighty five", "the 3rd of March 85", "3/3/1985", "1985-03-03", "oh three oh three eighty five"
// -> "1985-03-03"; '' when it isn't one real date between 1900 and today. Numbers without a month name are read the
// US way (month, day, year) unless the year comes first. With future (an appointment, a start date): a month and day
// without a year mean the next one ("November 16"), and the date must be today or later (within five years).
export function spokenToDate(text: string, now = new Date(), opts: { future?: boolean } = {}): string {
  let t = text.toLowerCase().replace(/[’']/g, '').replace(/,/g, ' ');
  t = t.replace(/\b(twenty|thirty)[\s-]+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)\b/g, (_, a, b) => String((a === 'twenty' ? 20 : 30) + ORDINAL[b]));
  t = t.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)\b/g, w => String(ORDINAL[w]));
  // spoken years: "nineteen oh five" -> 1905, "nineteen eighty five" -> 1985, "two thousand twelve" -> 2012
  t = t.replace(/\bnineteen\s+(?:oh|zero)\s+(one|two|three|four|five|six|seven|eight|nine)\b/g, (_, d) => `190${DIGITS[d]}`);
  t = spokenNumbers(t);
  t = t.replace(/\b(19|20)\s+(\d{2})\b/g, '$1$2').replace(/\b(2000)\s+(\d{1,2})\b/g, (_, _a, b) => String(2000 + +b));
  t = t.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');
  let month = 0;
  for (const w of t.match(/[a-z]+/g) ?? []) if (MONTH_ABBR[w] && !(w === 'may' && /\bmay (i|we|be)\b/.test(t))) { month = MONTH_ABBR[w]; break; }
  // digit words said one by one ("oh three oh three one nine eight five") become one run of digits
  const toks = (t.match(/[a-z]+|\d+/g) ?? []).map(w => (w in DIGITS ? DIGITS[w] : w)).filter(w => /^\d+$/.test(w));
  let nums = toks.map(Number);
  const run = toks.join('');
  if (toks.length > 3 && (/^\d{6}$|^\d{8}$/.test(run) || (month && run.length >= 5))) nums = splitRun(run, !!month);
  else if (toks.length === 1 && /^\d{6}$|^\d{8}$/.test(toks[0])) nums = splitRun(toks[0], !!month);
  else { const m = t.match(/\b(\d{1,4})[/.-](\d{1,2})[/.-](\d{1,4})\b/); if (m) nums = [+m[1], +m[2], +m[3]]; }
  let y = 0, mo = month, d = 0;
  const fullYear = (n: number) => n >= 100 ? n : n + (n > now.getFullYear() % 100 ? 1900 : 2000);
  if (month) {
    const rest = nums.filter(n => n > 0);
    const yi = rest.findIndex(n => n >= 1000);
    if (yi >= 0) { y = rest[yi]; d = rest.find((n, i) => i !== yi && n <= 31) ?? 0; }
    else if (rest.length >= 2) { d = rest[0]; y = opts.future && rest[1] < 100 ? 2000 + rest[1] : fullYear(rest[1]); }
    else if (opts.future && rest.length === 1 && rest[0] <= 31) {
      d = rest[0]; y = now.getFullYear();
      if (Date.UTC(y, month - 1, d) < Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) y++;
    }
  } else if (nums.length === 3) {
    if (nums[0] >= 1000) [y, mo, d] = nums;
    else [mo, d, y] = [nums[0], nums[1], fullYear(nums[2])];
  }
  if (!y || !mo || !d || mo > 12 || d > 31 || y < 1900) return '';
  const date = new Date(Date.UTC(y, mo - 1, d));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  if (date.getUTCDate() !== d) return '';
  if (opts.future ? date.getTime() < today || y > now.getFullYear() + 5 : date > now) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function splitRun(run: string, haveMonth: boolean): number[] {
  if (haveMonth) return run.length >= 5 ? [+run.slice(0, run.length - 4), +run.slice(-4)] : [];
  if (run.length === 8) return /^(19|20)/.test(run) ? [+run.slice(0, 4), +run.slice(4, 6), +run.slice(6)] : [+run.slice(0, 2), +run.slice(2, 4), +run.slice(4)];
  if (run.length === 6) return [+run.slice(0, 2), +run.slice(2, 4), +run.slice(4)];
  return [];
}
// "1985-03-03" -> "March 3, 1985"
export const formatDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !MONTHS[m - 1]) return iso;
  return `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} ${d}, ${y}`;
};

// All the digits said ("forty three twenty one", "4 3 2 1", "double four one two"), as one string.
export function spokenDigits(text: string): string {
  const t = spokenNumbers(text.toLowerCase().replace(/\b(double|triple) (\w+)/g, (_m, n: string, d: string) => Array(n === 'double' ? 2 : 3).fill(d).join(' ')));
  return (t.match(/[a-z]+|\d+/g) ?? []).map(w => (w in DIGITS ? DIGITS[w] : /^\d+$/.test(w) ? w : '')).join('');
}

// Masking for values marked secret: the engine puts them between these marks in what it says.
export const SECRET = ['⟦', '⟧'] as const;
export const secret = (v: string): string => `${SECRET[0]}${v}${SECRET[1]}`;
export const forSpeech = (text: string): string => text.replace(/[⟦⟧]/g, '');
export const forDisplay = (text: string): string => text.replace(/⟦[^⟧]*⟧/g, '••••');
// A last line of defence for log lines: anything shaped like an SSN, a date, or a run of 4+ digits after words that
// introduce one ("last four", "born", "birthday", "social") is masked.
export function maskPII(text: string): string {
  return forDisplay(text)
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '•••-••-••••')
    .replace(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/g, '••/••/••••')
    .replace(/\b((january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{2,4})\b/gi, '•• •• ••••')
    .replace(/\b(last (four|4)|ssn|social( security)?|born|birthday|date of birth|dob)\b([^.?!]{0,40}?)(\d(?:[\s,-]*\d){3,})/gi, (_m, a, _b, _c, mid) => `${a}${mid}••••`);
}
