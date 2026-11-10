import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { Consentimento } from "@/components/Consentimento";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: { default: "GLAM House · Ingressos", template: "%s · GLAM House" },
  description: "GLAM, a casinha mais amada de São Luís. Compre seus ingressos pelo Pix ou cartão e receba o QR na hora.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { title: "GLAM House · Ingressos", description: "A casinha mais amada de São Luís.", type: "website", locale: "pt_BR" },
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0a0908", width: "device-width", initialScale: 1 };

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID || "880769331739336";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection(); // renderização dinâmica: cada página recebe o nonce da CSP
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="grao">
        {children}
        <Consentimento pixelId={PIXEL} />
      </body>
    </html>
  );
}
