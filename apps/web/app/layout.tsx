import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
import { I18nProvider } from "../lib/i18n";
import { Header } from "../components/Header";
import { ErrorCapture } from "../components/ErrorCapture";

export const metadata: Metadata = {
  title: "TradeCode Pro",
  description: "Free HS code search and trade comparison for China, India and UAE",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <I18nProvider>
            <Header />
            <div style={{ paddingTop: 64 }}>{children}</div>
            <ErrorCapture />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
