// Structure inspired by practice-management client pages; Brindlewick's own design.
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { useCopilotMount } from "@/hooks/useCopilot";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { SourceViewer } from "@/components/tax/SourceViewer";
import {
  DEMO_STAFF,
  errorText,
  getStaffToken,
  staffSignIn,
} from "@/lib/practice";

const DEMO_TEXT =
  "Demo: Brindlewick is a fictional firm. Every client and record here is made-up sample data.";

function Mark() {
  return (
    <span className="bw-mark bw-mark-lg" aria-hidden="true">
      <span className="bw-mark-a" />
      <span className="bw-mark-b" />
      <span className="bw-mark-c" />
    </span>
  );
}

export default function StaffLogin() {
  useCopilotMount(COPILOT_CONFIGS.staff);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [other, setOther] = useState("st-mva");

  useEffect(() => {
    document.title = "Sign in · Brindlewick Practice (Demo)";
  }, []);

  if (getStaffToken()) return <Navigate to="/staff/dashboard" replace />;

  const signIn = async (staffId?: string) => {
    setBusy(true);
    setError("");
    try {
      await staffSignIn(staffId);
      navigate("/staff/dashboard", { replace: true });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="bw-login-root">
      <div className="bw-demobar" data-testid="demo-banner">
        <span className="bw-demobar-dot" aria-hidden="true" />
        <p>{DEMO_TEXT}</p>
      </div>

      <main className="bw-login-main">
        <div className="bw-login-card">
          <div className="bw-login-brand">
            <Mark />
            <div>
              <p className="bw-login-firm">Brindlewick</p>
              <p className="bw-login-app">Practice app</p>
            </div>
          </div>

          <h1 className="bw-login-title">Sign in to the practice</h1>
          <p className="bw-login-sub">
            Households, returns, notices, billing and messages for the firm's fourteen staff.
          </p>

          {error ? (
            <p className="bw-inline-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className="bw-login-primary"
            data-testid="staff-login"
            onClick={() => void signIn("st-pra")}
            disabled={busy}
          >
            <span className="bw-login-primary-text">
              Continue as Priya Raghunathan, CPA
              <span className="bw-login-primary-role">Tax Manager</span>
            </span>
            {busy ? <Loader2 size={16} className="bw-spin" /> : <ArrowRight size={16} />}
          </button>

          <div className="bw-login-other">
            <label htmlFor="staff-other">Sign in as someone else</label>
            <select
              id="staff-other"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              disabled={busy}
            >
              {DEMO_STAFF.filter((s) => s.id !== "st-pra").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="bw-btn bw-btn-quiet bw-btn-sm"
              onClick={() => void signIn(other)}
              disabled={busy}
            >
              Continue
            </button>
          </div>

          <p className="bw-login-note">
            Demo sign-in, no password. Every record is fictional.
          </p>
        </div>
      </main>

      <SourceViewer />
      <CopilotWidget />
    </div>
  );
}
