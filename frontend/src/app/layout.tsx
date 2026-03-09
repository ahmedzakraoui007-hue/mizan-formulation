import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mizan Formulation SaaS",
  description: "Enterprise multi-blend optimization ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 flex min-h-screen print:bg-white`}>
        <div className="print:hidden">
          <Sidebar />
        </div>
        {/* Main Content Area - Push 64 padding-left to clear fixed 64-width sidebar */}
        <main className="flex-1 xl:ml-64 min-h-screen print:ml-0 print:min-h-0">
          {children}
        </main>
      </body>
    </html>
  );
}
