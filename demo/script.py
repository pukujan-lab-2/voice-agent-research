"""Builds the demo video's timeline and audio.

Five people, five websites, before and after a copilot. Each scene is a list of steps: `say` lines are
voiced with ElevenLabs (cached in build/tts/) and their length sets the pace; `act` steps are page
actions with a fixed duration; `clip` steps play a Grok Imagine clip from clips/.

Output: build/timeline.json (read by site/index.html), build/audio.wav, build/clips/*.webm.
"""

import hashlib, json, os, pathlib, subprocess, urllib.request
import numpy as np
import soundfile as sf
import imageio_ffmpeg

ROOT = pathlib.Path(__file__).resolve().parent
BUILD = ROOT / "build"
CLIPS = ROOT / "clips"
SR = 24000
GAP = 0.3
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# ElevenLabs premade voices
VOICES = {
    "copilot": "EXAVITQu4vr4xnSDxMaL",  # Sarah
    "narrator": "JBFqnCBsd6RMkjVDRZzb",  # George
    "aisha": "cgSgspJ2msm6clMCkdW9",  # Jessica
    "marcus": "iP95p4xoKVk53GoZ742B",  # Chris
    "daniel": "TX3LPaxmHKxFdv7VOQHJ",  # Liam
    "sofia": "FGY2WhTYpPnrIDTdsKH5",  # Laura
    "harold": "pqHfZKP75CvOlQylNhV4",  # Bill
}
NAMES = {"aisha": "Aisha", "marcus": "Marcus", "daniel": "Daniel", "sofia": "Sofia", "harold": "Harold", "copilot": "Copilot"}


def say(who, text, show=None, sub=None, thought=False, speed=1.0, after=GAP):
    return ("say", dict(who=who, text=text, show=show, sub=sub, thought=thought, speed=speed), after)


def think(who, text, **kw):
    return say(who, text, thought=True, **kw)


def act(do, dur=0.0, **args):
    return ("act", do, args, dur)


def clip(name, gain=0.35, dur=6.0, **args):
    return ("clip", name, dict(gain=gain, **args), dur)


def persona(key, title, task):
    return act("persona", 0, key=key, name=NAMES[key], title=title, task=task)


