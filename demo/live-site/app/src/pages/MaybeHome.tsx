// The Maybe home page. Every picture and film comes from Octo (GET /api/site-media): the page holds the words
// and the motion, the database holds which file goes in which slot. A slot that is missing simply isn't drawn.
import { Fragment, memo, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { interpolate } from "flubber";
import "@/styles/maybe.css";

type Slot = { kind: "image" | "video"; url: string; mobile_url: string | null; poster_url: string | null; alt: string; pos: string | null; mpos: string | null; cuts: string | null };
type Slots = Record<string, Slot>;

const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const vars = (pos?: string | null, mpos?: string | null) => ({ ...(pos ? { "--pos": pos } : {}), ...(mpos ? { "--mpos": mpos } : {}) }) as CSSProperties;

function useSiteMedia(): Slots | null {
  const [slots, setSlots] = useState<Slots | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/site-media", { headers: { accept: "application/json" } })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => live && setSlots(d.slots ?? {}))
      .catch(() => live && setSlots({}));
    return () => { live = false; };
  }, []);
  return slots;
}

/* ---------- the pebble ---------- */
const Pebble = () => (
  <svg className="pebble" viewBox="14 18 92 88" aria-hidden="true">
    <path d="M20 62Q20 22 60 22Q100 22 100 62Q100 100 60 100Q20 100 20 62Z" fill="#FFD447" stroke="currentColor" strokeWidth="6" />
    <circle cx="48" cy="56" r="6" fill="#161513" /><circle cx="72" cy="56" r="6" fill="#161513" />
    <path d="M52 70q8 8 16 0" fill="none" stroke="#161513" strokeWidth="5" strokeLinecap="round" />
  </svg>
);
const PebbleAI = () => (
  <svg viewBox="14 18 92 88" aria-hidden="true">
    <path d="M20 62Q20 22 60 22Q100 22 100 62Q100 100 60 100Q20 100 20 62Z" fill="#FFD447" stroke="#161513" strokeWidth="5" />
    <circle cx="49" cy="48" r="5.5" fill="#161513" /><circle cx="71" cy="48" r="5.5" fill="#161513" />
    <path d="M53 59q7 7 14 0" fill="none" stroke="#161513" strokeWidth="4.5" strokeLinecap="round" />
    <rect x="42" y="70" width="36" height="20" rx="10" fill="#161513" />
    <text x="60" y="85" textAnchor="middle" fontFamily="Inter Tight,system-ui,sans-serif" fontWeight="800" fontSize="15" fill="#FFD447">AI</text>
  </svg>
);
const Tag = () => <i className="tag">Maybe <small>AI</small></i>;

/* ---------- 1 hero ---------- */
const HERO: { slot: string; cls?: string; prob: string; help: ReactNode }[] = [
  { slot: "hero.woman", prob: "Another letter that makes no sense.", help: <>I&rsquo;ll read it with you, line by line.</> },
  { slot: "hero.fix", cls: "left", prob: "A manual nobody has time to read.", help: <>Say the model. I&rsquo;ll put the right page on screen.</> },
  { slot: "hero.couple", cls: "wide", prob: "Tax forms on the dinner table.", help: <>Just talk it through. I&rsquo;ll fill in the boxes.</> },
  { slot: "hero.shop", prob: "Another new system to learn.", help: <>Say what you need. I&rsquo;ll bring it up for you.</> },
];

