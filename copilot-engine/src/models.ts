import type { Flow, Model, Understanding } from './types.ts';

// Deterministic stand-in used by the scenario tests, so engine rules are tested without any model.
export class RuleModel implements Model {
  name = 'rules';
  async understand({ flow, field, said }: Parameters<Model['understand']>[0]): Promise<Understanding> {
    const t = said.trim();
    if (!t || /^(hmm+|uh+|um+)$/i.test(t)) return { action: 'ask_again' };
    if (/pizza|order me|weather|joke|lunch order/i.test(t)) return { action: 'off_scope' };
    const ch = t.match(/actually,?\s*(?:change )?(?:my )?(\w+)\s*(?:is|to)\s+(.+)$/i);
    if (ch) {
      const f = flow.fields.find(x => x.name === ch[1].toLowerCase());
      if (f) return { action: 'change', field: f.name, value: ch[2].trim() };
    }
    if (field.kind === 'choice') {
      if (/morning|before lunch|\bam\b/i.test(t)) return { action: 'fill', value: 'morning' };
      if (/afternoon|after lunch|\bpm\b/i.test(t)) return { action: 'fill', value: 'afternoon' };
      return { action: 'ask_again' };
    }
    return { action: 'fill', value: t };
  }
}

// A small local model behind an OpenAI-compatible server (llama.cpp). It only reads one answer into one action.
export class LlamaModel implements Model {
  name: string;
  private url: string;
  constructor(url = process.env.LLAMA_URL ?? 'http://127.0.0.1:11436', name = 'llama') {
    this.url = url;
    this.name = name;
  }

  private system(flow: Flow): string {
    const fields = flow.fields.map(f => `${f.name} (${f.kind}${f.options ? ': ' + f.options.join('|') : ''})`).join(', ');
    return `You are the understanding step of a website copilot for ${flow.business}.
Form fields: ${fields}.
Reply with ONE JSON object only: {"action": "...", "field": "...", "value": "..."}
- fill: the customer answered the current question; value is the cleaned-up answer. For a choice field, value must be one of its options.
- change: the customer corrects a DIFFERENT, earlier field; give that field and its new value.
- ask_again: the answer is missing or unclear.
- off_scope: the request is not about this ${flow.business} form.
Examples (current question: "What's the problem?"):
"it shows E24 and there's water" -> {"action":"fill","field":"problem","value":"shows E24 and there's water"}
"can you order me a pizza?" -> {"action":"off_scope"}
"what's the weather today" -> {"action":"off_scope"}
"hmm" -> {"action":"ask_again"}
"actually my name is Amira" -> {"action":"change","field":"name","value":"Amira"}`;
  }

  async understand({ flow, field, said, values }: Parameters<Model['understand']>[0]): Promise<Understanding> {
    const user = `Already collected: ${JSON.stringify(values)}\nCurrent question (field ${field.name}): ${field.question}\nCustomer said: ${said}`;
    try {
      const r = await fetch(`${this.url}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: this.system(flow) }, { role: 'user', content: user }],
          temperature: 0, max_tokens: 200,
          response_format: { type: 'json_object' },
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: AbortSignal.timeout(60000),
      });
      const text = (await r.json()).choices?.[0]?.message?.content ?? '';
      const o = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
      if (['fill', 'change', 'ask_again', 'off_scope'].includes(o.action)) return { action: o.action, field: o.field, value: typeof o.value === 'string' ? o.value : undefined };
    } catch { /* fall through: a model failure is only ever "ask again" */ }
    return { action: 'ask_again' };
  }
}
