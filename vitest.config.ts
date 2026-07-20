import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vitest config for the HQ Agent (and future) tests. `server-only` is aliased to
// an empty module so server modules load under test; OpenAI is never called (we
// mock the network boundary / auth guard). Node env by default; component tests
// opt into jsdom via a `// @vitest-environment jsdom` file docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/empty.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
});
