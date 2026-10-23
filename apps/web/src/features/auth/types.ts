export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "MENTOR";
  createdAt: string;
};