SCENES = [
    # ---------- Intro ----------
    act("scene", 0.3, name="title", title="Is your website hard to use?", sub="A voice copilot you add to the website you already have."),
    say("narrator", "If you run a business, you know this problem. People land on your website, hit a long form, and give up. Or they call, and tie up your staff.", after=0.7),

    # ---------- The business: problem, fix, data stays in house ----------
    act("scene", 0.3, name="biz", kind="owner"),
    say("narrator", "Customers get stuck. Your team answers the same questions all day. And details like serial numbers get mistyped.", after=1.0),
    act("scene", 0.3, name="biz", kind="install"),
    say("narrator", "The fix is a copilot that you add to the website you already have. One line of code. It doesn't replace your site. It sits on top of it.", after=1.0),
    act("scene", 0.3, name="biz", kind="inhouse"),
    say("narrator", "It only knows your site, and it only uses actions you allow. Your customers' details stay in house. Here's what your customers get.", after=1.0),

    # ---------- 1. Aisha ----------
    persona("aisha", "Aisha", "Brookside Pediatrics customer · booking a checkup"),
    clip("mom_before", lower="Aisha · booking Leo's checkup · one hand free"),
    act("scene", 0.6, name="app", site="peds", mode="before"),
    act("clock", 0, start=0, rate=15),
    act("click", 0.9, sel="#peds-book"),
    act("view", 0.3, sel="#peds-form"),
    act("click", 0.8, sel="#peds-slot-thu"),
    act("formErrors", 0.2, errors={"#peds-slot-thu": "Slot no longer available"}),
    act("speedup", 0, on=True),
    act("type", 0.9, sel="#peds-member", text="BKX44120"),
    act("click", 0.6, sel="#peds-submit"),
    act("formErrors", 0.2, errors={"#peds-slot-thu": "Slot no longer available", "#peds-member": "Member ID must be 11 characters"}),
    act("speedup", 0, on=False),
    act("mood", 0, emoji="😩"),
    think("aisha", "Leo, sweetie, one second. Why is this so hard?", after=0.4),
    act("clock", 0, rate=0),

    act("scene", 0.6, name="app", site="peds", mode="after"),
    act("clock", 0, start=0, rate=1),
    act("scope", 0, site="brooksidepeds.com", can=["Find times", "Book visits", "Use your saved details", "Text reminders"]),
    act("copilot", 0.5, open=True),
    say("copilot", "Hi, I'm the Brookside assistant. What can I help with today?"),
    say("aisha", "I need a checkup for my son."),
    act("view", 0.2, sel="#peds-form"),
    act("highlight", 0.2, sel="#peds-child"),
    say("copilot", "Happy to help. What's your son's name?"),
    say("aisha", "Leo. Leo Rahman."),
    act("fill", 0.3, sel="#peds-child", text="Leo Rahman · 3 yrs"),
    act("highlight", 0.2, sel="#peds-member"),
    act("fill", 0.3, sel="#peds-member", text="BKX-4412-093"),
    say("copilot", "Found him. I'll use the insurance on your account. Mornings or afternoons?"),
    say("aisha", "Mornings, if possible."),
    act("highlight", 0.2, sel="#peds-slot-tue"),
    say("copilot", "Tuesday at nine-forty with Doctor Patel is open. Should I book it, with a text reminder the day before?",
        show="Tuesday 9:40 AM with Dr. Patel is open. Should I book it, with a text reminder the day before?"),
    act("select", 0.2, sel="#peds-slot-tue", glow=True),
    act("confirm", 0.2, title="Ready to book", items=["Leo Rahman · well-child checkup", "Tue 9:40 AM · Dr. Patel", "Text reminder the day before"]),
    say("aisha", "Yes please."),
    act("confirm", 0, title=None),
    act("highlight", 0, sel=None),
    act("toast", 0.3, text="✓ Booked · Tue 9:40 AM · reminder set"),
    act("clock", 0, rate=0),
    clip("mom_after", dur=5.0, lower="Booked without putting Leo down"),
    say("copilot", "All set. I hope Leo has a good checkup!", after=0.2),

    # ---------- 2. Marcus ----------
    persona("marcus", "Marcus", "Halvorsen Home customer · dishwasher error"),
    clip("dad_before", lower="Marcus · dishwasher error E24 · wet hands"),
    act("scene", 0.6, name="app", site="appliance", mode="before"),
    act("clock", 0, start=0, rate=15),
    act("click", 0.8, sel="#ap-search"),
    act("type", 0.6, sel="#ap-search", text="E24"),
    act("view", 0.4, sel="#ap-results"),
    act("click", 0.9, sel="#ap-manual"),
    act("view", 0.3, sel="#ap-pdf"),
    act("speedup", 0, on=True),
    act("scrollPdf", 1.4, pages=37),
    act("speedup", 0, on=False),
    act("mood", 0, emoji="😤"),
    think("marcus", "Page thirty-seven. Wrong model. Of course.", after=0.4),
    act("clock", 0, rate=0),

    act("scene", 0.6, name="app", site="appliance", mode="after"),
    act("clock", 0, start=0, rate=1),
    act("scope", 0, site="halvorsenhome.com", can=["Look up your model", "Walk you through fixes", "Email steps", "Book a technician"]),
    act("copilot", 0.5, open=True),
    say("copilot", "Hi! What's going on with your appliance?"),
    say("marcus", "My dishwasher says E twenty-four and there's water at the bottom.", show="My dishwasher says E24 and there's water at the bottom."),
    say("copilot", "Ugh, standing water. Can you read me the serial number? It's on a sticker inside the door."),
    say("marcus", "One three three four five nine two, C, L, S, D, three.", show="1334592CLSD3"),
    act("spell", 0.2, text="1334-592C-ISD3"),
    say("copilot", "Let me read that back. One three three four. Five nine two C. I, S, D, three?",
        show="Let me read that back: 1334 · 592C · I-S-D-3?"),
    say("marcus", "No, L. L as in Lima."),
    act("spell", 0.2, text="1334-592C-LSD3"),
    say("copilot", "L as in Lima. One three three four, five nine two C, L S D three. That's an HDW-500, still under warranty.",
        show="L as in Lima: 1334-592C-LSD3. That's an HDW-500, still under warranty."),
    act("spell", 0, text=None),
    act("view", 0.2, sel="#ap-steps"),
    act("highlight", 0.2, sel="#ap-step-1"),
    say("copilot", "Thanks. That's usually the drain filter. Step one: twist out the round filter at the bottom and rinse it. I'll wait."),
    say("marcus", "Okay, it's out. Wow. That's gross."),
    act("highlight", 0.2, sel="#ap-step-2"),
    say("copilot", "That's the culprit! Step two: click it back in and run a quick drain. Want me to email you these steps?"),
    act("confirm", 0.2, title="Send by email", items=["3 steps + photos", "To: marcus@hallfamily.example"]),
    say("marcus", "Yeah, send it."),
    act("confirm", 0, title=None),
    act("highlight", 0, sel=None),
    act("toast", 0.3, text="✓ Steps sent to your email"),
    act("clock", 0, rate=0),
    clip("dad_after", dur=5.0, lower="Fixed in two minutes. No manual, no technician."),
    say("marcus", "Huh. It's draining. Nice.", after=0.4),

    # ---------- 3. Daniel ----------
    persona("daniel", "Daniel", "Cobalt IT Desk customer · VPN down"),
    clip("office_before", lower="Daniel · VPN down · client call at 2 PM"),
    act("scene", 0.6, name="app", site="itdesk", mode="before"),
    act("clock", 0, start=0, rate=15),
    act("click", 0.8, sel="#it-cat"),
    act("select", 0.3, sel="#it-cat", value="Software"),
    act("click", 0.7, sel="#it-sub"),
    act("select", 0.3, sel="#it-sub", value="Other"),
    act("speedup", 0, on=True),
    act("type", 1.0, sel="#it-desc", text="vpn not working"),
    act("click", 0.6, sel="#it-submit"),
    act("formErrors", 0.2, errors={"#it-asset": "Asset tag is required", "#it-impact": "Select impact", "#it-urg": "Select urgency"}),
    act("speedup", 0, on=False),
    act("mood", 0, emoji="😫"),
    think("daniel", "Asset tag? Impact versus urgency? I just need my VPN back.", after=0.4),
    act("clock", 0, rate=0),

    act("scene", 0.6, name="app", site="itdesk", mode="after"),
    act("clock", 0, start=0, rate=1),
    act("scope", 0, site="Cobalt IT Desk", can=["File tickets", "Check ticket status", "Suggest known fixes"]),
    act("copilot", 0.5, open=True),
    say("copilot", "Hi Daniel. What's going wrong?"),
    say("daniel", "My VPN won't connect since this morning."),
    act("fill", 0.2, sel="#it-cat", text="Network"),
    act("fill", 0.2, sel="#it-sub", text="VPN / remote access"),
    act("highlight", 0.2, sel="#it-asset"),
    say("copilot", "Okay, a VPN problem. Is it this laptop, the one ending in forty-four nineteen?", show="Okay, a VPN problem. Is it this laptop, CL-4419?"),
    say("daniel", "Yeah, this one."),
    act("fill", 0.2, sel="#it-asset", text="CL-4419 (this laptop)"),
    act("highlight", 0.2, sel="#it-impact,#it-urg"),
    say("copilot", "Got it. How urgent is it? Is anything blocked?"),
    say("daniel", "I have a client call at two."),
    act("fill", 0.2, sel="#it-impact", text="Single user"),
    act("fill", 0.2, sel="#it-urg", text="High · meeting at 2:00 PM"),
    act("fill", 0.3, sel="#it-desc", text="VPN fails to connect since ~9 AM. Client call at 2 PM."),
    act("highlight", 0, sel=None),
    act("confirm", 0.2, title="Submit ticket", items=["VPN / remote access · CL-4419", "High urgency · call at 2 PM"]),
    say("copilot", "High urgency, then. Here's the ticket. Shall I submit it?"),
    say("daniel", "Yes."),
    act("confirm", 0, title=None),
    act("toast", 0.3, text="✓ Ticket #48213 · high priority"),
    act("task", 0.2, text="IT is picking up your ticket", on=True),
    say("daniel", "Can you order me lunch while we wait?"),
    say("copilot", "Ha, I wish! I can only help with IT Desk things here. But try the backup gateway in your VPN app. That fixes it for most people."),
    act("task", 0, on=False),
    act("clock", 0, rate=0),
    clip("office_after", dur=5.0, lower="Ticket filed right, plus a fix to try now"),
    say("daniel", "Oh, that worked. Nice.", after=0.4),

    # ---------- 4. Sofia (Spanish) ----------
    persona("sofia", "Sofia", "Lumen & Pine customer · buying a website"),
    clip("buyer_before", lower="Sofia · buying a website for her yoga studio"),
    act("scene", 0.6, name="app", site="agency", mode="before"),
    act("clock", 0, start=0, rate=15),
    act("cursor", 0.7, sel="#ag-tier-1"),
    act("cursor", 0.6, sel="#ag-tier-2"),
    act("cursor", 0.6, sel="#ag-tier-3"),
    act("tooltip", 0.2, sel="#ag-tier-3", text="Headless CMS, edge CDN, 99.95% SLA"),
    think("sofia", "¿Starter, Growth, Scale? ¿Qué es un CMS headless?", sub="Starter, Growth, Scale? What's a headless CMS?"),
    act("tooltip", 0, sel=None),
    act("click", 0.8, sel="#ag-quote"),
    act("view", 0.3, sel="#ag-form"),
    act("mood", 0, emoji="😕"),
    act("clock", 0, rate=0),

    act("scene", 0.6, name="app", site="agency", mode="after"),
    act("clock", 0, start=0, rate=1),
    act("scope", 0, site="lumenandpine.studio", can=["Explain plans", "Prepare quotes", "Email quotes"]),
    act("copilot", 0.5, open=True),
    act("lang", 0, code="ES"),
    say("sofia", "Hola. Necesito una web para mi estudio de yoga, con reservas online.",
        sub="Hi. I need a website for my yoga studio, with online booking."),
    act("view", 0.2, sel="#ag-form"),
    act("highlight", 0.2, sel="#ag-biz"),
    say("copilot", "¡Qué bien! ¿Cómo se llama tu estudio?", sub="Lovely! What's your studio called?"),
    say("sofia", "Estudio Prana Yoga.", sub="Prana Yoga Studio."),
    act("fill", 0.3, sel="#ag-biz", text="Estudio Prana Yoga"),
    act("highlight", 0.2, sel="#ag-budget"),
    say("copilot", "¿Y más o menos cuánto quieres invertir?", sub="And roughly how much do you want to spend?"),
    say("sofia", "Unos tres mil dólares.", sub="About three thousand dollars."),
    act("fill", 0.2, sel="#ag-budget", text="$3,000"),
    act("highlight", 0.2, sel="#ag-plan"),
    say("copilot", "Entonces el plan Growth es ideal: incluye reservas y pagos, y entra en tu presupuesto. ¿Te envío la cotización por email?",
        sub="Then the Growth plan is ideal: it includes booking and payments, and fits your budget. Shall I email you the quote?"),
    act("fill", 0.2, sel="#ag-plan", text="Growth · booking + payments"),
    act("confirm", 0.2, title="Enviar cotización", items=["Plan Growth · $2,800", "Reservas + pagos online", "Para: sofia@pranayoga.example"]),
    say("sofia", "Sí, por favor.", sub="Yes, please."),
    act("confirm", 0, title=None),
    act("highlight", 0, sel=None),
    act("toast", 0.3, text="✓ Cotización enviada · Quote sent"),
    act("clock", 0, rate=0),
    clip("buyer_after", dur=5.0, lower="Right plan, quote in her inbox, in her own language"),
    say("sofia", "¡Qué fácil!", sub="That was easy!", after=0.5),

    # ---------- 5. Harold ----------
    persona("harold", "Harold, 74", "Evergreen Retirement member · updating a beneficiary"),
    clip("elder_before", lower="Harold, 74 · updating his retirement beneficiary"),
    act("scene", 0.6, name="app", site="retire", mode="before"),
    act("clock", 0, start=0, rate=15),
    act("cursor", 0.8, sel="#rt-code"),
    act("tooltip", 0.2, sel="#rt-code", text="See Schedule B, §4(c), for payee designation codes"),
    act("zoom", 0.8, level=1.35),
    think("harold", "Payee designation code? I'll have to call my son again.", after=0.4),
    act("tooltip", 0, sel=None),
    act("zoom", 0.3, level=1),
    act("mood", 0, emoji="😞"),
    act("clock", 0, rate=0),

    act("scene", 0.6, name="app", site="retire", mode="after"),
    act("clock", 0, start=0, rate=1),
    act("scope", 0, site="evergreenretire.com", can=["Explain forms", "Fill forms with you", "Print", "Email copies"]),
    act("copilot", 0.5, open=True, large=True),
    say("copilot", "Hello Harold. I can help you update your beneficiary. One step at a time, no rush.", speed=0.92),
    say("harold", "I want my son to be the beneficiary now."),
    act("highlight", 0.2, sel="#rt-ben"),
    say("copilot", "Of course. What's your son's first name?", speed=0.92),
    say("harold", "Michael."),
    act("fill", 0.4, sel="#rt-ben", text="Michael"),
    say("copilot", "And how do you spell his last name?", speed=0.92),
    say("harold", "R, E, Y, E, S.", show="R-E-Y-E-S."),
    act("spell", 0.2, text="R-E-Y-E-S"),
    act("fill", 0.4, sel="#rt-ben", text="Michael Reyes"),
    act("highlight", 0.2, sel="#rt-code"),
    say("copilot", "Reyes. Got it. This payee code just means how he's related to you. So, your son. Is that right?",
        show="Reyes. Got it. This “payee code” just means how he's related to you. So: your son. Is that right?", speed=0.92),
    act("spell", 0, text=None),
    say("harold", "That's right."),
    act("fill", 0.2, sel="#rt-code", text="C · Child"),
    say("copilot", "Would you like it printed, or emailed to Michael?", speed=0.92),
    act("confirm", 0.2, title="Ready to submit", items=["Beneficiary: Michael Reyes (son)", "Print 1 copy", "Email a copy to Michael"]),
    say("harold", "Both, please."),
    act("confirm", 0, title=None),
    act("highlight", 0, sel=None),
    act("toast", 0.3, text="✓ Submitted · printing · copy sent to Michael"),
    act("clock", 0, rate=0),
    clip("elder_after", dur=5.0, lower="Done, printed, and his son has a copy"),
    say("harold", "Well. That was easier than calling the office.", after=0.4),

    # ---------- How it's different ----------
    act("scene", 0.3, name="compare"),
    say("narrator", "This isn't a browser agent that roams the web for your customer, and it isn't a coding agent for developers.", after=0.4),
    act("compareHi", 0),
    say("narrator", "It's yours. You install it on your own website. It only knows your site, only uses your actions, keeps customer details in house, and walks people through step by step, asking before it acts.", after=1.2),

    # ---------- Outro ----------
    act("scene", 0.3, name="outro"),
    say("narrator", "Five businesses. Five customers who finished without a phone call. Add a copilot to the website you already have, and keep your customers' details in house.", after=3.0),
]


