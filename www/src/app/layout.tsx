import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "klinkr - Local AI Studio",
  description: "Build AI apps locally with klinkr",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-blue-500/30">
        {children}
      </body>
    </html>
  );
}
