import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { installShopper } from "./lib/shopper";
import "./globals.css";
import "./copilot.css";

installShopper();

createRoot(document.getElementById("root")!).render(<App />);
