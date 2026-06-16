import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

describe("relay transfer UI", () => {
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

  test("shows relay mode in the transfer queue card", () => {
    render(<TransferQueue />);

    const transferCard = screen.getByText("demo.bin").closest("article");
    expect(transferCard).not.toBeNull();
    const card = within(transferCard as HTMLElement);

    expect(card.getByText("Relay")).toBeVisible();
    expect(card.getAllByText("Transferring")[0]).toBeVisible();
    expect(card.getByText("256 B / 1.0 KB")).toBeVisible();
    expect(card.getByRole("button", { name: "Cancel transfer" })).toBeVisible();
  });

  test("shows relay mode in the chat transfer card", () => {
    render(<ChatPanel />);

    const card = within(screen.getByRole("group", { name: "Transfer demo.bin" }));

    expect(card.getByText("Relay")).toBeVisible();
    expect(card.getByText("Transferring")).toBeVisible();
    expect(card.getByText(/256 B \/ 1.0 KB/)).toBeVisible();
    expect(card.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("shows accept and decline for offered receiving transfers", () => {
    useAppStore.setState({
      transfers: [
        {
          ...relayTransfer,
          direction: "receiving",
          status: "offered",
          transferred: 0,
          notice: "Waiting for your response",
        },
      ],
    });

    render(<ChatPanel />);

    const card = within(screen.getByRole("group", { name: "Transfer demo.bin" }));
    expect(card.getByRole("button", { name: "Accept" })).toBeVisible();
    expect(card.getByRole("button", { name: "Decline" })).toBeVisible();
    expect(card.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  test("shows failed transfer notices", () => {
    useAppStore.setState({
      transfers: [
        {
          ...relayTransfer,
          status: "failed",
          notice: "Connection lost.",
        },
      ],
    });

    render(<TransferQueue />);

    const transferCard = screen.getByText("demo.bin").closest("article");
    expect(transferCard).not.toBeNull();
    const card = within(transferCard as HTMLElement);

    expect(card.getByText("Relay")).toBeVisible();
    expect(card.getByText("Failed")).toBeVisible();
    expect(card.getByText("Connection lost.")).toBeVisible();
  });

  test("runs the cancel flow for active transfers", async () => {
    const user = userEvent.setup();
    const cancelFile = vi.fn();
    useAppStore.setState({ cancelFile });

    render(<TransferQueue />);

    await user.click(screen.getByRole("button", { name: "Cancel transfer" }));

    expect(cancelFile).toHaveBeenCalledWith("transfer_1");
  });

  test("shows transfer queue empty state", () => {
    useAppStore.setState({ transfers: [] });

    render(<TransferQueue />);

    expect(screen.getByText("No active transfers.")).toBeVisible();
  });
});
