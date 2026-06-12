import { describe, expect, test } from "vitest";
import {
  addTextMessage,
  clearPendingDraft,
  forgetPeer,
  markP2pSetupFailed,
  markTransferProgress,
  otherPeers,
} from "./domain";
import type { Peer, TextMessage, TransferItem } from "./types";

describe("React domain helpers", () => {
  test("filters the local device out of peer lists", () => {
    const self: Peer = {
      id: "self",
      display_name: "Self",
      device_kind: "desktop",
      os: "linux",
      browser: "firefox",
      model: null,
    };
    const peer: Peer = {
      id: "peer_1",
      display_name: "Peer",
      device_kind: "phone",
      os: "android",
      browser: "chrome",
      model: null,
    };

    expect(otherPeers([self, peer], "self")).toEqual([peer]);
  });

  test("groups messages by the remote peer and ignores duplicate ids", () => {
    const message: TextMessage = {
      id: "msg_1",
      from: "self",
      to: "peer_1",
      body: "hello",
      created_at_ms: 1000,
    };

    const once = addTextMessage({}, "self", message);
    const twice = addTextMessage(once, "self", message);

    expect(twice.peer_1).toEqual([message]);
  });

  test("clears only the draft that was acknowledged by the server", () => {
    const cleared = clearPendingDraft(
      { to: "peer_1", body: "sent" },
      { peer_1: "sent", peer_2: "keep" },
      {
        id: "msg_1",
        from: "self",
        to: "peer_1",
        body: "sent",
        created_at_ms: 1000,
      },
    );

    expect(cleared).toEqual({
      messageDrafts: { peer_2: "keep" },
      pendingDraftClear: null,
    });
  });

  test("forgets stale peer metadata", () => {
    const bob: Peer = {
      id: "bob",
      display_name: "Bob Phone",
      device_kind: "phone",
      os: "android",
      browser: "chrome",
      model: "Pixel 8",
    };
    const ada: Peer = {
      id: "ada",
      display_name: "Ada",
      device_kind: "desktop",
      os: "linux",
      browser: "firefox",
      model: null,
    };

    expect(forgetPeer({ bob, ada }, "bob")).toEqual({ ada });
  });

  test("marks final file acknowledgements as completed", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 4,
      transferred: 0,
      direction: "sending",
      mode: "relay",
      status: "transferring",
      notice: "Transferring",
    };

    const updated = markTransferProgress([transfer], {
      transfer_id: "transfer_1",
      sequence: 0,
      offset: 0,
      byte_length: 4,
      final: true,
    });

    expect(updated[0]).toMatchObject({
      transferred: 4,
      status: "completed",
      notice: "Complete",
    });
  });

  test("falls back to relay when P2P setup fails before progress", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 4,
      transferred: 0,
      direction: "sending",
      mode: "p2p",
      status: "p2p_setup",
      notice: "Opening peer channel",
    };

    const updated = markP2pSetupFailed(
      [transfer],
      "transfer_1",
      "P2P setup failed before transfer progress.",
    );

    expect(updated[0]).toMatchObject({
      mode: "relay",
      status: "fallback",
      notice: "P2P setup failed before transfer progress.",
    });
  });

  test("does not relay-fallback after P2P transfer progress exists", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 4,
      transferred: 2,
      direction: "sending",
      mode: "p2p",
      status: "transferring",
      notice: "Transferring",
    };

    const updated = markP2pSetupFailed(
      [transfer],
      "transfer_1",
      "P2P channel interrupted.",
    );

    expect(updated[0]).toMatchObject({
      mode: "p2p",
      status: "failed",
      notice: "P2P channel interrupted.",
    });
  });
});