def env_key():
    for line in pathlib.Path(os.path.expanduser("~/Documents/projects/.env")).read_text().splitlines():
        if line.startswith("elevenlabs_nyc_map_agent="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("ElevenLabs key not found")


def decode(data, fmt):
    """Decode audio bytes with ffmpeg into mono float32 at SR."""
    p = subprocess.run([FFMPEG, "-loglevel", "error", "-f", fmt, "-i", "pipe:0", "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
                       input=data, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32)


def tts(who, text, speed):
    cache = BUILD / "tts"
    cache.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1(f"{VOICES[who]}|{speed}|{text}".encode()).hexdigest()[:16]
    f = cache / f"{who}-{h}.mp3"
    if not f.exists():
        body = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.25, "speed": speed},
        }
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[who]}?output_format=mp3_44100_128",
            data=json.dumps(body).encode(),
            headers={"xi-api-key": env_key(), "Content-Type": "application/json", "Accept": "audio/mpeg"},
        )
        f.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    return decode(f.read_bytes(), "mp3")


def clip_audio(name):
    p = subprocess.run([FFMPEG, "-loglevel", "error", "-i", str(CLIPS / f"{name}.mp4"), "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "pipe:1"],
                       capture_output=True)
    return np.frombuffer(p.stdout, dtype=np.float32) if p.returncode == 0 else np.zeros(0, np.float32)


def clip_webm(name):
    # Playwright's Chromium can't play H.264, so the page gets VP9.
    out = BUILD / "clips" / f"{name}.webm"
    out.parent.mkdir(parents=True, exist_ok=True)
    if not out.exists():
        subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-i", str(CLIPS / f"{name}.mp4"), "-an", "-c:v", "libvpx-vp9",
                        "-b:v", "4M", "-deadline", "good", "-cpu-used", "4", str(out)], check=True)


