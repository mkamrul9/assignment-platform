import type { Metadata } from "next";

import { LoginPageClient } from "@/features/auth/login-page";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
