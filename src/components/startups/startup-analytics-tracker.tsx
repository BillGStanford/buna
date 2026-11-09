"use client";

import { useEffect } from "react";

type Props = { startupId: string };

function id(key: string, persistent: Storage): string {
  let value = persistent.getItem(key);
  if (key === "buna_visitor_id") {
    const createdAt = Number(persistent.getItem("buna_visitor_created_at") || 0);
    if (!value || !createdAt || Date.now() - createdAt > 395 * 24 * 60 * 60 * 1000) {
      value = crypto.randomUUID();
      persistent.setItem(key, value);
      persistent.setItem("buna_visitor_created_at", String(Date.now()));
    }
  } else if (!value) {
    value = crypto.randomUUID();
    persistent.setItem(key, value);
  }
  return value;
}

function deviceType(): "mobile" | "desktop" | "tablet" | "unknown" {
  const ua = navigator.userAgent;
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  if (ua) return "desktop";
  return "unknown";
}

export function StartupAnalyticsTracker({ startupId }: Props) {
  useEffect(() => {
    if (/bot|crawler|spider|preview|headless/i.test(navigator.userAgent)) return;
    let visitorId: string;
    let sessionId: string;
    try {
      visitorId = id("buna_visitor_id", window.localStorage);
      sessionId = id("buna_session_id", window.sessionStorage);
    } catch {
      // Analytics is optional: privacy settings or browser storage restrictions must not break the page.
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const referrerDomain = (() => {
      try { return document.referrer ? new URL(document.referrer).hostname : null; }
      catch { return null; }
    })();
    const send = (eventType: string, path = window.location.pathname) => {
      const payload = {
        startupId, visitorId, sessionId, eventType,
        path: path.slice(0, 180).split("?")[0].split("#")[0] || "/",
        referrerDomain,
        utmSource: params.get("utm_source"),
        campaign: params.get("utm_campaign"),
        deviceType: deviceType(),
      };
      void fetch("/api/analytics/event", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), keepalive: true, credentials: "same-origin",
      }).catch(() => undefined);
    };

    send("page_view");
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[data-analytics-event]");
      if (!anchor) return;
      const type = anchor.dataset.analyticsEvent;
      if (type === "product_click" || type === "website_click" || type === "launch_view") send(type);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [startupId]);

  return null;
}
