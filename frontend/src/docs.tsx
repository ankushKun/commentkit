/**
 * Documentation page entry point
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DocsPage } from "./components/docs-page";
import "./index.css";

const elem = document.getElementById("root")!;
const app = (
  <DocsPage />
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}
