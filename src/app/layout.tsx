import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knot",
  description: "Tying people together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><Script id="knot-theme" strategy="beforeInteractive">{`try{if(localStorage.getItem('knot-theme')==='dark')document.documentElement.classList.add('knot-dark')}catch(e){}`}</Script></head>
      <body>{children}</body>
    </html>
  );
}