function Hero({ media, openDeck }: { media: Slots; openDeck: () => void }) {
  const [i, setI] = useState(0);
  const [help, setHelp] = useState(false);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const manual = useRef(false);
  useEffect(() => {
    setHelp(false);
    const quiet = reduceMotion();
    const t1 = setTimeout(() => setHelp(true), quiet && manual.current ? 0 : 2600);
    const t2 = quiet ? 0 : window.setTimeout(() => { manual.current = false; setI(n => (n + 1) % HERO.length); }, 6500);
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
  }, [i]);
  useEffect(() => {
    videos.current.forEach((v, k) => {
      if (!v) return;
      if (k === i && !reduceMotion()) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
    });
  }, [i, media]);
  return (
    <section className="hero" aria-roledescription="carousel" aria-label="People getting help">
      {HERO.map((h, k) => {
        const s = media[h.slot];
        return (
          <div key={h.slot} className={`shot ${h.cls ?? ""} ${k === i ? "on" : ""}`} style={vars(s?.pos, s?.mpos)}>
            {s?.kind === "video" && <video ref={el => { videos.current[k] = el; }} src={s.url} poster={s.poster_url ?? undefined} muted playsInline preload="metadata" aria-label={s.alt} />}
            {s?.kind === "image" && <img src={s.url} alt={s.alt} />}
          </div>
        );
      })}
      <div className="wrap">
        <h1>Nobody should have to figure it out alone.</h1>
        <p className="say" aria-live="polite">
          {HERO.map((h, k) => (
            <Fragment key={k}>
              <span className={`prob ${k === i && !help ? "on" : ""}`}>{h.prob}</span>
              <span className={`help ${k === i && help ? "on" : ""}`}><Tag />{h.help}</span>
            </Fragment>
          ))}
        </p>
        <div className="row">
          <a className="btn btn-primary" href="#" onClick={e => { e.preventDefault(); openDeck(); }}><span className="play" />Watch the 60-second story</a>
          <a className="btn btn-secondary" href="#people">Meet the people</a>
          <div className="dots">
            {HERO.map((h, k) => <button key={h.slot} aria-label={`Story ${k + 1}`} aria-current={k === i} onClick={() => { manual.current = true; setI(k); }} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 4 the people ---------- */
const FILMS: { slot: string; flip?: boolean; lines: [string, string]; ai: string; who: string }[] = [
  { slot: "film.frank", lines: ["“Where do I even start?”", "“Which box do I fill in first?”"], ai: "I’ll go line by line with you.", who: "Frank, at his dining table, trying to finish one form" },
  { slot: "film.ana", flip: true, lines: ["“I can’t do both right now.”", "“I’ve only got one hand right now.”"], ai: "We can do it by voice. Just talk, I’ll fill it in.", who: "Ana, at home with her sick son and a check-up to book" },
  { slot: "film.sam", lines: ["“Not today. Not right before the meeting.”", "“Why won’t my laptop join the call?”"], ai: "Read me the error. I’ll bring the fix up.", who: "Sam, at work, at the end of a long day" },
];

// each film plays in view; its subtitle goes worry, question, then Maybe's answer as they smile
function Film({ f, s }: { f: (typeof FILMS)[number]; s?: Slot }) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    const v = video.current, m = box.current;
    if (!v || !m || !s?.cuts) return;
    const [a, b] = s.cuts.split(",").map(Number);
    let raf = 0;
    const tick = () => { const t = v.currentTime; setBeat(t < a ? 0 : t < b ? 1 : 2); if (!v.paused) raf = requestAnimationFrame(tick); };
    v.addEventListener("play", tick); v.addEventListener("seeked", tick);
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting && !reduceMotion()) { v.currentTime = 0; v.play().catch(() => {}); } else v.pause();
    }), { threshold: 0.55 });
    io.observe(v);
    return () => { cancelAnimationFrame(raf); io.disconnect(); v.removeEventListener("play", tick); v.removeEventListener("seeked", tick); };
  }, [s?.url, s?.cuts]);
  // each subtitle stays on one line: if it's wider than the film, its type shrinks to fit
  useEffect(() => {
    const m = box.current; if (!m) return;
    const fit = () => m.querySelectorAll<HTMLElement>(".sub .ln").forEach(li => {
      const t = li.querySelector<HTMLElement>(".t") ?? li; t.style.fontSize = "";
      const room = m.clientWidth * 0.92, w = t.getBoundingClientRect().width;
      if (w > room) t.style.fontSize = (parseFloat(getComputedStyle(t).fontSize) * room / w).toFixed(1) + "px";
    });
    fit(); addEventListener("resize", fit); document.fonts?.ready.then(fit);
    return () => removeEventListener("resize", fit);
  }, []);
  return (
    <article className={`ch ${f.flip ? "flip" : ""}`}>
      <div className="media" ref={box}>
        {s && <video ref={video} src={s.url} poster={s.poster_url ?? undefined} muted loop playsInline preload="metadata" aria-label={s.alt} />}
        <p className="sub" aria-live="polite">
          <span className={`ln ${beat === 0 ? "on" : ""}`}>{f.lines[0]}</span>
          <span className={`ln ${beat === 1 ? "on" : ""}`}>{f.lines[1]}</span>
          <span className={`ln ai ${beat === 2 ? "on" : ""}`}><i className="mas" role="img" aria-label="Maybe, AI"><PebbleAI /></i><span className="t">{f.ai}</span></span>
        </p>
      </div>
      <div><p className="who">{f.who}</p></div>
    </article>
  );
}

