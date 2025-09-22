import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MaintenancePage from "@/components/MaintenancePage";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SalesDost - Safalta ka Sathi",
  description: "Field executive and admin management platform - Safalta ka Sathi",
  keywords: "field executive, admin management, sales, tracking, SalesDost",
  authors: [{ name: "SalesDost Team" }],
  creator: "SalesDost",
  publisher: "SalesDost",
  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/apple-icon', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'SalesDost',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    title: 'SalesDost - Safalta ka Sathi',
    description: 'Field executive and admin management platform - Safalta ka Sathi',
    siteName: 'SalesDost',
  },
  twitter: {
    card: 'summary',
    title: 'SalesDost - Safalta ka Sathi',
    description: 'Field executive and admin management platform - Safalta ka Sathi',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check maintenance mode - can be controlled via environment variable
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {isMaintenanceMode ? <MaintenancePage /> : children}
      </body>
    </html>
  );
}
