// Shared by the scale tests and the scale report: a synthetic form of any size, and a scripted model that fills it
// from what the state note shows, recording how big every prompt was.
import { Desk, type ChatModel, type ChatMsg, type ToolCall } from '../src/desk.ts';
import type { Field, Flow } from '../src/types.ts';

const WORDS = ['amber', 'basil', 'cedar', 'delta', 'ember', 'fjord', 'garnet', 'harbor', 'indigo', 'juniper', 'kestrel', 'lagoon'];

// n fields; every fourth is a choice with 40 options, the rest are free text. Labels are unique ("Cedar 2 note").
export function bigFlow(n: number): Flow {
  const fields: Field[] = Array.from({ length: n }, (_, i) => {
    const label = `${WORDS[i % WORDS.length]} ${i} note`;
    const base = { name: `f${i}`, label, question: `What is the ${label}?` };
    return i % 4 === 3
      ? { ...base, kind: 'choice' as const, options: Array.from({ length: 40 }, (_, k) => `option${k}x${i}`), risk: 40 }
      : { ...base, kind: 'text' as const, hint: 'A short free-text answer. '.repeat(3) };
  });
  return { id: `big${n}`, business: 'Scale Test Co', intro: 'Hi there.', scope: 'this form', doneMessage: 'All done.', fields };
}

export const answerFor = (f: Field): string => (f.kind === 'choice' ? f.options![7] : `it is ${f.label.split(' ')[0]} ${f.name.slice(1)}`);

export type Recorder = ChatModel & { sizes: number[]; last: ChatMsg[]; tools: unknown[] };

// What the model is sent, in characters (the messages and the tool schema, as JSON).
export const promptChars = (messages: ChatMsg[], tools: unknown[]): number => JSON.stringify({ messages, tools }).length;

// A scripted model: it reads the open field from the state note, proposes what the caller just said for it, and
// confirms when the caller says yes. `pick` lets a test steer which field a turn is about.
export function scripted(flow: Flow, pick?: (said: string, note: string) => ToolCall[] | undefined): Recorder {
  const byName = new Map(flow.fields.map(f => [f.name, f]));
  const m: Recorder = {
    name: 'scripted', sizes: [], last: [], tools: [],
    async chat(messages, tools) {
      m.sizes.push(promptChars(messages, tools)); m.last = messages; m.tools = tools;
      const [said, note = ''] = String(messages[messages.length - 1].content).split('\n\n[Form state');
      const steered = pick?.(said, note);
      let calls: ToolCall[] = steered ?? [];
      if (!steered) {
        if (/^yes\b/i.test(said)) calls = [{ name: 'confirm_pending', args: {} }];
        else {
          const open = note.split('\n').find(l => l.includes('<- asking now'))?.match(/^(?:- )?(\w+):/)?.[1];
          const f = open ? byName.get(open) : undefined;
          if (f && /^it is |^option/.test(said)) calls = [{ name: 'propose_value', args: { field: f.name, value: f.kind === 'choice' ? said : said.replace(/^it is /, '') } }];
        }
      }
      return { content: '', calls, ms: 1, model: 'scripted' };
    },
  };
  return m;
}

// Fills the whole form: the caller answers each open field, then says yes. Returns the desk and the model's record.
export async function fillAll(flow: Flow, opts: { fullFormFields?: number } = {}): Promise<{ desk: Desk; model: Recorder }> {
  const model = scripted(flow);
  const desk = new Desk(flow, { model, ...opts });
  desk.start();
  let guard = flow.fields.length * 4;
  while (!desk.allFilled() && guard-- > 0) {
    const f = desk.field(desk.current)!;
    await desk.turn(answerFor(f));
    if (desk.pending) await desk.turn('yes');
  }
  return { desk, model };
}
