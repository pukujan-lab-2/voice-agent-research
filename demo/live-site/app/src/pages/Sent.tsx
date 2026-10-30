import { CheckCircle2, ArrowLeft, Home } from "lucide-react";

export default function Sent() {
  return (
    <div className="sent-page">
      <div className="sent-card">
        <div className="check-icon">
          <CheckCircle2 size={40} />
        </div>
        <h1 id="sent">Demo: nothing was sent</h1>
        <p>
          This demo keeps everything in the browser. No data was submitted, stored,
          or sent anywhere. The form you just filled was not transmitted to any server.
        </p>
        <div className="sent-links">
          <a href="/" className="mkt-btn-secondary">
            <Home size={16} /> Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
