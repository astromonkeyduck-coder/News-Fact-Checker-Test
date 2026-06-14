import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noteworthy Radar",
  description:
    "Compliance-first newsroom command center: monitor events, triage manually-captured public leads, and export branded vertical video after editorial approval.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
