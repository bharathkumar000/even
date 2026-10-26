"use client";

import Script from "next/script";

interface GoogleAnalyticsProps {
  measurementId?: string;
}

export default function GoogleAnalytics({ measurementId }: GoogleAnalyticsProps) {
  const gaId = measurementId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  if (!gaId) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              restricted_data_processing: true
            });
          `,
        }}
      />
    </>
  );
}

/**
 * Safe, privacy-preserving event tracker.
 * Discards any sensitive user data or passwords automatically.
 */
export function trackPublicEvent(action: string, category: string, label?: string) {
  if (typeof window === "undefined" || !(window as any).gtag) {
    return;
  }

  (window as any).gtag("event", action, {
    event_category: category,
    event_label: label,
    non_interaction: false,
  });
}
