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

  let host = url.hostname.toLowerCase();
  if (host.startsWith("www.")) {
    host = host.slice(4);
  }

  let pathname = url.pathname.replace(/\/+$/u, "");
  if (pathname.toLowerCase().endsWith(".git")) {
    pathname = pathname.slice(0, -4);
  }

  const segments = pathname.split("/").filter(Boolean);

  if (host === "github.com" && segments.length >= 2) {
    segments[0] = segments[0]!.toLowerCase();
    segments[1] = segments[1]!.toLowerCase();
  }

  const normalizedPath = segments.length > 0 ? `/${segments.join("/")}` : "";
  return `https://${host}${normalizedPath}`;
}
