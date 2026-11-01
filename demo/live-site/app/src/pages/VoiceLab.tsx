import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { useCopilot, useCopilotMount } from "@/hooks/useCopilot";
import { COPILOT_CONFIGS } from "@/lib/copilot";

export default function VoiceLab() {
  useCopilotMount(COPILOT_CONFIGS.clinic);
  const { snapshot } = useCopilot();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-12 pb-48 text-slate-900">
      <a href="/" className="text-sm underline">Back to demos</a>
      <p className="mt-10 text-sm font-semibold uppercase tracking-widest text-orange-800">Voice lab</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Choose a voice and try a call</h1>
      <p className="mt-4 max-w-2xl text-slate-600">Pick a voice stack and language, then use the call panel to try the sample form. The models run on the configured voice backend.</p>
      <Card className="mt-8"><CardHeader><CardTitle>Models in each available setup</CardTitle></CardHeader><CardContent>
        <p className="mb-4 text-sm text-slate-600">Each setup is a tested combination. Choosing a listening or speaking model selects its matching setup; arbitrary combinations are not connected yet.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Listening model<select className="mt-2 block w-full rounded-md border bg-white p-3" value={snapshot.stack ?? ""} disabled={snapshot.open || !snapshot.voiceStacks?.length} onChange={e => window.copilot?.setStack?.(e.target.value)}>
            {(snapshot.voiceStacks ?? []).map(s => <option key={s.id} value={s.id}>{s.id === "english-fast" ? "Parakeet TDT v2" : "Whisper large-v3-turbo"}</option>)}
          </select></label>
          <label>Speaking model<select className="mt-2 block w-full rounded-md border bg-white p-3" value={snapshot.stack ?? ""} disabled={snapshot.open || !snapshot.voiceStacks?.length} onChange={e => window.copilot?.setStack?.(e.target.value)}>
            {(snapshot.voiceStacks ?? []).map(s => <option key={s.id} value={s.id}>{s.id === "english-fast" ? "Pocket TTS" : "Kokoro-82M"}</option>)}
          </select></label>
        </div>
        <p className="mt-4 text-sm">Response model: LFM3-1.7B on the configured server. Turn detection: {snapshot.stack === "multilingual" ? "LiveKit multilingual" : "LiveKit English"}.</p>
      </CardContent></Card>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {(snapshot.voiceStacks ?? []).map(stack => (
          <Card key={stack.id} className={snapshot.stack === stack.id ? "border-orange-600 ring-2 ring-orange-200" : ""}>
            <CardHeader><CardTitle>{stack.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-slate-600">Languages: {stack.languages.map(l => l.native).join(", ")}</p>
              <Button type="button" variant={snapshot.stack === stack.id ? "default" : "outline"} disabled={snapshot.open} onClick={() => window.copilot?.setStack?.(stack.id)}>
                {snapshot.stack === stack.id ? "Selected" : "Select voice"}
              </Button>
            </CardContent>
          </Card>
        ))}
        {["LFM3-Audio-2B", "LFM3-Omni-2B"].map(name => (
          <Card key={name}><CardHeader><CardTitle>{name}</CardTitle></CardHeader><CardContent>
            <p className="text-sm text-slate-600">Not connected yet. This model cannot be tested here until its voice adapter is ready.</p>
          </CardContent></Card>
        ))}
      </div>
      <Card className="mt-8"><CardHeader><CardTitle>More models to evaluate</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-slate-600">
        <p>Listening: Parakeet v3, Whisper large-v3, faster-whisper large-v3, Distil-Whisper, Canary, Voxtral, Kyutai STT and Granite Speech.</p>
        <p>Speaking: Chatterbox, VibeVoice, Kyutai TTS, Dia, CSM, NeuTTS, MeloTTS, Orpheus, IndexTTS, OmniVoice, F5-TTS, XTTS and Fish Speech.</p>
        <p>End to end: LFM3-Audio-2B and LFM3-Omni-2B. These candidates need an adapter before they can be selected for a call. Some candidates have restricted or non-commercial licenses.</p>
        <p>Previous tests compared LFM3-1.7B with Qwen-Flash for text replies. The voice stacks have functional call tests, but there is no comparable benchmark across all of these models yet.</p>
      </CardContent></Card>
      <Card className="mt-8"><CardHeader><CardTitle>Sample booking</CardTitle></CardHeader><CardContent>
        <p className="mb-5 text-sm text-slate-600">Use fictional details. The assistant leaves the final button for you.</p>
        <form data-copilot-form className="grid max-w-xl gap-3" onSubmit={e => e.preventDefault()}>
          <label htmlFor="lab-name">Full name</label><input className="rounded-md border p-3" id="lab-name" name="name" required />
          <label htmlFor="lab-email">Email</label><input className="rounded-md border p-3" id="lab-email" name="email" type="email" required />
          <Button type="submit" className="mt-3 w-fit">Finish sample</Button>
        </form>
      </CardContent></Card>
      <CopilotWidget />
    </main>
  );
}
