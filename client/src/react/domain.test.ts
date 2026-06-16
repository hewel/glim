import { describe, expect, test } from "vitest";
import {
  activeTransferCount,
  addTransferHistory,
  addIncomingTransfer,
  addTextMessage,
  clearPendingDraft,
  forgetPeer,
  isRelayFileSizeAllowed,
  markConnectionLost,
  markTransferProgress,
  maxRelayFileSizeBytes,
  otherPeers,
  rememberMissingPeers,
  transferCanContinue,
} from "./domain";
import type { Peer, TextMessage, TransferHistory, TransferItem } from "./types";

const peer: Peer = {
  id: "peer_1",
  display_name: "Peer",
  device_kind: "phone",
  os: "android",
  browser: "chrome",
  model: null,
};

const relayTransfer: TransferItem = {
  transfer_id: "transfer_1",
  peer_id: "peer_1",
  peer_name: "Peer",
  name: "demo.bin",
  mime_type: "application/octet-stream",
  size: 4,
  transferred: 0,
  download_url: null,
  direction: "sending",
  mode: "relay",
  status: "transferring",
  notice: "Transferring",
};

const completedHistory: TransferHistory = {
  transfer_id: "transfer_history_1",
  client_offer_id: "offer_1",
  from_device_id: "self",
  from_display_name: "Self",
  to_device_id: "peer_1",
  to_display_name: "Peer",
  file_name: "archive.zip",
  file_size: 10,
  mime_type: "application/zip",
  final_status: "completed",
  transferred_bytes: 10,
  reason: null,
  recorded_at_ms: 1000,
};

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

  test("clears only the draft acknowledged by the server", () => {
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
    const ada: Peer = {
      id: "ada",
      display_name: "Ada",
      device_kind: "desktop",
      os: "linux",
      browser: "firefox",
      model: null,
    };

    expect(forgetPeer({ peer_1: peer, ada }, "peer_1")).toEqual({ ada });
  });

  test("history peers do not overwrite richer known peer metadata", () => {
    const historyPeer: Peer = {
      ...peer,
      display_name: "History Peer",
      device_kind: "unknown",
      os: "unknown",
      browser: "unknown",
    };

    expect(rememberMissingPeers({ peer_1: peer }, [historyPeer])).toEqual({
      peer_1: peer,
    });
  });

  test("adds relay incoming transfers when HTTP relay is available", () => {
    const transfers = addIncomingTransfer(
      [],
      {
        transfer_id: "transfer_1",
        client_offer_id: null,
        from: "peer_1",
        to: "self",
        name: "demo.bin",
        size: 4,
        mime_type: "application/octet-stream",
      },
      "Peer",
      "relay",
    );

    expect(transfers[0]).toMatchObject({
      direction: "receiving",
      mode: "relay",
      status: "offered",
      notice: "Waiting for your response",
    });
  });

  test("marks unsupported incoming transfers when HTTP relay is unavailable", () => {
    const transfers = addIncomingTransfer(
      [],
      {
        transfer_id: "transfer_1",
        client_offer_id: null,
        from: "peer_1",
        to: "self",
        name: "demo.bin",
        size: 4,
        mime_type: "application/octet-stream",
      },
      "Peer",
      "unsupported",
    );

    expect(transfers[0]).toMatchObject({
      mode: "relay",
      status: "unsupported",
      notice: "HTTP relay download is not supported in this browser",
    });
  });

  test("maps replayed transfer history into read-only transfer cards", () => {
    const transfers = addTransferHistory([], "self", [completedHistory]);

    expect(transfers[0]).toMatchObject({
      transfer_id: "transfer_history_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "archive.zip",
      direction: "sending",
      mode: "relay",
      status: "completed",
      transferred: 10,
      download_url: null,
      notice: "Completed",
    });
  });

  test("does not duplicate replayed history over live transfers", () => {
    const transfers = addTransferHistory(
      [relayTransfer],
      "self",
      [{ ...completedHistory, transfer_id: "transfer_1" }],
    );

    expect(transfers).toEqual([relayTransfer]);
  });

  test("marks relay upload progress as transferring", () => {
    const updated = markTransferProgress([relayTransfer], {
      transfer_id: "transfer_1",
      phase: "uploading",
      bytes: 4,
      total: 4,
    });

    expect(updated[0]).toMatchObject({
      transferred: 4,
      status: "transferring",
      notice: "Uploading",
    });
  });

  test("keeps partial relay upload progress transferring", () => {
    const updated = markTransferProgress([relayTransfer], {
      transfer_id: "transfer_1",
      phase: "uploading",
      bytes: 2,
      total: 4,
    });

    expect(updated[0]).toMatchObject({
      transferred: 2,
      status: "transferring",
      notice: "Uploading",
    });
  });

  test("connection loss fails active relay transfers only", () => {
    const completed: TransferItem = {
      ...relayTransfer,
      transfer_id: "done",
      status: "completed",
      notice: "Complete",
    };

    const updated = markConnectionLost([relayTransfer, completed]);

    expect(updated[0]).toMatchObject({ status: "failed", notice: "Connection lost." });
    expect(updated[1]).toBe(completed);
  });

  test("active transfer helpers count only actionable states", () => {
    expect(transferCanContinue([relayTransfer], "transfer_1")).toBe(true);
    expect(transferCanContinue([{ ...relayTransfer, status: "failed" }], "transfer_1")).toBe(false);
    expect(activeTransferCount([
      relayTransfer,
      { ...relayTransfer, transfer_id: "transfer_2", status: "ready" },
      { ...relayTransfer, transfer_id: "transfer_3", status: "completed" },
    ])).toBe(2);
  });

  test("uses the relay file size limit before sending offers", () => {
    expect(isRelayFileSizeAllowed(maxRelayFileSizeBytes)).toBe(true);
    expect(isRelayFileSizeAllowed(maxRelayFileSizeBytes + 1)).toBe(false);
  });
});
