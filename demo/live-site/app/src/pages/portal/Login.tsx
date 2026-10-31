// Structure inspired by a bank or patient-portal sign-in; Brindlewick's own design.
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useCopilotMount } from "@/hooks/useCopilot";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { SourceViewer } from "@/components/tax/SourceViewer";
import { errorText, getPortalToken, portalSignIn } from "@/lib/practice";

const DEMO_TEXT =
  "Demo: Brindlewick is a fictional firm. Every client and record here is made-up sample data.";

export default function PortalLogin() {
  useCopilotMount(COPILOT_CONFIGS.tax);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    document.title = "Sign in · Brindlewick Client Portal (Demo)";
  }, []);

  if (getPortalToken()) return <Navigate to="/tax/portal/home" replace />;

  const enter = async (body: { demo?: true; call?: string }) => {
    setBusy(true);
    setError("");
    try {
      await portalSignIn(body);
      navigate("/tax/portal/home", { replace: true });
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
      setVerified(false);
    }
  };

  // When the copilot has verified the caller on this call, go straight in as that household.
  const onVerified = () => {
    const call = window.copilot?.verifiedCall?.() ?? "";
    if (!call) return;
    setVerified(true);
    void enter({ call });
  };
  // Arriving from a verified call ("open my client portal"): straight in, no click. The widget may mount a moment later.
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      if (window.copilot?.verifiedCall?.() || ++tries > 20) { clearInterval(t); onVerified(); }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pt-login-root">
      <div className="pt-demobar" data-testid="demo-banner">
        <span className="pt-demobar-dot" aria-hidden="true" />
        <p>{DEMO_TEXT}</p>
      </div>

      <main className="pt-login-main">
        <div className="pt-login-card">
          <span className="pt-mark pt-mark-lg" aria-hidden="true">
            <span className="pt-mark-a" />
            <span className="pt-mark-b" />
            <span className="pt-mark-c" />
          </span>
          <p className="pt-login-firm">Brindlewick</p>
          <h1 className="pt-login-title">Client portal</h1>
          <p className="pt-login-sub">
            Clients sign in with their portal credentials. In this demo, either verify on a voice call
            (the assistant opens your portal) or use the sample client.
          </p>

          {error ? (
            <p className="pt-inline-error" role="alert">
              {error}
            </p>
          ) : null}

          {verified ? (
            <p className="pt-verified">
              <CheckCircle2 size={15} aria-hidden="true" /> Verified on your call
            </p>
          ) : null}

          <button
            type="button"
            className="pt-btn pt-btn-primary pt-btn-block"
            data-testid="portal-login-demo"
            onClick={() => void enter({ demo: true })}
            disabled={busy}
          >
            {busy ? <Loader2 size={16} className="pt-spin" aria-hidden="true" /> : null}
            Open the sample client's portal
          </button>

          <button type="button" className="pt-btn pt-btn-quiet pt-btn-block" onClick={onVerified} disabled={busy}>
            <ShieldCheck size={15} aria-hidden="true" />
            I'm verified on a call
          </button>

          <p className="pt-login-note">
            Demo sign-in, no password. The sample client's details are made up.
          </p>
        </div>
      </main>

      <SourceViewer />
      <CopilotWidget />
    </div>
  );
}
