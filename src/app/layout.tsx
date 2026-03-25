import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import NavigationProgress from "@/components/NavigationProgress";
import PageTransition from "@/components/PageTransition";
import PreferencesProvider from "@/components/PreferencesProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aether",
  description:
    "Accessibility-first, AI-driven learning. Upload a PDF and build an adaptive course.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${lexend.variable}`}>
      <body>
        <NavigationProgress />
        <PreferencesProvider>
          <main className="main-content">
            <PageTransition>{children}</PageTransition>
          </main>
          <BottomNav />
        </PreferencesProvider>
      </body>
    </html>
  );
}
