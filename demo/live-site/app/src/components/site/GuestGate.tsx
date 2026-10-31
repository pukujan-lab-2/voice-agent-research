import { Lock } from "lucide-react";

/** Shown when a visitor reaches a form page without a guest session. */
export function GuestGate({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="guest-gate">
      <div className="guest-gate-card">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "3rem",
            height: "3rem",
            borderRadius: "50%",
            background: "hsl(var(--site-accent-soft))",
            color: "hsl(var(--site-accent))",
            marginBottom: "1rem",
          }}
        >
          <Lock size={24} />
        </div>
        <h2>Sign in to continue</h2>
        <p>
          This is a demo. There's no real sign-in — just continue as a guest to see
          the page and try the copilot.
        </p>
        <button
          type="button"
          className="site-btn"
          data-testid="guest-enter"
          onClick={onEnter}
          style={{ width: "100%" }}
        >
          Continue as guest
        </button>
      </div>
    </div>
  );
}
