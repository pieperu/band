import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ScrollArea,
} from "@band-app/ui";
import { ArrowUp, ChevronRight, Folder, GitBranch, Home, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdapter } from "../context";
import type { ServerDirListing } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the absolute server path the user selected. */
  onSelect: (absolutePath: string) => void;
  /** Optional initial directory; defaults to the server user's home. */
  initialPath?: string;
}

/**
 * In-app folder browser for the SERVER's filesystem.
 *
 * Shown by `AddProjectDialog` when running against a remote Band server
 * (`BAND_SERVER_URL`), where the desktop shell's native macOS folder
 * picker would browse the user's Mac rather than the box the server runs
 * on. Navigates the server tree via the read-only `serverFs.list` tRPC
 * endpoint (see `server/api/server-fs/router.ts`): click a folder to
 * descend, "Up" to ascend, "Home" to jump to the server user's home, and
 * "Select this folder" to fill the path back into the dialog's input.
 *
 * Read-only — it never creates, renames, or deletes anything; it only
 * lists directory names so the user can point Band at an existing folder.
 */
export function ServerFolderBrowser({ open, onOpenChange, onSelect, initialPath }: Props) {
  const adapter = useAdapter();
  const [listing, setListing] = useState<ServerDirListing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (path?: string) => {
      if (!adapter.listServerDirectories) {
        setError("This server doesn't support folder browsing.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const next = await adapter.listServerDirectories(path);
        setListing(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [adapter],
  );

  // Load the initial directory each time the dialog opens. We key the
  // effect on `open` so re-opening always re-fetches (the server tree may
  // have changed) and starts from the requested anchor rather than
  // whatever the user last navigated to in a previous session.
  useEffect(() => {
    if (open) void load(initialPath);
  }, [open, initialPath, load]);

  const currentPath = listing?.path ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Browse server folders</DialogTitle>
          <DialogDescription>
            Pick a folder on the Band server. Navigate into a folder to open it, or select the
            current folder.
          </DialogDescription>
        </DialogHeader>

        {/* Current-path breadcrumb + nav controls. */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Up one level"
            aria-label="Up one level"
            disabled={loading || !listing?.parent}
            onClick={() => listing?.parent && load(listing.parent)}
          >
            <ArrowUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Go to home directory"
            aria-label="Go to home directory"
            disabled={loading}
            onClick={() => load(listing?.home)}
          >
            <Home />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Refresh"
            aria-label="Refresh"
            disabled={loading}
            onClick={() => load(currentPath || undefined)}
          >
            <RefreshCw className={loading ? "animate-spin" : undefined} />
          </Button>
          <Input
            readOnly
            value={currentPath}
            className="font-mono text-xs"
            aria-label="Current server path"
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <ScrollArea className="h-[280px] rounded-md border border-border">
          <div className="p-1">
            {listing && listing.entries.length === 0 && !loading && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No subfolders here.
              </div>
            )}
            {listing?.entries.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => load(entry.path)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50 transition-colors"
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{entry.name}</span>
                {entry.isGitRepo && (
                  <GitBranch
                    className="size-3.5 shrink-0 text-emerald-500"
                    aria-label="git repository"
                  />
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
              </button>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!currentPath || loading}
            onClick={() => {
              if (currentPath) {
                onSelect(currentPath);
                onOpenChange(false);
              }
            }}
          >
            Select this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
