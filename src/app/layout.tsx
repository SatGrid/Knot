import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knot",
  description: "Conversations that keep people connected.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
