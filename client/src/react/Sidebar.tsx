import {
  IconFolder,
  IconHelpCircle,
  IconMessageCircle,
  IconSettings,
  IconShare,
  IconTerminal2,
  IconUsers,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
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
  const shareFile = useAppStore((state) => state.selectFileForCurrentPeer);

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

      <button
        className="mt-5 flex min-h-16 items-center justify-center gap-3 rounded-lg bg-primary px-5 py-4 font-headline-sm text-on-primary shadow-sm transition hover:bg-primary-hover"
        onClick={shareFile}
        type="button"
      >
        <IconShare size={24} />
        Share File
      </button>

      <footer className="mt-5 border-outline-variant border-t pt-5">
        <FooterItem icon={<IconHelpCircle size={22} />} label="Support" />
        <FooterItem icon={<IconTerminal2 size={22} />} label="Logs" />
      </footer>
    </div>
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