/* ---------- 2b the pile, then one page (scroll-driven) ---------- */
const PAPERS: ReactNode[] = [
  <><b>Electric bill</b><span className="stamp">PAST DUE</span><i /><i className="m" /><i className="s" /><i /><i className="m" /></>,
  <><b>Form 1040</b>{[0, 1, 2, 3, 4].map(k => <div className="box" key={k}><span /><em /></div>)}</>,
  <><b>Instructions, page 47</b><div className="cols"><div><i /><i /><i className="m" /><i /><i className="s" /><i /><i /></div><div><i /><i className="m" /><i /><i /><i className="s" /><i /><i /></div></div></>,
  <><b>Ledger</b><div className="grid">{Array.from({ length: 21 }, (_, k) => <span key={k} />)}</div></>,
  <><b>Benefits renewal</b><span className="stamp">DUE IN 10 DAYS</span><i /><i className="m" /><div className="box"><span /><em /></div><div className="box"><span /><em /></div></>,
  <><b>Explanation of benefits</b><i className="m" /><span className="stamp">NOT A BILL</span><i /><i className="s" /><i /><i /><i className="m" /></>,
  <><b>Notice of change</b><i /><i /><i className="m" /><i /><i className="s" /><i /><i className="m" /><i /></>,
  <><b>W-2</b><div className="grid">{Array.from({ length: 9 }, (_, k) => <span key={k} />)}</div><i className="m" /><i className="s" /></>,
  <><b>Lease renewal</b><i /><i className="m" /><i /><i /><i className="s" /><div className="box"><span /><em /></div></>,
];
const FORM_ROWS = [
  { lab: "Line 1 · Tax family size (excl. dependents filing separately)", tip: "Everyone on your tax return: you, your spouse if you file together, and anyone you list as a dependent. Want me to explain more?", href: "https://www.irs.gov/instructions/i8962", src: "IRS: Form 8962 instructions, line 1" },
  { lab: "Line 2a · Modified AGI (AGI + tax-exempt interest + nontaxable SS)", tip: "The income on your tax return, plus tax-free interest and any Social Security that wasn’t taxed. Still unclear? I can go through it with you.", href: "https://www.irs.gov/instructions/i1040gi", src: "IRS: Form 1040 instructions, lines 2a and 11" },
  { lab: "Line 11(f) · Annual advance payment of PTC (APTC)", tip: "Money the government paid your insurer each month to lower your health plan bill. I can pull up more of the guide if you need it.", href: "https://www.irs.gov/forms-pubs/about-form-1095-a", src: "IRS: Form 1095-A, column C" },
];

