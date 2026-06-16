import { Effect } from "effect";
import { afterEach, describe, expect, it, test } from "@effect/vitest";
import { loadIdentity, loadIdentityEffect } from "./identity";

describe("browser identity", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test("keeps one peer id across reloads in the same tab session", () => {
    localStorage.setItem("glim.device_id", "install-device");

    const first = loadIdentity();
    const second = loadIdentity();

    expect(first.device_id).toBe(second.device_id);
    expect(first.device_id).toMatch(/^install-device:/);
  });

  test("creates a different peer id for a new tab session sharing the same browser id", () => {
    localStorage.setItem("glim.device_id", "install-device");

    const first = loadIdentity();
    sessionStorage.clear();
    const second = loadIdentity();

    expect(first.device_id).not.toBe(second.device_id);
    expect(first.device_id).toMatch(/^install-device:/);
    expect(second.device_id).toMatch(/^install-device:/);
  });

  it.effect("loads identity through the Effect boundary", () =>
    Effect.gen(function*() {
      localStorage.setItem("glim.device_id", "install-device");

      const identity = yield* loadIdentityEffect();

      expect(identity.device_id).toMatch(/^install-device:/);
      expect(identity.display_name).toBe("Glim Peer");
      expect(identity.device_profile.kind).toBe("unknown");
    }));
});
