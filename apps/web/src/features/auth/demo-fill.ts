/**
 * One-shot in-memory handoff when a demo account is chosen on the signup page.
 * Never persisted to URL, localStorage, or sessionStorage.
 */
type DemoFill = { email: string; password: string };

let pending: DemoFill | null = null;

export function setPendingDemoFill(fill: DemoFill): void {
  pending = fill;
}

export function takePendingDemoFill(): DemoFill | null {
  const value = pending;
  pending = null;
  return value;
}
