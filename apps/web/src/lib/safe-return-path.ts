/** Only allow local relative paths. Reject protocol-relative and absolute URLs. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }

  if (value.includes("://")) {
    return null;
  }

  return value;
}

export function workspacePathForRole(role: "STUDENT" | "MENTOR"): string {
  return role === "MENTOR" ? "/mentor" : "/student";
}
