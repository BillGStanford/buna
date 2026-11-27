import type { CSSProperties } from "react";

type CountryFlagProps = {
  code: string;
  size?: number;
  className?: string;
};

/**
 * FlagCDN serves ISO 3166-1 alpha-2 flags as static PNGs.
 * No API key, SDK, client request, or paid plan is required.
 */
export function CountryFlag({ code, size = 20, className = "" }: CountryFlagProps) {
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return null;

  const style: CSSProperties = {
    width: size,
    height: Math.round(size * 0.75),
    objectFit: "cover",
    flex: "0 0 auto",
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${size <= 16 ? 20 : 40}/${normalized}.png`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={Math.round(size * 0.75)}
      style={style}
      className={`inline-block rounded-[2px] ring-1 ring-black/10 ${className}`}
      onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
    />
  );
}
