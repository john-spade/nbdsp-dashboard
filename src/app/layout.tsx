import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "NBDSP Dashboard | National Birth Defects Surveillance",
  description:
    "Healthcare analytics dashboard for the National Birth Defects Surveillance Project.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased text-slate-800 bg-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