const Pile = memo(function Pile() {
  const pile = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = pile.current!;
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const pop = (t: number) => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
    const area = $("#area"), say = $("#sayTop"), form = $("#form"), mascot = $("#mascot"), sent = $("#sent");
    const papers = [...area.querySelectorAll<HTMLElement>(".pp")];
    const rows = [...form.querySelectorAll<HTMLElement>(".row")];
    const VALS = ["3", "$48,462", "$4,812"];
    // where each paper lands in the pile and which way it flies when it clears
    const POS = [[-150, -30, -9], [120, -60, 7], [-40, 20, -3], [200, 40, 11], [-230, 60, -14], [40, -90, 4], [-110, 90, 8], [150, 110, -6], [10, 40, 2]];
    const LINES: [number, string][] = [
      [0, "A letter. Then a form. Then the instructions for the form."],
      [0.2, "It piles up faster than anyone can read it."],
      [0.38, ""],
      [0.6, "Each hard line, answered in plain words."],
      [0.93, "It filled it in with you, one line at a time."],
    ];
    // one pebble, reshaped for the job: asking, finding, marking your place, done
    const SHAPES: Record<string, string> = {
      pebble: "M20 62Q20 22 60 22Q100 22 100 62Q100 100 60 100Q20 100 20 62Z",
      bubble: "M24 26H96Q106 26 106 36V76Q106 86 96 86H56L38 102V86H24Q14 86 14 76V36Q14 26 24 26Z",
      mag: "M24 56C24 36 40 20 60 20C80 20 96 36 96 56C96 76 80 92 60 92C40 92 24 76 24 56Z",
      mark: "M32 16H88V104L60 88L32 104Z",
      stamp: "M24 22H96V96H24Z",
    };
    const body = root.querySelector("#mBody")!, extras = [...mascot.querySelectorAll<SVGElement>(".extra")];
    let shape = "pebble", morphId = 0, morphTimer = 0;
    const setShape = (next: string) => {
      if (next === shape) return;
      const from = body.getAttribute("d")!, to = SHAPES[next], id = ++morphId; shape = next;
      extras.forEach(x => x.classList.toggle("on", x.dataset.for === next));
      mascot.classList.add("morph"); clearTimeout(morphTimer); morphTimer = window.setTimeout(() => mascot.classList.remove("morph"), 220);
      if (reduceMotion()) { body.setAttribute("d", to); return; }
      const lerp = interpolate(from, to, { maxSegmentLength: 3 });
      const t0 = performance.now();
      const step = (now: number) => {
        if (id !== morphId) return;
        const t = Math.min((now - t0) / 420, 1);
        body.setAttribute("d", t < 1 ? lerp(ease(t)) : to);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    let line = -1, last = -1, fit = 1, sayTimer = 0;
    const kOf = () => parseFloat(getComputedStyle(area).getPropertyValue("--k")) || 1;
    // on short screens the form shrinks just enough that its longest answer and the subtitle under it stay on screen
    const tips = rows.map(r => r.querySelector<HTMLElement>(".tip>div")!);
    const measureFit = () => {
      const closed = form.offsetHeight - tips.reduce((s, d) => s + d.offsetHeight, 0);
      const full = closed + Math.max(...tips.map(d => d.scrollHeight));
      const sub = 24 + 2 * 1.15 * parseFloat(getComputedStyle(say).fontSize) + 32; // room for a two-line subtitle
      fit = Math.min(1, (innerHeight - area.offsetTop - form.offsetTop - sub) / full);
      last = -1;
    };
    const frame = () => {
      const r = root.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - innerHeight), 0, 1);
      if (p === last) return; last = p;
      const k = kOf();
      papers.forEach((el, i) => {
        const [x, y, rot] = POS[i];
        const t = clamp((p - (0.02 + i * 0.036)) / 0.05, 0, 1);
        const d = ease(clamp((p - (0.38 + i * 0.006)) / 0.08, 0, 1));
        const s = 0.55 + 0.45 * pop(t);
        const fx = x * k + Math.sign(x || 1) * d * innerWidth * 0.7, fy = y * k - d * innerHeight * 0.5;
        el.style.transform = `translate(-50%,-50%) translate(${fx}px,${fy}px) rotate(${rot + d * rot * 3}deg) scale(${t ? s : 0.55})`;
        el.style.opacity = String(Math.min(t * 3, 1) * (1 - d));
      });
      const f = ease(clamp((p - 0.52) / 0.06, 0, 1));
      form.style.opacity = String(f);
      form.style.transform = `translate(-50%,0) translateY(${(1 - f) * 40}px) scale(${fit * (0.96 + 0.04 * f)})`;
      let active = -1;
      rows.forEach((row, i) => {
        const a = 0.6 + i * 0.1, t = (p - a) / 0.1;
        const on = t >= 0 && t < 1 && p < 0.93, done = t >= 0.6;
        row.classList.toggle("on", on); row.classList.toggle("done", done);
        row.querySelector(".val")!.textContent = done ? VALS[i] : "";
        if (on) active = i;
      });
      sent.classList.toggle("on", p >= 0.93);
      setShape(p >= 0.93 ? "stamp" : ["bubble", "mag", "mark"][active] || "pebble");
      // the helper keeps one spot on the form's right edge and only slides down to the line it is answering
      const fr = form.getBoundingClientRect(), ar = area.getBoundingClientRect(), mw = mascot.offsetWidth;
      const right = rows[0].querySelector(".top")!.getBoundingClientRect().right - ar.left - 52 * fit;
      let my = fr.top - ar.top + 10;
      if (active >= 0) my = rows[active].querySelector(".tip p")!.getBoundingClientRect().top - ar.top + 4;
      else if (p >= 0.93) { const sr = sent.getBoundingClientRect(); my = sr.top - ar.top + sr.height / 2 - 28; }
      mascot.style.left = "0"; mascot.style.top = "0";
      mascot.style.transform = `translate(${right}px,${my}px) scale(${52 * fit / mw})`;
      mascot.style.opacity = String(f);
      // the subtitle sits right under whatever is on screen: the pile, then the form
      say.style.top = (p < 0.5 ? ar.height * 0.46 + 272 * k : fr.bottom - ar.top + 24) + "px";
      let n = 0; LINES.forEach(([at], i) => { if (p >= at) n = i; });
      if (n !== line) {
        line = n; say.classList.add("out");
        clearTimeout(sayTimer);
        sayTimer = window.setTimeout(() => { say.textContent = LINES[n][1]; say.classList.remove("out"); }, 180);
      }
    };
    let ticking = false;
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(); }); } };
    const onResize = () => { measureFit(); req(); };
    const onTip = () => { last = -1; req(); };
    addEventListener("scroll", req, { passive: true });
    addEventListener("resize", onResize);
    rows.forEach(r => r.querySelector(".tip")!.addEventListener("transitionend", onTip));
    document.fonts?.ready.then(onResize);
    measureFit(); frame();
    return () => {
      removeEventListener("scroll", req); removeEventListener("resize", onResize);
      rows.forEach(r => r.querySelector(".tip")?.removeEventListener("transitionend", onTip));
      clearTimeout(sayTimer); clearTimeout(morphTimer); morphId++;
    };
  }, []);
  return (
    <section className="pile" id="pile" ref={pile} aria-label="Papers pile up, then the AI helper brings one page and fills it in with you">
      <div className="stage">
        <div className="area" id="area">
          {PAPERS.map((p, k) => <div className="pp" key={k}>{p}</div>)}
          <div className="form" id="form">
            <header><b>Form 8962, Premium Tax Credit <small>Part I</small></b></header>
            {FORM_ROWS.map(r => (
              <div className="row" key={r.lab}>
                <div className="top"><span className="lab">{r.lab}</span></div>
                <div className="tip"><div><p>{r.tip}</p><small><a href={r.href} target="_blank" rel="noopener noreferrer">{r.src}</a></small></div></div>
                <span className="val" />
              </div>
            ))}
            <div className="sent" id="sent">Ready to send</div>
          </div>
          <p className="say-top" id="sayTop" aria-live="polite">A letter. Then a form. Then the instructions for the form.</p>
          <div className="mascot" id="mascot" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <ellipse className="shadow" cx="60" cy="116" rx="30" ry="4" />
              <g className="bob"><g className="squish">
                <g className="extra" data-for="mag"><path d="M86 84l20 20" className="handle" /></g>
                <path className="body" id="mBody" d="M20 62Q20 22 60 22Q100 22 100 62Q100 100 60 100Q20 100 20 62Z" />
                <g className="extra" data-for="stamp"><rect x="31" y="29" width="58" height="60" rx="3" className="perf" /></g>
                <ellipse className="eye" cx="53" cy="52" rx="4.6" ry="5.8" /><ellipse className="eye" cx="67" cy="52" rx="4.6" ry="5.8" />
                <circle cx="54.6" cy="49.6" r="1.6" fill="#fff" /><circle cx="68.6" cy="49.6" r="1.6" fill="#fff" />
                <ellipse cx="45" cy="62" rx="4.5" ry="2.6" fill="#F5A623" opacity=".5" /><ellipse cx="75" cy="62" rx="4.5" ry="2.6" fill="#F5A623" opacity=".5" />
                <path className="smile" d="M54.5 61q5.5 5.5 11 0" />
                <rect x="48" y="69" width="24" height="14" rx="7" className="tag" />
                <text x="60" y="79.6" textAnchor="middle" fontFamily="Inter Tight,system-ui,sans-serif" fontWeight="700" fontSize="9.5" className="tagt">AI</text>
              </g></g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
});

