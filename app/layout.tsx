import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SpeakReady — practica tu inglés en voz alta",
    template: "%s · SpeakReady",
  },
  description: "Practica conversaciones en inglés, observa tu ritmo y mejora paso a paso, con privacidad primero.",
  applicationName: "SpeakReady",
  openGraph: {
    title: "SpeakReady — practica tu inglés en voz alta",
    description: "Una práctica pequeña. Más confianza para la conversación que sigue.",
    type: "website",
    locale: "es_PE",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f7f6",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
