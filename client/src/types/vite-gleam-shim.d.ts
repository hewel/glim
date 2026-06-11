declare module "vite-gleam" {
  import type { Plugin } from "vite";

  export default function gleamVite(): Promise<Plugin>;
}
