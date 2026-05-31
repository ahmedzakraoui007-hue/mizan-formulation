import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Sidebar from "@/components/Sidebar";
import AppProviders from "@/components/AppProviders";
import "./globals.css";

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
    <ClerkProvider>
      <html lang="fr">
        <body className="antialiased bg-gray-50 flex min-h-screen print:bg-white">
          <AppProviders>
            <div className="print:hidden">
              <Sidebar />
            </div>
            {/* Main Content Area - Push 64 padding-left to clear fixed 64-width sidebar */}
            <main className="flex-1 xl:ml-64 min-h-screen print:ml-0 print:min-h-0">
              {children}
            </main>
          </AppProviders>
        </body>
      </html>
    </ClerkProvider>
  );
}
