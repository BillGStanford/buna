import { renderOg, OG_SIZE, OG_TYPE } from "@/lib/og";

export const alt = "Buna — discover African startups";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({ eyebrow: "African startups", title: "Where African startups get found.", subtitle: "Discover startups, launches and opportunities — and the people behind them.", chips: ["Discover", "Launch", "Connect"] });
}
