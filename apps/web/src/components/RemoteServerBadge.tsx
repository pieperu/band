import { Badge, Tooltip, TooltipContent, TooltipTrigger } from "@band-app/ui";
import { remoteServerLabel } from "../lib/remote-server";

/**
 * Small, unobtrusive pill in the desktop title bar showing which REMOTE
 * Band server the desktop app is connected to (e.g. "● band.dev.fipster.com").
 *
 * Renders nothing in local/`localhost` mode — the indicator only appears
 * when the dashboard is being served by a remote server (see
 * `lib/remote-server.ts`). This is the only signal the UI gives that
 * you're driving a box other than your own machine, so it's intentionally
 * always-on (not dismissable) while remote.
 */
export function RemoteServerBadge() {
  const label = remoteServerLabel();
  if (!label) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          data-testid="remote-server-badge"
          className="gap-1.5 px-2 py-0.5 font-normal text-muted-foreground cursor-default select-none"
        >
          {/* Green "connected" dot. */}
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="max-w-[180px] truncate font-mono text-[11px]">{label}</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        Connected to remote Band server
        <span className="ml-1 font-mono">{label}</span>
      </TooltipContent>
    </Tooltip>
  );
}
