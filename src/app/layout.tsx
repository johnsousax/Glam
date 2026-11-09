import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: { default: "GLAM House · Ingressos", template: "%s · GLAM House" },
  description: "GLAM, a casinha mais amada de São Luís. Compre seus ingressos pelo Pix ou cartão e receba o QR na hora.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: { title: "GLAM House · Ingressos", description: "A casinha mais amada de São Luís.", type: "website", locale: "pt_BR" },
  icons: { icon: "/icon.png" },
};

export const viewport: Viewport = { themeColor: "#0a0908", width: "device-width", initialScale: 1 };

const PIXEL = process.env.NEXT_PUBLIC_META_PIXEL_ID || "880769331739336";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} ${montserrat.variable}`}>
      <body className="grao">
        {children}
        {PIXEL && (
          <Script id="meta-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${PIXEL}');fbq('track','PageView');
          `}</Script>
        )}
      </body>
    </html>
  );
}
