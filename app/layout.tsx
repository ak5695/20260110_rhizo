import { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

import { Toaster } from "sonner";
import { ModalProvider } from "@/components/providers/modal-provider";

import React from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rhizo",
  description: "Rooted Knowledge. Connected Thought.",
  icons: {
    icon: [
      {
        media: "(prefers-color-scheme: light)",
        url: "/logo.jpg",
        href: "/logo.jpg",
      },
      {
        media: "(prefers-color-scheme: dark)",
        url: "/logo-dark.jpg",
        href: "/logo-dark.jpg",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="jotion-theme-2"
        >
          <Toaster position="bottom-center" />
          <ModalProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
