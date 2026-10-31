// Masks SSNs, dates of birth and emails before text leaves for the traces (browser and server both use it).
const SSN = /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const DOB = /\b(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)?\d{2}|(?:19|20)\d{2}-\d{1,2}-\d{1,2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?,? (?:19|20)\d{2})\b/gi;
export const mask = (s: string) => s.replace(EMAIL, '[email]').replace(DOB, '[dob]').replace(SSN, '[ssn]');
