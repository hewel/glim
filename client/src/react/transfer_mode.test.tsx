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
});
