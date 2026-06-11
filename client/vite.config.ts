import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import gleam from "vite-gleam";

function patchGeneratedLustreJs(): Plugin {
  return {
    name: "patch-generated-lustre-js",
    enforce: "pre",
    transform(code, id) {
      if (id.endsWith("lustre/lustre/internals/constants.ffi.mjs")) {
        return {
          code: code.replace("/* @__PURE__ */ ", ""),
          map: null,
        };
      }

      if (id.endsWith("lustre/lustre/runtime/server/runtime.ffi.mjs")) {
        return {
          code: code.replaceAll("Dict.delete(", "Dict.delete$("),
          map: null,
        };
      }

      return null;
    },
  };
}

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "../priv/static",
  },
  plugins: [gleam(), patchGeneratedLustreJs(), tailwindcss()],
  resolve: {
    alias: {
      "@browser/ffi": fileURLToPath(new URL("./src/browser/ffi.ts", import.meta.url)),
    },
  },
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
