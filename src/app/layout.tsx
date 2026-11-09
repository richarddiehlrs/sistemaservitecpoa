import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "ServitecPoa ERP | Assistência Técnica",
  description:
    "Sistema de gestão para assistência técnica de eletrodomésticos - ServitecPoa",
  icons: {
    icon: "/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "ServitecPoa",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d4ed8",
  // iPhone com notch: o app usa a tela toda e respeita as áreas seguras (env(safe-area-inset-*))
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
