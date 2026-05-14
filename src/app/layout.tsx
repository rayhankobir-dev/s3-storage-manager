import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RouteProvider } from "@/providers/route-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ConnectionProvider } from "@/stores/connection";
import { ThemedToaster } from "@/components/themed-toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Object Storage",
  description: "Connect to an S3 or R2 bucket and manage files.",
};

export const viewport: Viewport = {
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <RouteProvider>
          <ThemeProvider>
            <ConnectionProvider>{children}</ConnectionProvider>
            <ThemedToaster />
          </ThemeProvider>
        </RouteProvider>
      </body>
    </html>
  );
}
