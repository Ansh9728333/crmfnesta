import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Nonces are unique per document response, including the public sign-in page.
export const dynamic = "force-dynamic";

const montserrat = localFont({
  src: "../assets/montserrat-latin-variable.woff2",
  variable: "--font-montserrat",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: { default: "SiteFlow CRM", template: "%s | SiteFlow CRM" },
  description: "One workspace for every customer journey. Finesta Home, IBAX and S-Grip.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={montserrat.variable}>{children}</body>
    </html>
  );
}
