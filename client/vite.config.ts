import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from '@vitejs/plugin-react';
import gleam from "vite-gleam";

function stripBaseUiClientDirective(): Plugin {
  return {
    name: "strip-base-ui-client-directive",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("@base-ui")) {
        return null;
      }

      return {
        code: code.replace(/^((?:\/\*[\s\S]*?\*\/\s*)*)(['"])use client\2;\s*/, "$1"),
        map: null,
      };
    },
  };
}

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "../priv/static",
  },
  plugins: [gleam(), stripBaseUiClientDirective(), react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ws": {
        target: "ws://127.0.0.1:9143",
        ws: true,
      },
    },
  },
});
