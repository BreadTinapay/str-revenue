import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// No <StrictMode> here: its dev-only double-invoke of effects doesn't play
// well with Radix's scroll-lock cleanup (used by Select/Dialog) — it can
// leave `pointer-events: none` stuck on <body>, freezing the whole page.
// This is a known Radix + StrictMode interaction, not specific to our code.
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
