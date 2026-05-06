"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

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

/**
 * Analytics scripts gated behind the age gate. Compliance reference:
 * docs/compliance/02-WEB.md §6.3 — pixels (GA4, Umami, PostHog, future
 * Meta/TikTok) MUST NOT fire before the visitor has verified +18,
 * because tracking a minor is both an LOPNNA risk and forbidden by
 * Meta/Google's own platform terms.
 *
 * Boot conditions:
 *   1. The `enrola_age_verified` cookie is present at first render
 *      (returning visitor) — load immediately.
 *   2. The `enrola:age-verified` custom event fires (AgeGate dispatches
 *      it on the accept click) — load without page reload.
 *
 * Until either fires we render nothing — no <Script> tags, no network
 * requests to googletagmanager / umami / posthog.
 */
export default function Analytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const hasCookie =
      typeof document !== "undefined" &&
      document.cookie.indexOf("enrola_age_verified=true") !== -1;
    if (hasCookie) {
      setEnabled(true);
      return;
    }
    const onVerified = () => setEnabled(true);
    window.addEventListener("enrola:age-verified", onVerified);
    return () => window.removeEventListener("enrola:age-verified", onVerified);
  }, []);

  if (!enabled) return null;

  return (
    <>
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
      <Script
        src={UMAMI_SRC}
        data-website-id={UMAMI_WEBSITE_ID}
        data-domains="enrola.shop"
        strategy="lazyOnload"
        defer
      />
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
    </>
  );
}
