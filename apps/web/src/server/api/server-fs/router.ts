import { z } from "zod";
import { serverFsService } from "../../services/server-fs-service";
import { publicProcedure, t } from "../trpc";

/**
 * Server-filesystem browse router (read-only).
 *
 * Exposes a single `list` query that returns the immediate
 * subdirectories of a path on the SERVER's filesystem. It backs the
 * dashboard's in-app folder browser, used when the desktop shell is
 * pointed at a remote Band server (`BAND_SERVER_URL`): the native macOS
 * folder picker would browse the user's Mac, not the server, so the
 * renderer navigates the server's tree through this endpoint instead.
 *
 * Security posture:
 *   - Read-only. There is NO create/write/delete procedure here; the
 *     service and infra tiers only ever `readdir`/`stat`. Folder
 *     *registration* still flows through `projects.add`.
 *   - Auth: `publicProcedure` like every other Band route — the whole
 *     tRPC surface sits behind the server's `band_token` check at the
 *     HTTP layer, so an unauthenticated caller never reaches this
 *     handler. This is the same trust boundary `host.readFile` (which
 *     reads arbitrary absolute file contents) already relies on.
 *   - It only ever returns directory *names*, never file contents, and
 *     skips symlinks so a caller can't hop out of the tree via a link.
 *
 * Follows the API → service → infra layering in
 * `docs/web-architecture.md`: the router validates input and delegates
 * to `ServerFsService`; no business logic or fs access lives here.
 */
export const serverFsRouter = t.router({
  /**
   * List immediate subdirectories of `path` (absolute). Omit `path` to
   * default to the server user's home directory.
   */
  list: publicProcedure
    .input(z.object({ path: z.string().optional() }).optional())
    .query(({ input }) => {
      return serverFsService.listDirectories(input?.path);
    }),
});

export type ServerFsRouter = typeof serverFsRouter;
