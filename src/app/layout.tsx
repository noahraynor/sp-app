import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SP Notes",
  description: "SOAP note generator for Speech-Language Pathologists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-5xl px-4 py-4">
              <h1 className="text-xl font-semibold text-gray-900">SP Notes</h1>
              <p className="text-sm text-gray-500">SOAP note generator for SLPs</p>
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
