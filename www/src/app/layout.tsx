import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI App Builder - Control Panel",
  description: "Local AI App Builder Control Panel for VS Code & GitHub Copilot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
