import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Knot",
  description: "Tying people together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('knot-theme')==='dark')document.documentElement.classList.add('knot-dark')}catch(e){}` }} /></head>
      <body>{children}</body>
    </html>
  );
}
