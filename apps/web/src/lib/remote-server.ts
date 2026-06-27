/**
 * Remote-server detection for the dashboard renderer.
 *
 * Band can be served two ways:
 *   - LOCAL  — the desktop shell spawns a bundled web server on
 *     `localhost:<port>` (or a plain dev/browser tab on localhost).
 *   - REMOTE — the desktop shell is launched with `BAND_SERVER_URL`
 *     (e.g. `https://band.dev.fipster.com`) and loads that remote URL
 *     directly, so the renderer is served BY the remote box
 *     (see `apps/desktop/src/main/index.ts::resolveDashboardUrl`).
 *
 * The renderer can't read env vars, so we derive "remote vs local" from
 * the host it was served from: any non-loopback host means we're talking
 * to a remote Band server. This drives both the connected-server badge
 * and the in-app server-filesystem folder picker.
 */

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

/** Hostname (no port) the renderer was served from, or "" off-DOM (SSR). */
export function currentHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname;
}

/**
 * True when the dashboard is being served by a REMOTE Band server (a
 * non-loopback host). False on `localhost`/dev and when there's no
 * `window` (SSR), so the default local experience is never altered.
 */
export function isRemoteServer(): boolean {
  const host = currentHost();
  if (!host) return false;
  return !LOOPBACK_HOSTS.has(host.toLowerCase());
}

/**
 * Human-readable label for the connected remote server — just the host
 * (e.g. `band.dev.fipster.com`). Returns `null` when local, so callers
 * can `&&`-gate the badge without a separate `isRemoteServer()` check.
 */
export function remoteServerLabel(): string | null {
  if (!isRemoteServer()) return null;
  return currentHost();
}
