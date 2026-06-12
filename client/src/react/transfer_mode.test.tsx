import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ChatPanel } from "./ChatPanel";
import { TransferQueue } from "./TransferQueue";
import { useAppStore } from "./store";
import type { Peer, TransferItem } from "./types";

const peer: Peer = {
  id: "peer_1",
  display_name: "Ada Laptop",
  device_kind: "desktop",
  os: "linux",
  browser: "firefox",
  model: null,
};

const relayTransfer: TransferItem = {
  transfer_id: "transfer_1",
  peer_id: peer.id,
  peer_name: peer.display_name,
  name: "demo.bin",
  mime_type: "application/octet-stream",
  size: 1024,
  transferred: 256,
  direction: "sending",
  status: "transferring",
  notice: "Transferring",
  mode: "relay",
};

describe("transfer mode labels", () => {
  beforeEach(() => {
    useAppStore.setState({
      deviceId: "self",
      selectedPeerId: peer.id,
      peers: [peer],
      knownPeers: { [peer.id]: peer },
      transfers: [relayTransfer],
      messagesByPeer: {},
      messageDrafts: {},
      unreadByPeer: {},
      chatNotice: null,
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({
      selectedPeerId: null,
      peers: [],
      knownPeers: {},
      transfers: [],
      messagesByPeer: {},
      messageDrafts: {},
      unreadByPeer: {},
      chatNotice: null,
    });
  });

  test("shows relay mode in the transfer workspace card", () => {
    render(<TransferQueue />);

    const transferCard = screen.getByText("demo.bin").closest("article");
    expect(transferCard).not.toBeNull();
    expect(within(transferCard as HTMLElement).getByText("Relay")).toBeVisible();
  });

  test("shows relay mode in the chat transfer card", () => {
    render(<ChatPanel />);

    const transferCard = screen.getByText("demo.bin").closest("div");
    expect(transferCard).not.toBeNull();
    expect(screen.getByText("Relay")).toBeVisible();
  });

  test("keeps essential transfer state visible in the compact chat card", () => {
    useAppStore.setState({
      transfers: [
        {
          ...relayTransfer,
          transfer_id: "p2p_setup",
          mode: "p2p",
          status: "p2p_setup",
          transferred: 512,
          notice: "Opening peer channel",
          piece_summary: { active: 2, verified: 3, failed: 1, total: 8 },
        },
      ],
    });

    render(<ChatPanel />);

    const card = within(screen.getByRole("group", { name: "Transfer demo.bin" }));

    expect(card.getByText("P2P")).toBeVisible();
    expect(card.getByText("P2P setup")).toBeVisible();
    expect(card.getByText(/512 B \/ 1.0 KB/)).toBeVisible();
    expect(card.getByText("Active 2")).toBeVisible();
    expect(card.getByText("Verified 3 / 8")).toBeVisible();
    expect(card.getByText("Failed 1")).toBeVisible();
    expect(card.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("shows transfer cockpit details for an active transfer", () => {
    render(<TransferQueue />);

    const transferCard = screen.getByText("demo.bin").closest("article");
    expect(transferCard).not.toBeNull();
    const card = within(transferCard as HTMLElement);

    expect(card.getByText("Relay")).toBeVisible();
    expect(card.getByText(/Ada Laptop/)).toBeVisible();
    expect(card.getAllByText("Transferring")[0]).toBeVisible();
    expect(card.getByText("256 B / 1.0 KB")).toBeVisible();
    expect(card.getByRole("button", { name: "Cancel transfer" })).toBeVisible();
  });

  test("shows transfer cockpit empty state", () => {
    useAppStore.setState({ transfers: [] });

    render(<TransferQueue />);

    expect(screen.getByText("No active transfers.")).toBeVisible();
  });

  test("reserves transfer cockpit states for P2P progress", () => {
    const futureStates: TransferItem[] = [
      { ...relayTransfer, transfer_id: "hashing", name: "hashing.bin", status: "hashing", notice: "Preparing manifest" },
      { ...relayTransfer, transfer_id: "setup", name: "setup.bin", mode: "p2p", status: "p2p_setup", notice: "Opening peer channel" },
      { ...relayTransfer, transfer_id: "connected", name: "connected.bin", mode: "p2p", status: "p2p_connected", notice: "P2P channels connected" },
      {
        ...relayTransfer,
        transfer_id: "active",
        name: "active.bin",
        mode: "p2p",
        piece_summary: { active: 2, verified: 7, failed: 1, total: 12 },
      },
      { ...relayTransfer, transfer_id: "interrupted", name: "interrupted.bin", mode: "p2p", status: "interrupted", notice: "Peer disconnected" },
      { ...relayTransfer, transfer_id: "resumable", name: "resumable.bin", mode: "p2p", status: "resumable", notice: "Resume available" },
      { ...relayTransfer, transfer_id: "export", name: "export.bin", mode: "p2p", status: "export_ready", notice: "Ready to save" },
      { ...relayTransfer, transfer_id: "fallback", name: "fallback.bin", status: "fallback", notice: "Using relay fallback" },
      { ...relayTransfer, transfer_id: "complete", name: "complete.bin", status: "completed", notice: "Complete" },
      { ...relayTransfer, transfer_id: "cancelled", name: "cancelled.bin", status: "cancelled", notice: "Cancelled" },
    ];
    useAppStore.setState({ transfers: futureStates });

    render(<TransferQueue />);

    expect(screen.getByText("Hashing")).toBeVisible();
    expect(screen.getByText("P2P setup")).toBeVisible();
    expect(screen.getByText("P2P connected")).toBeVisible();
    expect(screen.getByText("Active 2")).toBeVisible();
    expect(screen.getByText("Verified 7 / 12")).toBeVisible();
    expect(screen.getByText("Failed 1")).toBeVisible();
    expect(screen.getByText("Interrupted")).toBeVisible();
    expect(screen.getByText("Resumable")).toBeVisible();
    expect(screen.getByText("Export ready")).toBeVisible();
    expect(screen.getByText("Fallback")).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getAllByText("Cancelled")[0]).toBeVisible();
  });
});
