export function assertHttpsUrlWithoutCredentials(value: string, label: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return `${label} must be a valid absolute URL.`;
  }

  if (parsed.protocol !== "https:") {
    return `${label} must use HTTPS.`;
  }

  if (parsed.username || parsed.password) {
    return `${label} must not include credentials.`;
  }

  if (!parsed.hostname) {
    return `${label} must include a hostname.`;
  }

  return null;
}
