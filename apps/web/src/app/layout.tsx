import type { Metadata } from "next";

import { AuthProvider } from "@/features/auth/auth-context";

import { manrope } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ReviewDock", template: "%s | ReviewDock" },
  description: "Students submit projects; mentors review them with clear decisions and feedback.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