def click_sound():
    t = np.arange(int(SR * 0.03)) / SR
    return (np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 180) * 0.2).astype(np.float32)


def music_bed(n, speech):
    """Loop build/music/bed.mp3 (ElevenLabs Music) to n samples, ducked under speech."""
    f = BUILD / "music" / "bed.mp3"
    if not f.exists():
        return np.zeros(n, np.float32)
    bed = decode(f.read_bytes(), "mp3")
    fade = SR * 2
    out = np.zeros(n + len(bed), np.float32)
    ramp = np.linspace(0, 1, fade, dtype=np.float32)
    i = 0
    while i < n:
        seg = bed.copy()
        seg[:fade] *= ramp
        seg[-fade:] *= ramp[::-1]
        out[i : i + len(seg)] += seg
        i += len(seg) - fade
    out = out[:n]
    duck = np.ones(n, np.float32)
    for a, b in speech:
        duck[int(a * SR) : int(b * SR)] = 0.45
    k = int(SR * 0.25)
    duck = np.convolve(duck, np.ones(k, np.float32) / k, mode="same")
    env = np.ones(n, np.float32)
    env[: SR * 2] = np.linspace(0, 1, SR * 2)
    env[-SR * 3 :] = np.linspace(1, 0, SR * 3)
    return out * duck * env * 0.16


