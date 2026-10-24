/**
 * Normalize repository URLs for uniqueness checks.
 *
 * Examples that share one canonical value:
 * - https://github.com/Owner/Repo
 * - https://github.com/owner/repo/
 * - https://github.com/OWNER/REPO.git?tab=readme#top
 * → https://github.com/owner/repo
 *
 * Non-GitHub hosts keep path-segment case after host normalization:
 * - https://gitlab.com/Org/Project/
 * → https://gitlab.com/Org/Project
 */
export function canonicalizeRepositoryUrl(input: string): string {
  const url = new URL(input);

  const host = url.hostname.toLowerCase();
  let pathname = url.pathname.replace(/\/+$/u, "");
  if (pathname.toLowerCase().endsWith(".git")) {
    pathname = pathname.slice(0, -4).replace(/\/+$/u, "");
  }

  // Preserve internal separators, non-default ports, and non-GitHub hostnames.
  // These may identify distinct repositories on self-hosted services.
  if (host === "github.com") {
    const segments = pathname.split("/");
    if (segments[1]) segments[1] = segments[1].toLowerCase();
    if (segments[2]) segments[2] = segments[2].toLowerCase();
    pathname = segments.join("/");
  }

  return `https://${url.host.toLowerCase()}${pathname}`;
}
