import type { Metadata } from "next";

import { AuthProvider } from "@/features/auth/auth-context";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReviewDock", template: "%s | ReviewDock" },
  description: "A considered space for student projects and mentor feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
