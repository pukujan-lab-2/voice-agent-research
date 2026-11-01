// Shared by the Node server and browser: a language must fit an allowed voice stack.
export type StackChoice = { id: string; languages: { code: string }[] };

export function stackForLanguage(stacks: StackChoice[], current: string, language: string): string {
  const supports = (s: StackChoice) => language ? s.languages.some(l => l.code === language) : s.languages.length > 1;
  return stacks.find(s => s.id === current && supports(s))?.id ?? stacks.find(supports)?.id ?? current;
}
