import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import Providers from "./providers";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "GoodBuilders S3 — Flow Council Dashboard",
  description:
    "Stats dashboard for the GoodBuilders Season 3 Flow Council on Celo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={archivo.variable}
        style={{ fontFamily: "var(--font-archivo), sans-serif" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
