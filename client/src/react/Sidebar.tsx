import {
  IconFolder,
  IconHelpCircle,
  IconMessageCircle,
  IconSettings,
  IconShare,
  IconTerminal2,
  IconUsers,
} from "@tabler/icons-react";
import { type ReactNode, useState, useEffect } from "react";
import { initials } from "./format";
import { useAppStore } from "./store";
import type { ConnectionStatus, Peer } from "./types";

export function Sidebar() {
  const status = useAppStore((state) => state.status);
  const peers = useAppStore((state) => state.peers);
  const knownPeers = useAppStore((state) => state.knownPeers);
  const selectedPeerId = useAppStore((state) => state.selectedPeerId);
  const unreadByPeer = useAppStore((state) => state.unreadByPeer);
  const selectPeer = useAppStore((state) => state.selectPeer);
  const setLogOpen = useAppStore((state) => state.setLogOpen);

  const knownPeerList = Object.values(knownPeers);
  const visiblePeers = knownPeerList.length > 0 ? knownPeerList : peers;

  return (
    <div className="flex h-full min-h-[calc(100vh-5rem)] flex-col p-5">
      <section className="mb-8 flex items-start gap-4">
        <div className="grid size-14 place-items-center rounded-full bg-primary text-on-primary">
          <IconShare size={28} />
        </div>
        <div>
          <h2 className="font-headline-sm">Local Mesh</h2>
          <p className="font-label-md text-tertiary">{meshStatusLabel(status)}</p>
        </div>
      </section>

      <nav className="space-y-2">
        <NavItem icon={<IconUsers size={23} />} label="Peers" />
        <NavItem active icon={<IconMessageCircle size={23} />} label="Chats" badge={unreadTotal(unreadByPeer)} />
        <NavItem icon={<IconFolder size={23} />} label="Library" />
        <NavItem icon={<IconSettings size={23} />} label="Settings" />
      </nav>

      <section className="mt-7 min-h-0 flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        {visiblePeers.length === 0 ? (
          <div className="rounded-md border border-outline-variant bg-surface-container p-4 text-sm text-on-surface-variant">
            Waiting for peers.
          </div>
        ) : (
          visiblePeers.map((peer) => (
            <PeerButton
              key={peer.id}
              online={peers.some((onlinePeer) => onlinePeer.id === peer.id)}
              peer={peer}
              selected={selectedPeerId === peer.id}
              unread={unreadByPeer[peer.id] ?? 0}
              onSelect={() => selectPeer(peer.id)}
            />
          ))
        )}
      </section>

      <footer className="mt-5 border-outline-variant border-t pt-5 space-y-2">
        <UserProfileCard />
        <div className="flex gap-2 pt-2 border-t border-outline-variant/50">
          <button
            onClick={() => alert("LocalLink Help:\n\n1. Make sure your devices are on the same Wi-Fi / Local Area Network.\n2. Open this page on another device.\n3. Type your message and click Send.\n4. To transfer a file, select a peer, click 'Share File', and wait for them to accept it.")}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-body-md text-on-surface-variant hover:bg-surface-container transition border border-transparent hover:border-outline-variant/30"
            type="button"
          >
            <IconHelpCircle size={18} />
            <span>Support</span>
          </button>
          <button
            onClick={() => setLogOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-body-md text-on-surface-variant hover:bg-surface-container transition border border-transparent hover:border-outline-variant/30"
            type="button"
          >
            <IconTerminal2 size={18} />
            <span>Logs</span>
          </button>
        </div>
      </footer>
    </div>
  );
}

export function UserProfileCard() {
  const displayName = useAppStore((state) => state.displayName);
  const setDisplayName = useAppStore((state) => state.setDisplayName);
  const [isEditing, setIsEditing] = useState(false);
  const [val, setVal] = useState(displayName);

  useEffect(() => {
    setVal(displayName);
  }, [displayName]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary bg-surface-container px-3 py-2 animate-fade-in shadow-inner">
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (val.trim() && val.trim() !== displayName) {
              setDisplayName(val.trim());
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setIsEditing(false);
              if (val.trim() && val.trim() !== displayName) {
                setDisplayName(val.trim());
              }
            } else if (e.key === "Escape") {
              setIsEditing(false);
              setVal(displayName);
            }
          }}
          autoFocus
          maxLength={64}
          className="flex-1 bg-transparent font-body-md text-on-surface outline-none border-b border-primary/20 px-1 py-0.5"
          placeholder="Enter display name..."
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="flex w-full items-center justify-between rounded-lg bg-surface-container px-4 py-3 hover:bg-surface-container-high border border-outline-variant/40 hover:border-outline-variant transition text-left"
      type="button"
      title="Click to edit display name"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary border border-primary/20 font-label-md uppercase">
          {initials(displayName)}
        </span>
        <div className="min-w-0">
          <span className="block truncate font-body-md font-semibold text-on-surface">{displayName}</span>
          <span className="block text-[11px] font-mono text-tertiary">Edit Display Name</span>
        </div>
      </div>
      <IconSettings size={18} className="text-on-surface-variant opacity-60 hover:opacity-100 transition" />
    </button>
  );
}

function PeerButton({
  peer,
  selected,
  online,
  unread,
  onSelect,
}: {
  peer: Peer;
  selected: boolean;
  online: boolean;
  unread: number;
  onSelect: () => void;
}) {
  return (
    <button
      className={[
        "flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition",
        selected
          ? "border-primary bg-primary text-on-primary"
          : "border-transparent hover:border-outline-variant hover:bg-surface-container",
      ].join(" ")}
      onClick={onSelect}
      type="button"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-outline-variant bg-surface-container-high font-label-md">
        {initials(peer.display_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-body-md font-medium">{peer.display_name}</span>
        <span className="block truncate font-code-sm opacity-75">{online ? "Online" : "Offline history"}</span>
      </span>
      {unread > 0 ? (
        <span className="grid min-w-7 place-items-center rounded-full bg-on-primary px-2 py-1 text-primary text-xs">
          {unread}
        </span>
      ) : null}
    </button>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  badge = 0,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}) {
  return (
    <div
      className={[
        "flex items-center gap-4 rounded-full px-4 py-3 font-body-md",
        active ? "bg-primary text-on-primary" : "text-on-surface-variant",
      ].join(" ")}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge > 0 ? (
        <span className="grid min-w-7 place-items-center rounded-full bg-white px-2 py-1 text-primary text-xs">
          {badge}
        </span>
      ) : null}
    </div>
  );
}

function FooterItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 font-body-md text-on-surface-variant">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function unreadTotal(unreadByPeer: Record<string, number>): number {
  return Object.values(unreadByPeer).reduce((total, count) => total + count, 0);
}

function meshStatusLabel(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Discovery Active";
    case "connecting":
      return "Connecting";
    case "reconnecting":
      return "Reconnecting";
    case "connection_error":
      return "Connection Issue";
    case "disconnected":
      return "Mesh Offline";
  }
}
