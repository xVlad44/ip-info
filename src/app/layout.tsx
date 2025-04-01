import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "IP Information",
  description: "Get IP information",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen flex items-center justify-center">
            <div className="container max-w-4xl mx-auto px-4">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
