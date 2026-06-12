import { IconServer, IconX } from "@tabler/icons-react";
import { DeviceKindIcon, peerDeviceTitle } from "./devicePresentation";
import { useAppStore } from "./store";

export function TopologyModal() {
  const deviceId = useAppStore((state) => state.deviceId);
  const displayName = useAppStore((state) => state.displayName);
  const deviceProfile = useAppStore((state) => state.deviceProfile);
  const peers = useAppStore((state) => state.peers);
  const setTopologyOpen = useAppStore((state) => state.setTopologyOpen);
  const selectPeer = useAppStore((state) => state.selectPeer);

  const nodes = [
    {
      id: deviceId,
      name: `${displayName} (You)`,
      isSelf: true,
      kind: deviceProfile.kind,
      title: deviceProfile.model ?? displayName,
    },
    ...peers.map((p) => ({
      id: p.id,
      name: p.display_name,
      isSelf: false,
      kind: p.device_kind,
      title: peerDeviceTitle(p),
    })),
  ];

  const cx = 250;
  const cy = 180;
  const r = 120;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in cursor-pointer"
      onClick={() => setTopologyOpen(false)}
    >
      <div 
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-outline-variant bg-surface p-6 shadow-2xl animate-scale-in cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-outline-variant border-b pb-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <h2 className="font-headline-sm">Mesh Topology Map</h2>
          </div>
          <button
            aria-label="Close topology"
            className="grid size-9 place-items-center rounded-full border border-outline-variant hover:bg-surface-container transition"
            onClick={() => setTopologyOpen(false)}
            type="button"
          >
            <IconX size={18} />
          </button>
        </header>

        <div className="my-6 flex flex-col items-center justify-center">
          <svg className="w-full max-w-[500px] aspect-[500/360] overflow-visible" viewBox="0 0 500 360">
            {/* Connection lines with animated packets */}
            {nodes.map((node, i) => {
              const angle = (i * 2 * Math.PI) / nodes.length;
              const px = cx + r * Math.cos(angle);
              const py = cy + r * Math.sin(angle);
              const pathId = `link-${node.id}`;

              return (
                <g key={`link-group-${node.id}`}>
                  {/* Line */}
                  <path
                    d={`M ${cx} ${cy} L ${px} ${py}`}
                    id={pathId}
                    stroke={node.isSelf ? "var(--color-primary)" : "var(--color-outline-variant)"}
                    strokeDasharray={node.isSelf ? "5,5" : "none"}
                    strokeWidth={node.isSelf ? 2 : 1.5}
                    fill="none"
                    opacity={0.8}
                  />

                  {/* Animated dot moving from node to coordinator (Server) */}
                  <circle r="4" fill={node.isSelf ? "var(--color-primary)" : "var(--color-tertiary)"}>
                    <animateMotion
                      dur={node.isSelf ? "2s" : "3.5s"}
                      repeatCount="indefinite"
                      path={`M ${px} ${py} L ${cx} ${cy}`}
                    />
                  </circle>
                </g>
              );
            })}

            {/* Central Node (Mist Coordinator) */}
            <g transform={`translate(${cx}, ${cy})`}>
              <circle
                r="32"
                fill="var(--color-inverse-surface)"
                stroke="var(--color-outline-variant)"
                strokeWidth="2"
                className="breathing-pip"
              />
              <foreignObject x="-16" y="-16" width="32" height="32">
                <div className="grid h-full w-full place-items-center text-white">
                  <IconServer size={22} />
                </div>
              </foreignObject>
              <text
                y="45"
                textAnchor="middle"
                className="fill-on-surface font-label-md font-semibold text-xs tracking-wider uppercase"
              >
                Coordinator
              </text>
            </g>

            {/* Peer Nodes */}
            {nodes.map((node, i) => {
              const angle = (i * 2 * Math.PI) / nodes.length;
              const px = cx + r * Math.cos(angle);
              const py = cy + r * Math.sin(angle);

              return (
                <g
                  key={`node-${node.id}`}
                  transform={`translate(${px}, ${py})`}
                  className="cursor-pointer group"
                  onClick={() => {
                    if (!node.isSelf) {
                      selectPeer(node.id);
                      setTopologyOpen(false);
                    }
                  }}
                >
                  {/* Outer breathing circle for active node */}
                  <circle
                    r="24"
                    fill={node.isSelf ? "var(--color-primary-fixed)" : "var(--color-surface-container-high)"}
                    stroke={node.isSelf ? "var(--color-primary)" : "var(--color-outline-variant)"}
                    strokeWidth={node.isSelf ? 2 : 1}
                    className="group-hover:scale-110 group-hover:stroke-primary transition-all duration-300"
                  />
                  <foreignObject x="-12" y="-12" width="24" height="24">
                    <div
                      title={node.title}
                      className={`grid h-full w-full place-items-center ${
                        node.isSelf ? "text-primary" : "text-on-surface"
                      }`}
                    >
                      <DeviceKindIcon kind={node.kind} size={16} />
                    </div>
                  </foreignObject>
                  {/* Label */}
                  <text
                    y="36"
                    textAnchor="middle"
                    className={`font-body-md font-medium text-[11px] group-hover:fill-primary transition-colors ${
                      node.isSelf ? "fill-primary font-bold" : "fill-on-surface"
                    }`}
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <footer className="flex items-center justify-between border-outline-variant border-t pt-4 font-body-md text-on-surface-variant">
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-primary-fixed border border-primary" />
              <span>You</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-surface-container-high border border-outline-variant" />
              <span>Peers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-slate-900" />
              <span>Server</span>
            </div>
          </div>
          <span className="text-xs font-code-sm text-outline">
            {peers.length} client{peers.length === 1 ? "" : "s"} connected
          </span>
        </footer>
      </div>
    </div>
  );
}
