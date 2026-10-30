import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  Phone,
  Keyboard,
  Mic,
  MicOff,
  X,
  Send,
  Minus,
  BookOpen,
  FormInput,
} from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import type { CopilotMessage } from "@/lib/copilot";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */

function StatusIcon({ status }: { status: string }) {
  if (status === "speaking")
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
    case "thinking": return "Thinking";
    case "muted": return "Mic off";
    case "text": return "Text chat";
    default: return "Idle";
  }
}

/** Turn "(page N)" in message text into links that open the manual in a new tab. */
function renderMessageText(msg: CopilotMessage) {
  const parts: (string | ReactElement)[] = [];
  const regex = /\(page (\d+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(msg.text)) !== null) {
    if (m.index > last) parts.push(msg.text.slice(last, m.index));
    const pageNum = parseInt(m[1], 10);
    const link = msg.links.find((l) => l.page === pageNum);
    if (link) {
      parts.push(
        <a
          key={`link-${key++}`}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="copilot-cite"
        >
          (page {pageNum})
        </a>,
      );
    } else {
      parts.push(`(page ${pageNum})`);
    }
    last = regex.lastIndex;
  }
  if (last < msg.text.length) parts.push(msg.text.slice(last));
  return parts;
}

/* ---------- the component ---------- */

export function CopilotWidget() {
  const { snapshot, start, send, toggleMic, setMode, end } = useCopilot();
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [minimised, setMinimised] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [snapshot.messages]);

  // Tell the copilot how many px at the bottom the panel covers (mobile bottom sheet).
  useEffect(() => {
    if (!snapshot.open || !isMobile) {
      window.copilot?.setCovered(0);
      return;
    }
    const update = () => {
      if (panelRef.current) {
        const h = panelRef.current.offsetHeight;
        window.copilot?.setCovered(minimised ? 56 : h);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [snapshot.open, isMobile, minimised, snapshot.messages]);

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

  const panel = (
    <div
      ref={panelRef}
      className={cn(
        "copilot-panel",
        isMobile ? "copilot-panel-mobile" : "copilot-panel-desktop",
        minimised && isMobile && "copilot-panel-minimised",
        large && "copilot-panel-large",
      )}
      data-testid="call-panel"
      data-busy={snapshot.busy ? "true" : "false"}
      data-typing={snapshot.textInput ? "true" : "false"}
      role="dialog"
      aria-label={`${snapshot.business} copilot call`}
    >
      {/* drag handle look on mobile */}
      {isMobile && (
        <div className="copilot-drag-handle" aria-hidden="true">
          <span />
        </div>
      )}

      {/* header */}
      <div className="copilot-header">
        <div className="copilot-header-top">
          <div className="copilot-header-info">
            <div className={cn("copilot-business", large && "text-lg")}>
              {snapshot.business}
            </div>
            <div className="copilot-promise">
              Fills only what you confirm. Never presses Submit.
            </div>
          </div>
          <div className="copilot-header-controls">
            {isMobile && (
              <button
                type="button"
                className="copilot-icon-btn"
                aria-label={minimised ? "Expand" : "Minimise"}
                onClick={() => setMinimised((v) => !v)}
              >
                {minimised ? <Phone size={18} /> : <Minus size={18} />}
              </button>
            )}
            <button
              type="button"
              className="copilot-icon-btn"
              aria-label="End call"
              data-testid="call-end"
              onClick={end}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* live status */}
        <div className="copilot-status" data-testid="call-status">
          <StatusIcon status={snapshot.status} />
          <span className={cn(large && "text-base")}>
            {statusLabel(snapshot.status)}
          </span>
        </div>
        {/* chips */}
        {snapshot.can.length > 0 && (
          <div className="copilot-chips">
            {snapshot.can.map((c, i) => (
              <span key={i} className="copilot-chip">
                {c}
              </span>
            ))}
          </div>
        )}
        {/* tabs */}
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

      {minimised && isMobile ? null : (
        <>
          {/* messages */}
          <div
            ref={scrollRef}
            className="copilot-messages"
            aria-live="polite"
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
              </div>
            ))}
            {/* live transcript */}
            {snapshot.heard && (
              <div className="copilot-heard">{snapshot.heard}</div>
            )}
          </div>

          {/* controls */}
          <div className="copilot-controls">
            <div className="copilot-controls-row">
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
                {snapshot.mic === "on" ? <Mic size={22} /> : <MicOff size={22} />}
                <span>
                  {snapshot.mic === "on"
                    ? "Mute"
                    : snapshot.mic === "unavailable"
                      ? "No mic"
                      : "Tap to talk"}
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
                <Keyboard size={20} />
                <span>Keyboard</span>
              </button>
              <button
                type="button"
                className="copilot-end-btn"
                aria-label="End call"
                onClick={end}
              >
                <X size={20} />
                <span>End</span>
              </button>
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
                  placeholder="Type your message…"
                  value={input}
                  data-testid="call-input"
                  onChange={(e) => setInput(e.target.value)}
                  autoComplete="off"
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
          </div>

          <div className="copilot-footnote">
            Fictional demo. Voice uses your browser's own speech service.
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* backdrop only on mobile when not minimised */}
      {isMobile && !minimised && (
        <div className="copilot-backdrop" onClick={() => setMinimised(true)} />
      )}
      {panel}
    </>
  );
}