/* ---------- 6 why it matters: charts that fill with the scroll ---------- */
const Charts = memo(function Charts() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cards = [...root.current!.querySelectorAll<HTMLElement>(".chart")].map(c => ({ c, marks: [...c.querySelectorAll(".fly")] }));
    let raf = 0;
    // each card's marks come in with the scroll, like the pile; cards side by side fill one after another, so only one card moves at a time
    const draw = () => {
      raf = 0;
      cards.forEach(({ c, marks }, k) => {
        const top = c.getBoundingClientRect().top;
        let col = 0; for (let j = k - 1; j >= 0 && Math.abs(cards[j].c.getBoundingClientRect().top - top) < 4; j--) col++;
        const start = innerHeight * (0.92 - col * 0.26);
        const p = reduceMotion() ? 1 : Math.min(1, Math.max(0, (start - top) / (innerHeight * 0.26)));
        const n = Math.round(p * marks.length);
        marks.forEach((m, i) => m.classList.toggle("in", i < n));
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(draw); };
    addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", draw); draw();
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", draw); cancelAnimationFrame(raf); };
  }, []);
  const dots = (n: number, cols: number, on: number, size: number, gap: number, round: boolean) => Array.from({ length: n }, (_, i) => {
    const x = (i % cols) * (size + gap), y = Math.floor(i / cols) * (size + gap), cls = (i < on ? "m-on" : "m-off") + " fly";
    return round ? <circle key={i} cx={x + size / 2} cy={y + size / 2} r={size / 2} className={cls} /> : <rect key={i} x={x} y={y} width={size} height={size} rx={2} className={cls} />;
  });
  return (
    <div className="charts" ref={root}>
      <figure className="chart card" id="c1">
        <div className="fig"><svg viewBox="0 0 236 130" role="img" aria-label="Four people, one highlighted"><title>More than 1 in 4 U.S. adults lives with a disability</title>
          {[0, 1, 2, 3].map(i => <g key={i} transform={`translate(${i * 60},0)`}><g className={(i === 0 ? "m-on" : "m-off") + " fly"}><circle cx="28" cy="22" r="18" /><rect x="4" y="48" width="48" height="82" rx="20" /></g></g>)}
        </svg></div>
        <div className="big">1 in 4</div>
        <p>adults lives with a disability.</p>
        <cite>CDC, 2022 data: 28.7% of U.S. adults</cite>
      </figure>
      <figure className="chart card" id="c2">
        <div className="fig"><svg viewBox="0 0 138 138" role="img" aria-label="A grid of 100 squares, 95 highlighted"><title>95 of 100 home pages fail basic accessibility checks</title>{dots(100, 10, 95, 12, 2, false)}</svg></div>
        <div className="big">95 of 100</div>
        <p>home pages fail basic accessibility checks.</p>
        <cite>WebAIM Million, 2025: 94.8% of the top million home pages</cite>
      </figure>
      <figure className="chart card" id="c3">
        <div className="fig"><svg viewBox="0 0 138 138" role="img" aria-label="25 dots, each one million people"><title>About 25 million people in the U.S. speak English less than very well</title>{dots(25, 5, 25, 24, 4.5, true)}</svg></div>
        <div className="big">25 million</div>
        <p>people speak English less than &ldquo;very well.&rdquo; Each dot is a million.</p>
        <cite>U.S. Census, American Community Survey</cite>
      </figure>
    </div>
  );
});

