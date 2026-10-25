/**
 * Intentionally public synthetic demo identities.
 * These credentials may appear on auth screens when DEMO_MODE=1.
 * They must never match real mentor seed credentials from apps/api/.env.
 * Playwright mirrors the same values in e2e/demo-accounts.ts — keep them aligned.
 */

export type DemoAccountPublic = {
  role: "STUDENT" | "MENTOR";
  label: string;
  name: string;
  email: string;
  password: string;
};

/** Stable primary keys so re-seeding updates the same rows. */
export const DEMO_USER_IDS = {
  studentA: "demo_student_a",
  studentB: "demo_student_b",
  mentor: "demo_mentor",
} as const;

export const DEMO_ACCOUNTS = {
  studentA: {
    id: DEMO_USER_IDS.studentA,
    role: "STUDENT" as const,
    label: "Student A",
    name: "Demo Student A",
    email: "student-a@demo.reviewdock.local",
    password: "DemoStudentA1!",
  },
  studentB: {
    id: DEMO_USER_IDS.studentB,
    role: "STUDENT" as const,
    label: "Student B",
    name: "Demo Student B",
    email: "student-b@demo.reviewdock.local",
    password: "DemoStudentB1!",
  },
  mentor: {
    id: DEMO_USER_IDS.mentor,
    role: "MENTOR" as const,
    label: "Mentor",
    name: "Demo Mentor",
    email: "mentor@demo.reviewdock.local",
    password: "DemoMentor1!",
  },
} as const;

export const DEMO_NOTICE =
  "Shared synthetic demo accounts. Changes are real inside this sandbox and are visible to other visitors.";

export function publicDemoAccounts(): DemoAccountPublic[] {
  return [
    {
      role: DEMO_ACCOUNTS.studentA.role,
      label: DEMO_ACCOUNTS.studentA.label,
      name: DEMO_ACCOUNTS.studentA.name,
      email: DEMO_ACCOUNTS.studentA.email,
      password: DEMO_ACCOUNTS.studentA.password,
    },
    {
      role: DEMO_ACCOUNTS.studentB.role,
      label: DEMO_ACCOUNTS.studentB.label,
      name: DEMO_ACCOUNTS.studentB.name,
      email: DEMO_ACCOUNTS.studentB.email,
      password: DEMO_ACCOUNTS.studentB.password,
    },
    {
      role: DEMO_ACCOUNTS.mentor.role,
      label: DEMO_ACCOUNTS.mentor.label,
      name: DEMO_ACCOUNTS.mentor.name,
      email: DEMO_ACCOUNTS.mentor.email,
      password: DEMO_ACCOUNTS.mentor.password,
    },
  ];
}

export function isDemoFixtureEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return Object.values(DEMO_ACCOUNTS).some((account) => account.email === normalized);
}
