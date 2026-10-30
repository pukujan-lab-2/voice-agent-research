import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

/**
 * The app waits for window.copilot or the copilot:ready event before mounting,
 * so the call panel always has the SDK available on first render.
 */
function mountApp() {
  createRoot(document.getElementById("root")!).render(<App />);
}

if (window.copilot) {
  mountApp();
} else {
  window.addEventListener("copilot:ready", mountApp, { once: true });
  // Safety net: mount after 2s even if the event never fires.
  setTimeout(() => {
    const root = document.getElementById("root");
    if (root && !root.hasChildNodes()) mountApp();
  }, 2000);
}
