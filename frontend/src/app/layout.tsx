import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import packageJson from "../../package.json";
import FooterVersionBadge from "@/components/FooterVersionBadge";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HomeLabInfo Dashboard",
  description: "Real-time monitoring and discovery of your homelab network infrastructure and docker containers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
        <main className="flex-grow flex flex-col min-h-0">
          {children}
        </main>
        <footer className="py-3 px-6 border-t border-white/5 flex justify-between items-center text-[10px] uppercase tracking-wider text-white/30">
          <div>HomeLabInfo System</div>
          <FooterVersionBadge currentVersion={packageJson.version} />
        </footer>
      </body>
    </html>
  );
}