/* ---------- the 60-second story ---------- */
const DUR = 10000;
function Deck({ open, onClose, media }: { open: boolean; onClose: () => void; media: Slots }) {
  const [cur, setCur] = useState(0);
  const fills = useRef<(HTMLElement | null)[]>([]);
  const img = (slot: string, key?: string) => { const s = media[slot]; return s ? <img key={key ?? slot} src={s.url} alt={s.alt} style={vars(s.pos, s.mpos)} /> : null; };
  const s3 = media["story.3"];
  const slides: { cap: string; cls?: string; node: ReactNode }[] = [
    { cap: "He's been shown how. He doesn't want to ask again.", node: img("story.1") },
    { cap: "He's sick and only wants you. The meeting is soon and nobody's answering.", node: <div className="split">{img("story.2a")}{img("story.2b")}</div> },
    { cap: "So you just ask.", node: s3 && <picture>{s3.mobile_url && <source media="(max-width:700px)" srcSet={s3.mobile_url} />}{img("story.3")}</picture> },
    { cap: "The form makes sense. The appointment is set up. It's working again.", node: <div className="split" style={{ "--n": 3 } as CSSProperties}>{img("story.4a")}{img("story.4b")}{img("story.4c")}</div> },
    { cap: "It isn't just them.", cls: "nums", node: <>
      <div className="n"><b>1 in 4</b><span>adults lives with a disability <small>CDC</small></span></div>
      <div className="n"><b>95 of 100</b><span>home pages fail accessibility checks <small>WebAIM</small></span></div>
      <div className="n"><b>25M</b><span>people speak English less than &ldquo;very well&rdquo; <small>U.S. Census</small></span></div></> },
    // Maybe signs off on the last frame only
    { cap: "Nobody should have to figure it out alone.", node: <>{img("story.6")}<div className="sign" role="img" aria-label="Maybe, AI"><PebbleAI /><span>maybe<b>.</b></span></div></> },
  ];
  const last = slides.length - 1;
  const go = useCallback((n: number) => setCur((n + slides.length) % slides.length), [slides.length]);
  useEffect(() => { if (open) setCur(0); }, [open]);
  useEffect(() => {
    if (!open) return;
    const t0 = performance.now(); let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / DUR));
      const f = fills.current[cur]; if (f) f.style.width = k * 100 + "%";
      if (k >= 1) { if (cur < last) setCur(cur + 1); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, cur, last]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(cur + 1);
      if (e.key === "ArrowLeft") go(cur - 1);
    };
    addEventListener("keydown", key); return () => removeEventListener("keydown", key);
  }, [open, cur, go, onClose]);
  return (
    <div className={`deck ${open ? "open" : ""}`} role="dialog" aria-label="The 60-second story" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="frm">
        <div className="bars">{slides.map((_, i) => <i key={i}><b ref={el => { fills.current[i] = el; }} style={{ width: i < cur ? "100%" : "0%" }} /></i>)}</div>
        <button className="x" aria-label="Close" onClick={onClose}>&times;</button>
        <div className="slides">{slides.map((s, i) => <div key={i} className={`slide ${s.cls ?? ""} ${i === cur ? "on" : ""}`}>{s.node}</div>)}</div>
        <div className="caption"><p>{slides[cur].cap}</p><div className="ctl"><button aria-label="Previous" onClick={() => go(cur - 1)}>&lsaquo;</button><button aria-label="Next" onClick={() => go(cur + 1)}>&rsaquo;</button></div></div>
      </div>
    </div>
  );
}

