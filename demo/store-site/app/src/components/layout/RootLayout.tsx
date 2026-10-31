import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { DemoBar, SiteFooter } from "./DemoChrome";
import { Header } from "./Header";

import { CopilotWidget } from "@/components/copilot/CopilotWidget";

declare global {
  interface Window {
    bwShopper?: () => string;
  }
}

/** Registers the app's client-side navigate with the voice copilot. */
function useCopilotNavigate() {
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe: (() => void) | void;

    const register = () => {
      const handler = (path: string) => {
        if (typeof path === "string" && path.startsWith("/")) navigate(path);
      };
      unsubscribe = window.copilot?.onNavigate?.(handler);
    };

    if (window.copilot?.onNavigate) {
      register();
    } else {
      window.addEventListener("copilot:ready", register);
    }

    return () => {
      window.removeEventListener("copilot:ready", register);
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigate]);
}

export function RootLayout() {
  useCopilotNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="sticky top-0 z-40">
        <DemoBar />
        <Header />
      </div>
      <main className="flex-1 pb-24 lg:pb-0">
        <Outlet />
      </main>
      <SiteFooter />
      <div id="copilot-root">
        <CopilotWidget />
      </div>
    </div>
  );
}
