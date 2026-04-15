import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hockey Fantasy Playoff Draft",
  description: "Data-driven edge for your NHL playoff fantasy draft",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
