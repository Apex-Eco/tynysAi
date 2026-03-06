import type { Metadata } from "next";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://tynysai.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TynysAi | Real-Time Air Quality",
    template: "%s | TynysAi",
  },
  description:
    "Real-time CO2 and PM2.5 monitoring for buses, metro, and trolleybus routes.",
  keywords: [
    "air quality monitoring",
    "public transport",
    "CO2",
    "PM2.5",
    "Almaty",
    "AQI",
    "IoT",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "TynysAi | Real-Time Air Quality",
    description:
      "Live AQI, CO2, and PM2.5 visibility for public transport operations.",
    siteName: "TynysAi",
    images: [
      {
        url: "/tynys-logo.webp",
        width: 1200,
        height: 630,
        alt: "TynysAi air quality monitoring",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TynysAi | Real-Time Air Quality",
    description:
      "Live AQI, CO2, and PM2.5 visibility for public transport operations.",
    images: ["/tynys-logo.webp"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${GeistMono.variable} ${GeistSans.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <AnalyticsTracker />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>{children}</SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
