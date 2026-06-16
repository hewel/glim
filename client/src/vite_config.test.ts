import { describe, expect, test } from "vitest";
import type { UserConfig } from "vite";
import config from "../vite.config";

describe("Vite dev server proxy", () => {
  test("forwards relay transfer HTTP endpoints to the Gleam server", () => {
    const userConfig = config as UserConfig;

    expect(userConfig.server?.proxy).toMatchObject({
      "/api": {
        target: "http://127.0.0.1:9143",
      },
      "/ws": {
        target: "ws://127.0.0.1:9143",
        ws: true,
      },
    });
  });
});
