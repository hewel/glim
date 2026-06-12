import { Tooltip } from "@base-ui/react/tooltip";
import type { ComponentType, SVGProps } from "react";

interface IconButtonProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  type = "button",
}: IconButtonProps) {
  const button = (
    <button
      aria-label={label}
      className={[
        "grid size-11 place-items-center rounded-full border transition",
        active
          ? "border-primary bg-primary text-on-primary"
          : "border-outline-variant bg-surface-container-low text-on-surface hover:border-primary",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      <Icon aria-hidden="true" height={20} strokeWidth={1.8} width={20} />
    </button>
  );

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={button} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={8}>
          <Tooltip.Popup className="rounded-sm border border-outline-variant bg-slate-950 px-2 py-1 text-xs text-white shadow-sm">
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
