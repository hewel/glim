import { describe, expect, test } from "vitest";
import { addTextMessage, clearPendingDraft, markTransferProgress } from "./domain";
import type { TextMessage, TransferItem } from "./types";

describe("React domain helpers", () => {
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
});
