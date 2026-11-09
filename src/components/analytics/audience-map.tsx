"use client";

import { useEffect, useRef, useState } from "react";

type Country = { code: string; visitors: number };
type MapLibreMap = {
  addControl: (control: unknown, position?: string) => void;
  on: (event: string, callback: () => void) => void;
  remove: () => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown) => void;
  getSource: (id: string) => { setData: (data: unknown) => void } | undefined;
  fitBounds: (bounds: [[number, number], [number, number]], options?: unknown) => void;
};
declare global { interface Window { maplibregl?: { Map: new (options: unknown) => MapLibreMap; NavigationControl: new () => unknown; Popup: new (options?: unknown) => { setLngLat: (coords: [number, number]) => { setHTML: (html: string) => { addTo: (map: MapLibreMap) => void } } } } } }

const CENTROIDS: Record<string, [number, number, string]> = {
  US: [-98, 39, "United States"], CA: [-106, 56, "Canada"], MX: [-102, 23, "Mexico"],
  BR: [-51, -10, "Brazil"], AR: [-64, -34, "Argentina"], GB: [-3, 55, "United Kingdom"],
  FR: [2, 46, "France"], DE: [10, 51, "Germany"], NL: [5, 52, "Netherlands"],
  ES: [-4, 40, "Spain"], IT: [12, 42, "Italy"], SE: [15, 62, "Sweden"],
  NO: [9, 62, "Norway"], CH: [8, 47, "Switzerland"], PL: [19, 52, "Poland"],
  UA: [32, 49, "Ukraine"], TR: [35, 39, "Türkiye"], RU: [90, 60, "Russia"],
  ET: [40, 9, "Ethiopia"], KE: [38, 0, "Kenya"], NG: [8, 9, "Nigeria"],
  GH: [-2, 8, "Ghana"], ZA: [24, -29, "South Africa"], EG: [30, 26, "Egypt"],
  MA: [-7, 32, "Morocco"], AE: [54, 24, "United Arab Emirates"], SA: [45, 24, "Saudi Arabia"],
  IN: [78, 22, "India"], PK: [69, 30, "Pakistan"], BD: [90, 24, "Bangladesh"],
  CN: [104, 35, "China"], JP: [138, 37, "Japan"], KR: [128, 36, "South Korea"],
  SG: [104, 1, "Singapore"], ID: [118, -2, "Indonesia"], PH: [122, 12, "Philippines"],
  AU: [134, -25, "Australia"], NZ: [174, -41, "New Zealand"],
};

export function AudienceMap({ countries }: { countries: Country[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [selected, setSelected] = useState<Country | null>(null);
  const total = countries.reduce((sum, item) => sum + item.visitors, 0);

  useEffect(() => {
    let cancelled = false;
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
            if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(), { once: true }); return; }
            const script = document.createElement("script");
            script.src = "https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js";
            script.dataset.openfreemapJs = "true";
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.body.appendChild(script);
          });
        }
        if (cancelled || !container.current || !window.maplibregl) return;
        const api = window.maplibregl;
        const instance = new api.Map({
          container: container.current,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: [15, 18],
          zoom: 0.65,
          minZoom: 0.5,
          maxZoom: 5,
          attributionControl: true,
          cooperativeGestures: true,
        });
        map.current = instance;
        instance.addControl(new api.NavigationControl(), "top-right");
        instance.on("load", () => {
          if (cancelled) return;
          const features = countries.flatMap((item) => {
            const place = CENTROIDS[item.code];
            if (!place) return [];
            return [{ type: "Feature", properties: { code: item.code, name: place[2], visitors: item.visitors }, geometry: { type: "Point", coordinates: [place[0], place[1]] } }];
          });
          instance.addSource("audience-countries", { type: "geojson", data: { type: "FeatureCollection", features } });
          instance.addLayer({ id: "audience-country-points", type: "circle", source: "audience-countries", paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "visitors"], 1, 6, Math.max(2, total), 19],
            "circle-color": "#087F5B", "circle-opacity": 0.78, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5,
          } });
          setStatus("ready");
          if (features.length > 1) {
            const coords = features.map((f) => f.geometry.coordinates as [number, number]);
            const lngs = coords.map((c) => c[0]), lats = coords.map((c) => c[1]);
            instance.fitBounds([[Math.min(...lngs) - 12, Math.min(...lats) - 8], [Math.max(...lngs) + 12, Math.max(...lats) + 8]], { padding: 42, maxZoom: 2.5, duration: 0 });
          }
          container.current?.addEventListener("click", (event) => {
            const mouse = event as MouseEvent & { point?: { x: number; y: number } };
            const target = (instance as unknown as { queryRenderedFeatures: (point: unknown, options: unknown) => { properties?: { code: string; visitors: number } }[] }).queryRenderedFeatures({ x: mouse.offsetX, y: mouse.offsetY }, { layers: ["audience-country-points"] })[0];
            if (target?.properties) {
              const found = countries.find((c) => c.code === target.properties?.code);
              if (found) setSelected(found);
            }
          });
        });
        instance.on("error", () => { if (!cancelled) setStatus("unavailable"); });
      } catch { if (!cancelled) setStatus("unavailable"); }
    };
    void load();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [countries, total]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border border-line bg-[#eef4f0]">
        <div ref={container} className="h-[360px] w-full" role="img" aria-label="Interactive map showing aggregated visitor counts by country" />
        {status === "loading" ? <div className="absolute inset-0 flex items-center justify-center bg-surface/80 text-sm text-muted">Loading audience map…</div> : null}
        {status === "unavailable" ? <div className="absolute inset-0 flex items-center justify-center bg-surface/95 p-6 text-center text-sm text-muted">The map service is temporarily unavailable. Your country-level audience table remains available below.</div> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Aggregated country-level visits · no individual locations</span>
        <span>Map © OpenFreeMap · © OpenStreetMap contributors</span>
      </div>
      {selected ? <div className="rounded-md border border-primary/20 bg-primary-pale px-3 py-2 text-sm"><strong>{CENTROIDS[selected.code]?.[2] ?? selected.code}</strong><span className="ml-2 tabular-nums text-muted">{selected.visitors.toLocaleString()} recorded profile views</span></div> : null}
      {!countries.length ? <p className="text-sm text-muted">Country markers will appear when location data is available.</p> : null}
    </div>
  );
}
