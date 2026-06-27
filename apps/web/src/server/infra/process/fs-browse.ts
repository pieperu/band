import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, parse, resolve } from "node:path";

/**
 * Read-only filesystem-browse infra adapter.
 *
 * Lists immediate subdirectories of an absolute path on the SERVER's
 * filesystem so the dashboard's "Register Project" flow can browse the
 * server when running against a remote Band server (the desktop shell's
 * native macOS folder picker would otherwise browse the user's Mac, not
 * the box the server runs on — see `dashboard/components/AddProjectDialog.tsx`).
 *
 * Strictly read-only: it only ever `readdir`/`stat`s — never writes,
 * never deletes, never follows the listing into file contents. It is the
 * lowest tier, so it knows nothing about services or routers; the
 * `ServerFsService` wraps it and the `serverFs` router exposes it behind
 * Band's existing token auth.
 */

export interface DirEntry {
  /** Directory name (basename only — no path separators). */
  name: string;
  /** Absolute path of this directory on the server. */
  path: string;
  /** Whether this directory is itself a git repository (has a `.git`). */
  isGitRepo: boolean;
}

export interface DirListing {
  /** The absolute, normalised path that was listed. */
  path: string;
  /** Parent directory, or `null` when `path` is a filesystem root. */
  parent: string | null;
  /** The server user's home directory — a sensible "jump home" anchor. */
  home: string;
  /** Immediate subdirectories, sorted case-insensitively by name. */
  entries: DirEntry[];
}

export class FsBrowseClient {
  /** The server user's home directory — the default browse root. */
  home(): string {
    return homedir();
  }

  /**
   * List the immediate subdirectories of `dir`.
   *
   * `dir` must be an absolute path; when omitted it defaults to the
   * server user's home directory. Hidden directories (dot-prefixed) are
   * skipped by default to keep the listing tidy — except `.git` is never
   * shown because it's an implementation detail surfaced via the
   * per-entry `isGitRepo` flag instead. Entries the process can't
   * `stat` (permission denied, races) are silently skipped rather than
   * failing the whole listing.
   */
  async list(dir?: string, opts?: { includeHidden?: boolean }): Promise<DirListing> {
    const target = dir?.trim() ? resolve(dir) : this.home();
    if (!isAbsolute(target)) {
      throw new Error("Absolute path required");
    }

    const includeHidden = opts?.includeHidden ?? false;

    let dirents: Dirent[];
    try {
      // `withFileTypes` so we avoid an extra `stat` per child for the
      // directory check; symlinks report as symlinks (not dirs) and are
      // skipped, which also keeps us from following links out of the
      // tree the user is browsing.
      dirents = await readdir(target, { withFileTypes: true });
    } catch (err) {
      throw mapFsError(err, target);
    }

    const entries: DirEntry[] = [];
    for (const dirent of dirents) {
      const name = dirent.name;
      if (!includeHidden && name.startsWith(".")) continue;
      if (!dirent.isDirectory()) continue;

      const fullPath = join(target, name);
      let isGitRepo = false;
      try {
        // A directory is a git repo when it contains a `.git` entry
        // (directory for a normal clone, file for a worktree/submodule).
        await stat(join(fullPath, ".git"));
        isGitRepo = true;
      } catch {
        isGitRepo = false;
      }
      entries.push({ name, path: fullPath, isGitRepo });
    }

    entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    return {
      path: target,
      parent: parentOf(target),
      home: this.home(),
      entries,
    };
  }
}

/** Returns the parent directory, or `null` when `dir` is a filesystem root. */
function parentOf(dir: string): string | null {
  const { root } = parse(dir);
  if (dir === root) return null;
  const parent = resolve(dir, "..");
  return parent === dir ? null : parent;
}

/** Map raw fs errno errors onto friendlier messages for the UI. */
function mapFsError(err: unknown, target: string): Error {
  const code = (err as { code?: string } | undefined)?.code;
  switch (code) {
    case "ENOENT":
      return new Error(`No such directory: ${target}`);
    case "ENOTDIR":
      return new Error(`Not a directory: ${target}`);
    case "EACCES":
    case "EPERM":
      return new Error(`Permission denied: ${target}`);
    default:
      return err instanceof Error ? err : new Error(String(err));
  }
}
