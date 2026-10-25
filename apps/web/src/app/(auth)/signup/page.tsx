import type { Metadata } from "next";

import { SignupPageClient } from "@/features/auth/signup-page";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return <SignupPageClient />;
}
