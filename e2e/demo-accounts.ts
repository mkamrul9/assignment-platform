/**
 * Mirrors apps/api/src/demo/accounts.ts public fixture identities for Playwright.
 * Keep emails/passwords in sync with the API constants (intentionally public).
 */
export const DEMO_ACCOUNTS = {
  studentA: {
    id: "demo_student_a",
    role: "STUDENT" as const,
    label: "Student A",
    name: "Demo Student A",
    email: "student-a@demo.reviewdock.local",
    password: "DemoStudentA1!",
  },
  studentB: {
    id: "demo_student_b",
    role: "STUDENT" as const,
    label: "Student B",
    name: "Demo Student B",
    email: "student-b@demo.reviewdock.local",
    password: "DemoStudentB1!",
  },
  mentor: {
    id: "demo_mentor",
    role: "MENTOR" as const,
    label: "Mentor",
    name: "Demo Mentor",
    email: "mentor@demo.reviewdock.local",
    password: "DemoMentor1!",
  },
} as const;
