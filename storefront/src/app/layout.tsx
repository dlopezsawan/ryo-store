import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import {
  getHomeMetadata,
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
} from "@/lib/seo";
import Providers from "@/components/Providers";
import AgeGate from "@/components/layout/AgeGate";

export const metadata: Metadata = getHomeMetadata();

const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "G-BP5HL3X1WH";
const UMAMI_WEBSITE_ID =
  process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ||
  "6789c969-a433-43a9-afe2-587304a89634";
const UMAMI_SRC =
  process.env.NEXT_PUBLIC_UMAMI_SRC ||
  "https://analytics.enrola.shop/script.js";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://api.enrola.shop" />
        <link
          rel="preload"
          href="/fonts/Kanit-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/Kanit-Black.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <style
          dangerouslySetInnerHTML={{
            __html:
              "html.age-verified #age-gate{display:none!important}",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(document.cookie.indexOf('enrola_age_verified=true')!==-1)document.documentElement.classList.add('age-verified')}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased bg-cream text-dark overflow-x-hidden w-full">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
          strategy="lazyOnload"
        />
        <Script id="ga4-init" strategy="lazyOnload">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA4_ID}');`}
        </Script>
        {/* Umami (self-hosted analytics) */}
        <Script
          src={UMAMI_SRC}
          data-website-id={UMAMI_WEBSITE_ID}
          data-domains="enrola.shop"
          strategy="lazyOnload"
          defer
        />
        {/* PostHog (product analytics + feature flags + experiments + errors) */}
        {POSTHOG_KEY && (
          <Script id="posthog-init" strategy="lazyOnload">
            {`!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init me ss bs ws ge fs capture je Ds calculateEventProperties Es register register_once register_for_session unregister unregister_for_session Ps getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey canRenderSurveyAsync identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty Ts Os createPersonProfile Ms Rs opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing Cs debug As getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${POSTHOG_KEY}', {
  api_host: '${POSTHOG_HOST}',
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
  disable_session_recording: true, /* Clarity handles recordings */
  loaded: function(ph) { if (typeof window !== 'undefined') window.__posthog_ready = true; }
});`}
          </Script>
        )}
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-orange focus:text-white focus:px-4 focus:py-2 focus:font-black focus:text-sm focus:uppercase focus:tracking-widest focus:border-2 focus:border-dark">
          Saltar al contenido
        </a>
        <AgeGate />
        <Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateOrganizationJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateWebsiteJsonLd()),
          }}
        />
        {children}
        </Providers>
      </body>
    </html>
  );
}
