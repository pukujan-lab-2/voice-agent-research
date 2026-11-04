import { useEffect, useRef, useState, type ReactElement } from "react";
import type React from "react";
import {
  Phone,
  Keyboard,
  Mic,
  MicOff,
  X,
  Send,
  BookOpen,
  FormInput,
} from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import type { CopilotMessage, CopilotSnapshot, CopilotBrainOption } from "@/lib/copilot";
import { cn } from "@/lib/utils";
import { SourceChip } from "@/components/tax/SourceChip";
import { ReturnCard } from "@/components/tax/ReturnCard";

/* ---------- helpers ---------- */

/** The Brain picker (#97): which model decides. The server lists smart options only for a request in scope; a visitor
 *  sees the local model only, and the server refuses a smart pick regardless of what this select sends. */
function BrainPicker({ snapshot }: { snapshot: CopilotSnapshot }) {
  const brains = snapshot.brains ?? [];
  if (brains.length < 1) return null;
  return (
    <span className="copilot-voice-picker">
      <select
        className="copilot-select"
        aria-label="Brain"
        data-testid="call-brain"
        value={snapshot.brain ?? "local"}
        onChange={(e) => window.copilot?.setBrain?.(e.target.value)}
      >
        {brains.map((b: CopilotBrainOption) => (
          <option key={b.id} value={b.id}>{b.label}</option>
        ))}
      </select>
    </span>
  );
}

/** The caller's language (and, when the business offers several, the voice stack), by the call button and during a call. */
function VoicePicker({ snapshot, inCall }: { snapshot: CopilotSnapshot; inCall: boolean }) {
  const languages = snapshot.languages ?? [];
  const stacks = snapshot.voiceStacks ?? [];
  const heard = languages.find((l) => l.code === snapshot.spokenLanguage);
  return (
    <span className="copilot-voice-picker">
      {!inCall && stacks.length > 1 && (
        <select
          className="copilot-select"
          aria-label="Voice"
          data-testid="call-stack"
          value={snapshot.stack ?? ""}
          onChange={(e) => window.copilot?.setStack?.(e.target.value)}
        >
          {stacks.map((st) => (
            <option key={st.id} value={st.id}>{st.label}</option>
          ))}
        </select>
      )}
      {languages.length > 1 && (
        <select
          className="copilot-select"
          aria-label="Language"
          data-testid="call-language"
          value={snapshot.language ?? ""}
          onChange={(e) => window.copilot?.setLanguage?.(e.target.value)}
        >
          <option value="">{inCall && heard ? `Heard: ${heard.native}` : "Any language"}</option>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
      )}
    </span>
  );
}

/** The owner's sign-in on the page (#97): the token is typed once, POSTed, and only the cookie the server sets comes back.
 *  The token is never kept in the page's source, a URL, localStorage or the snapshot; the field clears on submit. */
function OwnerSignIn({ snapshot }: { snapshot: CopilotSnapshot }) {
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "wrong" | "ok">("idle");
  if (!snapshot.owner && state !== "idle" && state !== "wrong") setState("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = token ? await window.copilot?.ownerSignIn?.(token) : await window.copilot?.ownerSignIn?.("");
    setState(ok ? "ok" : "wrong");
    setToken("");
  };
  return (
    <form className="copilot-owner-signin" onSubmit={submit} data-testid="owner-signin">
      {snapshot.owner || state === "ok" ? (
        <>
          <span className="copilot-owner-state" data-testid="owner-state">Owner</span>
          <button type="submit" className="copilot-owner-btn" data-testid="owner-signout">Sign out</button>
        </>
      ) : (
        <>
          <input
            type="password"
            className="copilot-owner-input"
            placeholder="Owner token"
            aria-label="Owner token"
            value={token}
            onChange={(e) => { setToken(e.target.value); if (state === "wrong") setState("idle"); }}
            autoComplete="off"
          />
          <button type="submit" className="copilot-owner-btn" data-testid="owner-submit" disabled={!token}>Sign in</button>
          {state === "wrong" && <span className="copilot-owner-wrong">Wrong token</span>}
        </>
      )}
    </form>
  );
}

