import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { SelectedResourceProvider } from "@/contexts/SelectedResourceContext"
import { TreeRefreshProvider } from "@/contexts/TreeRefreshContext"
import { DemoModeProvider } from "@/contexts/DemoModeContext"
import { LicenseProvider } from "@/contexts/LicenseContext"
import { TrialBanner } from "@/components/license/TrialBanner"
import { LicenseGate } from "@/components/license/LicenseGate"
import { LicenseTestHelper } from "@/components/license/LicenseTestHelper"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Azure Service Bus Explorer",
  description: "Cross-platform Azure Service Bus Explorer for developers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LicenseProvider>
          <LicenseTestHelper />
          <SelectedResourceProvider>
            <DemoModeProvider>
              <LicenseGate>
                <div className="flex h-screen flex-col overflow-hidden">
                  <TrialBanner />
                  <div className="flex flex-1 overflow-hidden">
                    <Sidebar />
                    <main className="flex-1 overflow-hidden">{children}</main>
                  </div>
                </div>
              </LicenseGate>
            </DemoModeProvider>
          </SelectedResourceProvider>
        </LicenseProvider>
      </body>
    </html>
  );
}
