import localFont from "next/font/local";

/**
 * Self-hosted Manrope variable font. Files and OFL notice live under ./fonts/.
 * Builds do not request Google Fonts at runtime.
 */
export const manrope = localFont({
  src: [
    {
      path: "./fonts/Manrope-latin-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "./fonts/Manrope-latin-ext-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-manrope",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
});