def build():
    BUILD.mkdir(exist_ok=True)
    t = 0.0
    events, layers, speech = [], [], []
    for step in SCENES:
        kind = step[0]
        if kind == "say":
            _, s, after = step
            audio = tts(s["who"], s["text"], s["speed"]) * (0.8 if s["thought"] else 1.0)
            dur = len(audio) / SR
            events.append({"t": round(t, 3), "do": "say", "who": s["who"], "name": NAMES.get(s["who"], ""), "text": s["show"] or s["text"],
                           "sub": s["sub"], "thought": s["thought"], "dur": round(dur, 3)})
            layers.append((t, audio))
            speech.append((t, t + dur))
            t += dur + after
        elif kind == "clip":
            _, name, args, dur = step
            clip_webm(name)
            events.append({"t": round(t, 3), "do": "clip", "name": name, "src": f"../build/clips/{name}.webm", "dur": dur, "lower": args.get("lower")})
            layers.append((t, clip_audio(name)[: int(dur * SR)] * args["gain"]))
            t += dur
        else:
            _, do, args, dur = step
            events.append({"t": round(t, 3), "do": do, "dur": dur, **args})
            if do == "click" and not args.get("silent"):
                layers.append((t + dur * 0.75, click_sound()))
            t += dur
    total = t + 0.3
    mix = np.zeros(int(total * SR) + SR, dtype=np.float32)
    for start, audio in layers:
        i = int(start * SR)
        n = min(len(audio), len(mix) - i)
        mix[i : i + n] += audio[:n]
    mix += music_bed(len(mix), speech)
    peak = float(np.abs(mix).max()) or 1.0
    if peak > 0.95:
        mix *= 0.95 / peak
    sf.write(BUILD / "audio.wav", mix[: int(total * SR)], SR)
    (BUILD / "timeline.json").write_text(json.dumps({"total": round(total, 3), "events": events}, indent=1, ensure_ascii=False))
    print(f"timeline: {len(events)} events, {total:.1f}s")


if __name__ == "__main__":
    build()
