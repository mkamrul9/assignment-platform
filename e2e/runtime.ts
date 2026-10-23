import fs from "node:fs";
import path from "node:path";

const e2eRoot = path.join(process.cwd(), "e2e");

export const RUNTIME_DIR = path.join(e2eRoot, ".runtime");
export const STATE_PATH = path.join(RUNTIME_DIR, "state.json");
export const SCREENSHOT_DIR = path.join(process.cwd(), "docs", "screenshots");

export const E2E_WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3010);
export const E2E_API_PORT = Number(process.env.E2E_API_PORT ?? 4010);
export const E2E_DATABASE_NAME = process.env.E2E_DATABASE_NAME ?? "reviewdock_e2e";

export const MENTOR_EMAIL = "e2e-mentor@example.com";
export const MENTOR_PASSWORD = "e2e-mentor-pass-1";
export const MENTOR_NAME = "E2E Mentor";

export const FIXTURE_STUDENT_EMAIL = "e2e-fixture-student@example.com";
export const FIXTURE_STUDENT_PASSWORD = "e2e-student-pass-1";
export const FIXTURE_STUDENT_NAME = "E2E Fixture Student";

export type E2EState = {
  baseURL: string;
  apiURL: string;
  databaseUrl: string;
  databaseName: string;
  mentorEmail: string;
  mentorPassword: string;
  fixtureStudentEmail: string;
  fixtureStudentPassword: string;
  apiPid: number;
  webPid: number;
};

export function readState(): E2EState {
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as E2EState;
}

export function writeState(state: E2EState): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}
