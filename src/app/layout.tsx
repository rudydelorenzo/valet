import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const tiempos = localFont({
  src: [
    { path: "../../public/fonts/TiemposHeadline-Bold.otf", weight: "700", style: "normal" },
    { path: "../../public/fonts/TiemposHeadline-BoldItalic.otf", weight: "700", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Valet",
  description: "Portainer CE webhook deployer",
};

const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${tiempos.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          <Suspense fallback={<div className="h-12 border-b border-border" />}>
            <Nav />
          </Suspense>
          {children}
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
};

export default RootLayout;
