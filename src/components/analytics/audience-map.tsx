"use client";

import { useEffect, useRef, useState } from "react";

type Country = { code: string; visitors: number };
type MapLibreMap = {
  addControl: (control: unknown, position?: string) => void;
  on: (event: string, callback: (event?: unknown) => void) => void;
  off: (event: string, callback: (event?: unknown) => void) => void;
  remove: () => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  queryRenderedFeatures: (point: unknown, options: unknown) => { properties?: { code?: string; name?: string; visitors?: number } }[];
  fitBounds: (bounds: [[number, number], [number, number]], options?: unknown) => void;
  setFeatureState: (target: unknown, state: unknown) => void;
  getCanvas: () => { style: { cursor: string } };
};
declare global {
  interface Window {
    maplibregl?: {
      Map: new (options: unknown) => MapLibreMap;
      NavigationControl: new () => unknown;
    };
  }
}

const GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson";
const CODE_PROPERTY = "ISO3166-1-Alpha-2";

export function AudienceMap({ countries }: { countries: Country[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selected, setSelected] = useState<{ code: string; name: string; visitors: number } | null>(null);
  const [maxVisitors, setMaxVisitors] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let activeMap: MapLibreMap | null = null;
    const load = async () => {
      try {
        if (!document.querySelector('link[data-openfreemap-css]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css";
          link.dataset.openfreemapCss = "true";
          document.head.appendChild(link);
        }
        if (!window.maplibregl) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-openfreemap-js]');
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("Map library failed")), { once: true });
              return;
            }
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
            script.dataset.openfreemapJs = "true";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Map library failed"));
            document.body.appendChild(script);
          });
        }
        const response = await fetch(GEOJSON_URL);
        if (!response.ok) throw new Error("Country boundary data unavailable");
        const geojson = await response.json() as {
          type: "FeatureCollection";
          features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[];
        };
        if (cancelled || !container.current || !window.maplibregl) return;

        const values = new Map(countries.map((country) => [country.code.toUpperCase(), country.visitors]));
        const enriched = {
          ...geojson,
          features: geojson.features.map((feature) => {
            const props = feature.properties ?? {};
            const code = String(props[CODE_PROPERTY] ?? "").toUpperCase();
            const fallbackCode = code === "-99" ? "" : code;
            return {
              ...feature,
              properties: {
                ...props,
                audience_code: fallbackCode,
                audience_name: String(props.name ?? fallbackCode ?? "Unknown"),
                audience_visitors: values.get(fallbackCode) ?? 0,
              },
            };
          }),
        };
        const maximum = Math.max(0, ...countries.map((country) => country.visitors));
        setMaxVisitors(maximum);

        const api = window.maplibregl;
        const instance = new api.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [12, 18],
          zoom: 0.65,
          minZoom: 0.5,
          maxZoom: 5,
          attributionControl: true,
          cooperativeGestures: true,
        });
        activeMap = instance;
        map.current = instance;
        instance.addControl(new api.NavigationControl(), "top-right");

        instance.on("load", () => {
          if (cancelled) return;
          instance.addSource("audience-country-data", { type: "geojson", data: enriched });
          instance.addLayer({
            id: "audience-country-fill",
            type: "fill",
            source: "audience-country-data",
            paint: {
              "fill-color": [
                "case",
                [">", ["get", "audience_visitors"], 0],
                ["interpolate", ["linear"], ["ln", ["+", ["get", "audience_visitors"], 1]],
                  0, "#e1eee7", Math.max(0.1, Math.log(maximum + 1) * 0.35), "#76b89a",
                  Math.max(0.2, Math.log(maximum + 1) * 0.7), "#27845f",
                  Math.max(0.3, Math.log(maximum + 1)), "#075c42"],
                "#e8ece9",
              ],
              "fill-opacity": 0.88,
            },
          });
          instance.addLayer({
            id: "audience-country-outline",
            type: "line",
            source: "audience-country-data",
            paint: { "line-color": "#ffffff", "line-width": 0.65, "line-opacity": 0.9 },
          });
          setStatus("ready");
        });

        const handleMove = (event?: unknown) => {
          const e = event as { point?: { x: number; y: number } } | undefined;
          if (!e?.point) return;
          const feature = instance.queryRenderedFeatures(e.point, { layers: ["audience-country-fill"] })[0];
          instance.getCanvas().style.cursor = feature ? "pointer" : "";
        };
        const handleClick = (event?: unknown) => {
          const e = event as { point?: { x: number; y: number } } | undefined;
          if (!e?.point) return;
          const feature = instance.queryRenderedFeatures(e.point, { layers: ["audience-country-fill"] })[0];
          if (!feature?.properties) { setSelected(null); return; }
          const code = String(feature.properties.audience_code ?? "");
          const visitors = Number(feature.properties.audience_visitors ?? 0);
          setSelected({ code, name: String(feature.properties.audience_name ?? code), visitors });
        };
        instance.on("mousemove", handleMove);
        instance.on("click", handleClick);
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    };
    void load();
    return () => {
      cancelled = true;
      activeMap?.remove();
      if (map.current === activeMap) map.current = null;
    };
  }, [countries]);

  const format = (value: number) => value.toLocaleString();
  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden border border-line bg-[#eef2ef]">
        <div ref={container} className="h-[390px] w-full" role="img" aria-label="World map shaded by country according to aggregated startup profile views" />
        {status === "loading" ? <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-sm text-muted">Loading country audience data…</div> : null}
        {status === "unavailable" ? <div className="absolute inset-0 flex items-center justify-center bg-surface/95 p-6 text-center text-sm text-muted">The geographic map is temporarily unavailable. Country totals remain available in the table below.</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>Country fill represents recorded profile views · unshaded countries have no recorded visits</span>
        <span>Map © OpenFreeMap · © OpenStreetMap contributors · Country boundaries: Natural Earth</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Fewer visits</span><span className="h-3 w-6 border border-line bg-[#e1eee7]" /><span className="h-3 w-6 bg-[#76b89a]" /><span className="h-3 w-6 bg-[#27845f]" /><span className="h-3 w-6 bg-[#075c42]" /><span>More visits</span>
      </div>
      {selected ? <div className="border-l-2 border-primary bg-primary-pale px-3 py-2 text-sm"><strong>{selected.name}</strong><span className="ml-2 tabular-nums text-muted">{format(selected.visitors)} profile views</span></div> : null}
    </div>
  );
}