/* ---------- the page ---------- */
export default function MaybeHome() {
  const media = useSiteMedia();
  const [deck, setDeck] = useState(false);
  const openDeck = useCallback(() => setDeck(true), []);
  const closeDeck = useCallback(() => setDeck(false), []);
  useEffect(() => {
    const title = document.title, behavior = document.documentElement.style.scrollBehavior;
    document.title = "Maybe";
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.title = title; document.documentElement.style.scrollBehavior = behavior; };
  }, []);
  const turn = media?.["turn.man"];
  return (
    <div className="maybe" id="top">
      <nav><div className="wrap">
        <a className="logo" href="#top" aria-label="Maybe, home"><Pebble /><span>maybe<b>.</b></span></a>
        <div className="links">
          <a href="#people">The people</a>
          <a href="#why">Why it matters</a>
          <a href="#voices">In their words</a>
          <a className="btn btn-primary" href="#" onClick={e => { e.preventDefault(); openDeck(); }}><span className="play" />60-second story</a>
        </div>
      </div></nav>

      <Hero media={media ?? {}} openDeck={openDeck} />

      <section className="people" id="people"><div className="wrap">
        <span className="badge">Meet the people</span>
        <h2>You know this feeling.</h2>
        {FILMS.map(f => <Film key={f.slot} f={f} s={media?.[f.slot]} />)}
        <p className="fine">Frank, Ana and Sam are composite stories made for this page. Real people's words are below.</p>
      </div></section>

      <Pile />

      <section className="turn"><div className="wrap grid">
        <div>
          <span className="badge">What they did</span>
          <h2>So you just ask.</h2>
          <p className="lede">Out loud, the way you'd ask a friend.</p>
        </div>
        <figure className="card">
          {turn && <img src={turn.url} alt={turn.alt} style={vars(turn.pos, turn.mpos)} />}
          <figcaption>He'd rather say it than type it.</figcaption>
        </figure>
      </div></section>

      <section className="why" id="why"><div className="wrap">
        <span className="badge">It isn't just them</span>
        <h2>The web wasn't built for everyone. The help should be.</h2>
        <Charts />
        <details>
          <summary>The numbers as a table</summary>
          <table><tbody>
            <tr><th>What</th><th>Figure</th><th>Source</th></tr>
            <tr><td>U.S. adults with a disability</td><td>28.7%</td><td>CDC, Disability and Health Data System, 2022</td></tr>
            <tr><td>Top million home pages with detectable WCAG failures</td><td>94.8%</td><td>WebAIM Million, 2025</td></tr>
            <tr><td>People who speak English less than &ldquo;very well&rdquo;</td><td>about 25 million</td><td>U.S. Census Bureau, American Community Survey</td></tr>
          </tbody></table>
        </details>
      </div></section>

      <section className="belief"><div className="wrap">
        <span className="badge">What we believe</span>
        <blockquote>Technology should meet people where they are: tired, busy, and <em>in their own words.</em></blockquote>
        <p className="lede">We judge everything we build by one question: did someone feel less alone with it?</p>
      </div></section>

      {/* Real testimonials only. There is no store for them yet, so the wall stays empty rather than showing a made-up quote. */}
      <section className="voices" id="voices"><div className="wrap">
        <span className="badge">In their words</span>
        <h2>Real people, real words.</h2>
        <div className="empty">
          <b>We'd rather show an empty wall than a made-up quote.</b>
          <p>Stories appear here when the people we help choose to share them, in their own words.</p>
        </div>
      </div></section>

      <section className="close"><div className="wrap">
        <h2>Too much at once, and no one to ask? Ask here.</h2>
        <div className="row">
          <a className="btn btn-primary" href="#" onClick={e => { e.preventDefault(); openDeck(); }}><span className="play" />Watch the 60-second story</a>
          <a className="btn btn-secondary" href="/tax">Talk to it yourself</a>
        </div>
      </div></section>
      <footer><div className="wrap"><span>copilot.design-bakery.com</span><span>Prototype. The people on this page are composite stories. Research figures cite their sources.</span></div></footer>

      <Deck open={deck} onClose={closeDeck} media={media ?? {}} />
    </div>
  );
}
