import { Buffer } from "buffer";
(window as unknown as Record<string, unknown>).Buffer = Buffer;

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
