import { describe, expect, test } from "vitest";
import {
  addIncomingTransfer,
  addTextMessage,
  clearPendingDraft,
  forgetPeer,
  firstMissingPieceRequest,
  fillReceiverPieceWindow,
  markReceiverPieceVerified,
  markP2pSetupFailed,
  markPieceVerified,
  markTransferProgress,
  otherPeers,
  pieceChunkPlan,
  retryPieceRequest,
  transferCanContinue,
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

  test("does not complete a P2P transfer from the final chunk alone", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 4,
      transferred: 0,
      direction: "receiving",
      mode: "p2p",
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
      status: "transferring",
      notice: "Transferring",
    });
  });

  test("adds P2P-eligible incoming transfers in P2P mode", () => {
    const transfers = addIncomingTransfer(
      [],
      {
        transfer_id: "transfer_1",
        from: "peer_1",
        to: "me",
        name: "demo.bin",
        size: 4,
        mime_type: "application/octet-stream",
      },
      "Peer",
      "p2p",
    );

    expect(transfers[0]).toMatchObject({
      direction: "receiving",
      mode: "p2p",
      status: "offered",
      notice: "Waiting for your response",
    });
  });

  test("adds relay-only incoming transfers in relay mode", () => {
    const transfers = addIncomingTransfer(
      [],
      {
        transfer_id: "transfer_1",
        from: "peer_1",
        to: "me",
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

  test("stops transfer work after cancellation", () => {
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
      status: "cancelled",
      notice: "Cancelled",
    };

    expect(transferCanContinue([transfer], "transfer_1")).toBe(false);
    expect(transferCanContinue([{ ...transfer, status: "transferring" }], "transfer_1")).toBe(
      true,
    );
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

  test("keeps P2P mode resumable after transfer progress exists", () => {
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
      status: "resumable",
      notice: "P2P channel interrupted. Resume available.",
    });
  });

  test("marks interrupted P2P transfer progress as resumable", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 12,
      transferred: 4,
      direction: "receiving",
      mode: "p2p",
      status: "p2p_connected",
      notice: "Piece verified",
      piece_summary: { active: 1, verified: 1, failed: 0, total: 3 },
    };

    const updated = markP2pSetupFailed(
      [transfer],
      "transfer_1",
      "P2P channel interrupted.",
    );

    expect(updated[0]).toMatchObject({
      mode: "p2p",
      status: "resumable",
      notice: "P2P channel interrupted. Resume available.",
      transferred: 4,
      piece_summary: { active: 0, verified: 1, failed: 0, total: 3 },
    });
  });

  test("schedules the first piece when a transfer manifest is accepted", () => {
    expect(
      firstMissingPieceRequest({
        kind: "transfer_manifest_accepted",
        transfer_id: "transfer_1",
        manifest_id: "manifest_1",
        file_id: "file_1",
        piece_size: 4,
        piece_sha256: "hash_1",
        pieces: [{ piece_index: 0, piece_size: 4, piece_sha256: "hash_1" }],
      }),
    ).toEqual({
      manifest_id: "manifest_1",
      file_id: "file_1",
      piece_index: 0,
      piece_size: 4,
      piece_sha256: "hash_1",
      attempts: 1,
    });
  });

  test("plans chunks inside a requested piece boundary", () => {
    expect(pieceChunkPlan({
      piece_index: 1,
      piece_size: 5,
      file_size: 12,
      chunk_size: 3,
    })).toEqual([
      { sequence: 0, offset: 5, byte_length: 3 },
      { sequence: 1, offset: 8, byte_length: 2 },
    ]);
  });

  test("keeps transfer pending until every piece is verified", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 4,
      transferred: 4,
      direction: "receiving",
      mode: "p2p",
      status: "transferring",
      notice: "Transferring",
    };

    const updated = markPieceVerified([transfer], "transfer_1", {
      manifest_id: "manifest_1",
      file_id: "file_1",
      pieces: [
        { piece_index: 0, piece_size: 4, piece_sha256: "hash_0" },
        { piece_index: 1, piece_size: 4, piece_sha256: "hash_1" },
      ],
      active: [
        {
          manifest_id: "manifest_1",
          file_id: "file_1",
          piece_index: 1,
          piece_size: 4,
          piece_sha256: "hash_1",
          attempts: 1,
        },
      ],
      verified: [0],
    });

    expect(updated[0]).toMatchObject({
      status: "p2p_connected",
      notice: "Piece verified",
      piece_summary: { active: 1, verified: 1, failed: 0, total: 2 },
    });
  });

  test("marks transfer export-ready after every piece is verified", () => {
    const transfer: TransferItem = {
      transfer_id: "transfer_1",
      peer_id: "peer_1",
      peer_name: "Peer",
      name: "demo.bin",
      mime_type: "application/octet-stream",
      size: 8,
      transferred: 8,
      direction: "receiving",
      mode: "p2p",
      status: "transferring",
      notice: "Transferring",
    };

    const updated = markPieceVerified([transfer], "transfer_1", {
      manifest_id: "manifest_1",
      file_id: "file_1",
      pieces: [
        { piece_index: 0, piece_size: 4, piece_sha256: "hash_0" },
        { piece_index: 1, piece_size: 4, piece_sha256: "hash_1" },
      ],
      active: [],
      verified: [0, 1],
    });

    expect(updated[0]).toMatchObject({
      status: "export_ready",
      notice: "Ready to export",
      piece_summary: { active: 0, verified: 2, failed: 0, total: 2 },
    });
  });

  test("bounds piece hash mismatch retries to three attempts", () => {
    const request = {
      manifest_id: "manifest_1",
      file_id: "file_1",
      piece_index: 0,
      piece_size: 4,
      piece_sha256: "hash_1",
      attempts: 1,
    };

    expect(retryPieceRequest(request)).toMatchObject({ attempts: 2 });
    expect(retryPieceRequest({ ...request, attempts: 2 })).toMatchObject({ attempts: 3 });
    expect(retryPieceRequest({ ...request, attempts: 3 })).toBeNull();
  });

  test("pulls missing pieces up to the active piece limit", () => {
    const schedule = fillReceiverPieceWindow(
      {
        manifest_id: "manifest_1",
        file_id: "file_1",
        pieces: [
          { piece_index: 0, piece_size: 4, piece_sha256: "hash_0" },
          { piece_index: 1, piece_size: 4, piece_sha256: "hash_1" },
          { piece_index: 2, piece_size: 2, piece_sha256: "hash_2" },
        ],
        active: [],
        verified: [],
      },
      2,
    );

    expect(schedule.requests.map((piece) => piece.piece_index)).toEqual([0, 1]);
    expect(schedule.state.active.map((piece) => piece.piece_index)).toEqual([0, 1]);

    const afterFirstVerified = fillReceiverPieceWindow(
      markReceiverPieceVerified(schedule.state, 0),
      2,
    );

    expect(afterFirstVerified.requests.map((piece) => piece.piece_index)).toEqual([2]);
    expect(afterFirstVerified.state.active.map((piece) => piece.piece_index)).toEqual([1, 2]);
  });
});
