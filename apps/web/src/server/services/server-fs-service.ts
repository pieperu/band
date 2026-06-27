import { type DirListing, FsBrowseClient } from "../infra/process/fs-browse";

/**
 * Read-only server-filesystem browse service.
 *
 * Thin business-logic wrapper over `FsBrowseClient` so the `serverFs`
 * router never imports infra directly (see `docs/web-architecture.md`).
 * Powers the in-app "browse the server's filesystem" folder picker the
 * dashboard shows in remote mode — when the desktop shell is pointed at a
 * remote Band server, the native macOS picker would browse the user's
 * Mac, so the renderer falls back to this endpoint to browse the box the
 * server actually runs on.
 *
 * The service deliberately exposes only a single `list` read — there is
 * no write/create/delete surface here. Folder *registration* still goes
 * through `ProjectService.add`, which has its own validation.
 */
export class ServerFsService {
  constructor(private readonly fs: FsBrowseClient = new FsBrowseClient()) {}

  /**
   * List the immediate subdirectories of `dir` on the server. Defaults to
   * the server user's home directory when `dir` is omitted.
   */
  async listDirectories(dir?: string): Promise<DirListing> {
    return this.fs.list(dir);
  }
}

export const serverFsService = new ServerFsService();