function StatusIcon({ status }: { status: string }) {  if (status === "speaking")
    return (
      <span className="copilot-bars" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
    );
  if (status === "listening")
    return (
      <span className="copilot-mic-wave" aria-hidden="true">
        <span /><span /><span /><span /><span />
      </span>
    );
  if (status === "thinking")
    return <span className="copilot-spinner" aria-hidden="true" />;
  return null;
}

function statusLabel(status: string): string {
  switch (status) {
    case "speaking": return "Speaking";
    case "listening": return "Listening";
    case "waiting": return "Connecting…";
    case "thinking": return "Thinking";
    case "muted": return "Mic off";
    case "text": return "Text chat";
    default: return "Idle";
  }
}

/** Turn the linked parts of a message (a manual page, a cited source, a booking page) into links. */
function renderMessageText(msg: CopilotMessage) {
  const parts: (string | ReactElement)[] = [];
  let rest = msg.text;
  let key = 0;
  for (;;) {
    let at = -1;
    let link: CopilotMessage["links"][number] | undefined;
    for (const l of msg.links) {
      const i = rest.indexOf(l.text);
      if (i >= 0 && (at < 0 || i < at)) { at = i; link = l; }
    }
    if (!link) break;
    if (at > 0) parts.push(rest.slice(0, at));
    const external = /^https?:/.test(link.href);
    parts.push(
      <a
        key={`link-${key++}`}
        href={link.href}
        {...(external || link.page ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="copilot-cite"
        data-testid="call-link"
      >
        {link.text}
      </a>,
    );
    rest = rest.slice(at + link.text.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

/** mm:ss since the call started. */
function callTime(startedAt: number | undefined, now: number): string {
  if (!startedAt) return "0:00";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The caption shows the end of the copilot's last message: that is where its question is. */
function captionOf(msg: CopilotMessage): CopilotMessage {
  const sentences = msg.text.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) ?? [msg.text];
  // The caption is a glance, not a transcript: when the copilot ends on a question, that question
  // is the line to show — a read-back plus its question would be cut off at the end, not the middle.
  const last = (sentences[sentences.length - 1] ?? "").trim();
  if (/\?["')]*$/.test(last) && last.length <= 120) return { ...msg, text: last };
  let text = "";
  for (let i = sentences.length - 1; i >= 0; i--) {
    if (text && (sentences[i] + text).length > 110) break;
    text = sentences[i] + text;
  }
  return { ...msg, text: text.trim() };
}

/* ---------- the component ---------- */

export function CopilotWidget() {
  const { snapshot, start, send, toggleMic, setMode, end } = useCopilot();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  // A call starts as a small bar (the page stays in view); the handle or the caption opens the full transcript.
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // The call timer ticks every second; a wait countdown ticks faster so it reads smoothly.
  useEffect(() => {
    if (!snapshot.open) return;
    const t = setInterval(() => setNow(Date.now()), snapshot.wait ? 250 : 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, [snapshot.open, snapshot.wait]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Every call opens compact.
  useEffect(() => {
    if (!snapshot.open) setExpanded(false);
  }, [snapshot.open]);

  // Auto-scroll to bottom when messages change or the transcript opens.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [snapshot.messages, expanded]);

  // Tell the copilot how many px at the bottom the panel covers, so the field being filled stays above it.
  useEffect(() => {
    if (!snapshot.open || !isMobile) {
      window.copilot?.setCovered(0);
      return;
    }
    const update = () => {
      if (panelRef.current) window.copilot?.setCovered(window.innerHeight - panelRef.current.getBoundingClientRect().top);
    };
    update();
    const ro = new ResizeObserver(update);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [snapshot.open, isMobile, expanded, snapshot.messages]);

  // Close on Escape.
  useEffect(() => {
    if (!snapshot.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snapshot.open, end]);

  // Lift the mobile panel above the on-screen keyboard using visualViewport.
  useEffect(() => {
    if (!snapshot.open || !isMobile) return;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const update = () => {
      if (!panelRef.current) return;
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      if (keyboardHeight > 0) {
        panelRef.current.style.transform = `translateY(-${keyboardHeight}px)`;
      } else {
        panelRef.current.style.transform = "";
      }
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [snapshot.open, isMobile, snapshot.textInput]);

  // ---------- before a call: floating bar ----------
  if (!snapshot.open) {
    if (!snapshot.mounted) return null;
    return (
      <div className="copilot-bar" role="region" aria-label="Website Copilot">
        <button
          type="button"
          className="copilot-btn-primary"
          data-testid="call-start"
          onClick={() => start(true)}
        >
          <Phone size={18} />
          Start voice call
        </button>
        <VoicePicker snapshot={snapshot} inCall={false} />
        <BrainPicker snapshot={snapshot} />
        <button
          type="button"
          className="copilot-btn-ghost"
          data-testid="call-type"
          onClick={() => start(false)}
        >
          <Keyboard size={16} />
          Type instead
        </button>
      </div>
    );
  }

  // ---------- during a call ----------
  const large = snapshot.large;
  const showTabs = snapshot.modes.length >= 2;
  const lastBot = [...snapshot.messages].reverse().find((m) => m.who === "bot");

  // The handle: a tap toggles, a drag up opens, a drag down closes.
  const onHandleDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.y;
    if (Math.abs(dy) < 24) return;
    drag.current.moved = true;
    setExpanded(dy < 0);
  };
  const onHandleUp = () => {
    if (drag.current && !drag.current.moved) setExpanded((v) => !v);
    drag.current = null;
  };

  const panel = (
    <div
      key="call-panel" /* a new element, not the start bar's (whose transform would slide in) */
      ref={panelRef}
      className={cn(
        "copilot-panel",
        isMobile ? "copilot-panel-mobile" : "copilot-panel-desktop",
        expanded ? "copilot-panel-expanded" : "copilot-panel-compact",
        large && "copilot-panel-large",
      )}
      data-testid="call-panel"
      data-expanded={expanded ? "true" : "false"}
      data-busy={snapshot.busy ? "true" : "false"}
      data-typing={snapshot.textInput ? "true" : "false"}
      role="dialog"
      aria-label={`${snapshot.business} copilot call`}
    >
      <button
        type="button"
        className="copilot-drag-handle"
        data-testid="call-expand"
        aria-label={expanded ? "Show less" : "Show the whole conversation"}
        aria-expanded={expanded}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); }
        }}
      >
        <span />
      </button>

      {expanded && (
        <div className="copilot-header">
          <div className="copilot-header-info">
            <div className={cn("copilot-business", large && "text-lg")}>
              {snapshot.business}
            </div>
            <div className="copilot-promise">
              Fills only what you confirm. Never presses Submit.
            </div>
          </div>
          {snapshot.can.length > 0 && (
            <div className="copilot-chips">
              {snapshot.can.map((c, i) => (
                <span key={i} className="copilot-chip">
                  {c}
                </span>
              ))}
            </div>
          )}
          {showTabs && (
            <div className="copilot-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={snapshot.mode === "form"}
                className={cn("copilot-tab", snapshot.mode === "form" && "copilot-tab-active")}
                data-testid="call-mode-form"
                onClick={() => setMode("form")}
              >
                <FormInput size={14} /> Fill the form with me
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={snapshot.mode === "guide"}
                className={cn("copilot-tab", snapshot.mode === "guide" && "copilot-tab-active")}
                data-testid="call-mode-guide"
                onClick={() => setMode("guide")}
              >
                <BookOpen size={14} /> Walk me through
              </button>
            </div>
          )}
        </div>
      )}

      {/* status and the call controls, always one row */}
      <div className="copilot-bar-row">
        <div className="copilot-status" data-testid="call-status">
          <StatusIcon status={snapshot.status} />
          <span className={cn(large && "text-base")}>
            {statusLabel(snapshot.status)}
          </span>
          <span className="copilot-timer" data-testid="call-timer" aria-label="Call time">
            {callTime(snapshot.startedAt, now)}
          </span>
        </div>
        <div className="copilot-controls-row">
          {snapshot.voice && <VoicePicker snapshot={snapshot} inCall />}
          <BrainPicker snapshot={snapshot} />
          <button
            type="button"
            className={cn(
              "copilot-mic-btn",
              snapshot.mic === "on" && "copilot-mic-on",
              snapshot.mic === "unavailable" && "copilot-mic-disabled",
            )}
            disabled={snapshot.mic === "unavailable"}
            aria-label={
              snapshot.mic === "on"
                ? "Mute"
                : snapshot.mic === "unavailable"
                  ? "No mic"
                  : "Tap to talk"
            }
            data-testid="call-mic"
            onClick={toggleMic}
          >
            {snapshot.mic === "on" ? <Mic size={18} /> : <MicOff size={18} />}
            <span>
              {snapshot.mic === "on"
                ? "Mute"
                : snapshot.mic === "unavailable"
                  ? "No mic"
                  : "Talk"}
            </span>
          </button>
          <button
            type="button"
            className="copilot-control-btn"
            aria-label="Switch to typing"
            data-testid="call-keyboard"
            onClick={() => {
              window.copilot?.start({ voice: false });
            }}
          >
            <Keyboard size={18} />
            <span>Keyboard</span>
          </button>
          <button
            type="button"
            className="copilot-end-btn"
            aria-label="End call"
            data-testid="call-end"
            onClick={end}
          >
            <X size={18} />
            <span>End</span>
          </button>
        </div>
      </div>

      {/* a slow model call: what is happening, and a countdown */}
      {snapshot.wait && (
        <div className="copilot-wait" data-testid="call-wait" role="status">
          <span className="copilot-spinner" aria-hidden="true" />
          <span>
            {snapshot.wait.text}{" "}
            {snapshot.wait.until > now
              ? `about ${Math.ceil((snapshot.wait.until - now) / 1000)} s`
              : "almost there"}
          </span>
        </div>
      )}

      {/* caller verification: the verified caller's return status, in view in compact and expanded mode */}
      {snapshot.account && <ReturnCard card={snapshot.account} />}

      {/* compact: the copilot's last line as a caption; a tap opens the transcript */}
      {!expanded && (
        <div
          className="copilot-caption"
          data-testid="call-caption"
          role="button"
          tabIndex={0}
          aria-label="Show the whole conversation"
          aria-live="polite"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("a")) return;
            setExpanded(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") setExpanded(true);
          }}
        >
          <div className="copilot-caption-text">
            {snapshot.heard ? (
              <span className="copilot-caption-heard">Heard: {snapshot.heard}</span>
            ) : lastBot ? (
              renderMessageText(captionOf(lastBot))
            ) : (
              "Connecting…"
            )}
          </div>
        </div>
      )}

      {/* the whole conversation (kept in the page while compact, so it is never lost) */}
      <div
        ref={scrollRef}
        className="copilot-messages"
        hidden={!expanded}
        aria-live={expanded ? "polite" : "off"}
        aria-label="Conversation"
      >
        {snapshot.messages.length === 0 && (
          <div className="copilot-empty">Connecting…</div>
        )}
        {snapshot.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "copilot-message",
              msg.who === "bot" ? "copilot-message-bot" : "copilot-message-user",
            )}
            data-testid="call-message"
            data-who={msg.who}
          >
            {renderMessageText(msg)}
            {msg.source && <SourceChip messageId={msg.id} source={msg.source} />}
          </div>
        ))}
        {snapshot.heard && (
          <div className="copilot-heard">Heard: {snapshot.heard}</div>
        )}
      </div>

      {/* text input */}
      {snapshot.textInput && (
        <form
          className="copilot-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) {
              send(input.trim());
              setInput("");
            }
          }}
        >
          <input
            type="text"
            className="copilot-text-input"
            placeholder="Type your answer…"
            value={input}
            data-testid="call-input"
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            type="submit"
            className="copilot-send-btn"
            data-testid="call-send"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
      )}

      {expanded && (
        <div className="copilot-footnote">
          Fictional demo. You review the form and press the final button.
        </div>
      )}

      {expanded && <OwnerSignIn snapshot={snapshot} />}
    </div>
  );

  return panel;
}
