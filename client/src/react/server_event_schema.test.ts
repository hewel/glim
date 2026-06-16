import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";
import {
  decodeNormalizedServerEvent,
  decodeServerEvent,
  ServerEventDecodeError,
  ServerEventParseError,
} from "./server_event_schema";

describe("server event Effect boundary", () => {
  it.effect("decodes normalized peer list events", () =>
    Effect.gen(function*() {
      const event = yield* decodeNormalizedServerEvent(JSON.stringify({
        kind: "peer_list",
        peers: [
          {
            id: "peer_1",
            display_name: "Peer",
            device_kind: "desktop",
            os: "linux",
            browser: "firefox",
            model: null,
          },
        ],
      }));

      expect(event).toEqual({
        kind: "peer_list",
        peers: [
          {
            id: "peer_1",
            display_name: "Peer",
            device_kind: "desktop",
            os: "linux",
            browser: "firefox",
            model: null,
          },
        ],
      });
    }));

  it.effect("maps unknown device metadata values to unknown", () =>
    Effect.gen(function*() {
      const event = yield* decodeNormalizedServerEvent(JSON.stringify({
        kind: "peer_joined",
        peer: {
          id: "peer_1",
          display_name: "Peer",
          device_kind: "watch",
          os: "templeos",
          browser: "netscape",
          model: "Prototype",
        },
      }));

      expect(event).toEqual({
        kind: "peer_joined",
        peer: {
          id: "peer_1",
          display_name: "Peer",
          device_kind: "unknown",
          os: "unknown",
          browser: "unknown",
          model: "Prototype",
        },
      });
    }));

  it.effect("returns the existing invalid event for malformed wire JSON", () =>
    Effect.gen(function*() {
      const event = yield* decodeServerEvent("{not json");

      expect(event).toEqual({
        kind: "invalid",
        message: "Unable to parse server event",
      });
    }));

  it.effect("fails malformed normalized JSON with a typed parse error", () =>
    Effect.gen(function*() {
      const failure = yield* Effect.flip(decodeNormalizedServerEvent("{not json"));

      expect(failure).toBeInstanceOf(ServerEventParseError);
    }));

  it.effect("fails malformed normalized event shape with a typed decode error", () =>
    Effect.gen(function*() {
      const failure = yield* Effect.flip(decodeNormalizedServerEvent(JSON.stringify({
        kind: "peer_left",
      })));

      expect(failure).toBeInstanceOf(ServerEventDecodeError);
    }));
});
