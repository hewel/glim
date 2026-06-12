import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "../core.gleam",
        replacement: fileURLToPath(new URL("./build/dev/javascript/client/core.mjs", import.meta.url)),
      },
      {
        find: "../reconnect.gleam",
        replacement: fileURLToPath(new URL("./build/dev/javascript/client/reconnect.mjs", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
