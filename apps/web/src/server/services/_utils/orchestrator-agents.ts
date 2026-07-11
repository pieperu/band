import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The agent-dashboard orchestrator (a sibling app that spawns `claude
 * --remote-control` sessions in git worktrees on this same box) records each
 * spawned session — including its **friendly name** and the worktree it runs in
 * — to a JSON state file. Band reads it (best-effort, local file, no
 * cross-service HTTP) so the sidebar can label a worktree with the dashboard's
 * session name and a "live agent" dot. Without this, a worktree only shows its
 * git branch, which often doesn't match the name you dispatched it under (e.g.
 * "player-editorial-worker" vs the branch "chore/archive-…").
 *
 * Env-overridable to match the orchestrator's `SESSIONS_STATE_PATH`.
 */
const STATE_PATH =
  process.env.SESSIONS_STATE_PATH ??
  join(homedir(), ".cache", "agent-dashboard", "remote-sessions.json");

export interface OrchestratorAgent {
  /** The worktree (or scratch dir) the session runs in. */
  worktreePath: string;
  /** Friendly name the session was dispatched under. */
  name: string;
  /** Family-scoped workspace id (w:N worker / o:N orchestrator), if any. */
  label?: string;
}

interface RawRecord {
  name?: string;
  worktreePath?: string;
  dir?: string;
  label?: string;
}

/**
 * Read the orchestrator's spawned-session state. Returns `[]` when the file is
 * absent or unreadable (orchestrator not running, or not this host) — the
 * feature simply degrades to branch-only labels.
 */
export function readOrchestratorAgents(): OrchestratorAgent[] {
  let raw: string;
  try {
    raw = readFileSync(STATE_PATH, "utf8");
  } catch {
    return [];
  }
  try {
    const state = JSON.parse(raw) as Record<string, RawRecord>;
    const out: OrchestratorAgent[] = [];
    for (const rec of Object.values(state)) {
      const worktreePath = rec.worktreePath ?? rec.dir;
      if (worktreePath && rec.name) {
        out.push({ worktreePath, name: rec.name, label: rec.label });
      }
    }
    return out;
  } catch {
    return [];
  }
}
