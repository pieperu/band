import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

// Point the DB at a throwaway home BEFORE anything opens it (getDb is lazy and
// reads BAND_HOME on first query). Import the query layer afterwards.
let ChatQueries: typeof import("@/server/infra/db/queries/chats").ChatQueries;

beforeAll(async () => {
  process.env.BAND_HOME = realpathSync(mkdtempSync(join(tmpdir(), "band-tombstone-")));
  ({ ChatQueries } = await import("@/server/infra/db/queries/chats"));
});

function baseRow(id: string) {
  return {
    id,
    workspaceId: "proj-branch",
    name: "Chat",
    agent: "claude-code",
    model: undefined,
    mode: undefined,
    activeSessionId: undefined,
    activeSessionSummary: undefined,
    activeSessionLastModified: undefined,
    status: "idle" as const,
    labels: {},
  };
}

/**
 * The `sessionCleared` tombstone is the guard that stops auto-attach-on-open
 * from re-promoting a session the user deliberately left (issue #478). If it
 * doesn't survive the serialize→persist→deserialize round-trip, the guard
 * silently fails open. This proves every plumbing site is wired.
 */
describe("sessionCleared tombstone persistence", () => {
  it("defaults absent, persists true on clear and false on set — across a fresh read", () => {
    const q = new ChatQueries();
    const id = "chat-tombstone-1";
    const now = Date.now();
    q.insert({ ...baseRow(id), createdAt: now, updatedAt: now });

    // Fresh chat: no tombstone.
    const afterInsert = new ChatQueries().findAll().find((r) => r.id === id);
    expect(afterInsert?.sessionCleared).toBeUndefined();

    // Clear (New session) → tombstone true, and it survives a fresh read.
    q.update(id, afterInsert!, { sessionCleared: true, activeSessionId: null, updatedAt: now + 1 });
    const afterClear = new ChatQueries().findAll().find((r) => r.id === id);
    expect(afterClear?.sessionCleared).toBe(true);
    expect(afterClear?.activeSessionId).toBeUndefined();

    // Set a real session → tombstone false again.
    q.update(id, afterClear!, {
      sessionCleared: false,
      activeSessionId: "sess-xyz",
      updatedAt: now + 2,
    });
    const afterSet = new ChatQueries().findAll().find((r) => r.id === id);
    expect(afterSet?.sessionCleared).toBe(false);
    expect(afterSet?.activeSessionId).toBe("sess-xyz");
  });

  it("leaves sessionCleared untouched when a patch omits it", () => {
    const q = new ChatQueries();
    const id = "chat-tombstone-2";
    const now = Date.now();
    q.insert({ ...baseRow(id), createdAt: now, updatedAt: now });
    q.update(id, baseRow(id), { sessionCleared: true, updatedAt: now + 1 });

    // A cosmetic patch (rename) must not wipe the tombstone.
    const current = new ChatQueries().findAll().find((r) => r.id === id)!;
    q.update(id, current, { name: "Renamed", updatedAt: now + 2 });
    const after = new ChatQueries().findAll().find((r) => r.id === id);
    expect(after?.name).toBe("Renamed");
    expect(after?.sessionCleared).toBe(true);
  });
});
