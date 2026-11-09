import { notFound } from "next/navigation";
import { SpeakReadyDashboard } from "@/components/speakready-dashboard";
import { isLocale, locales } from "@/lib/i18n";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SpeakReadyDashboard locale={locale} now={new Date().getTime()} />;
}
