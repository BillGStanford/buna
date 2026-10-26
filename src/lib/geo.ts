/**
 * Countries are stored as ISO 3166-1 alpha-2 codes everywhere, so expansion beyond Ethiopia
 * needs no schema change. The African list drives filters; a few diaspora hubs are selectable
 * for founders based abroad.
 */
export type Country = { code: string; name: string };

export const AFRICAN_COUNTRIES: Country[] = [
  ["DZ", "Algeria"], ["AO", "Angola"], ["BJ", "Benin"], ["BW", "Botswana"], ["BF", "Burkina Faso"],
  ["BI", "Burundi"], ["CV", "Cabo Verde"], ["CM", "Cameroon"], ["CF", "Central African Republic"],
  ["TD", "Chad"], ["KM", "Comoros"], ["CG", "Congo"], ["CD", "DR Congo"], ["CI", "Côte d’Ivoire"],
  ["DJ", "Djibouti"], ["EG", "Egypt"], ["GQ", "Equatorial Guinea"], ["ER", "Eritrea"],
  ["SZ", "Eswatini"], ["ET", "Ethiopia"], ["GA", "Gabon"], ["GM", "Gambia"], ["GH", "Ghana"],
  ["GN", "Guinea"], ["GW", "Guinea-Bissau"], ["KE", "Kenya"], ["LS", "Lesotho"], ["LR", "Liberia"],
  ["LY", "Libya"], ["MG", "Madagascar"], ["MW", "Malawi"], ["ML", "Mali"], ["MR", "Mauritania"],
  ["MU", "Mauritius"], ["MA", "Morocco"], ["MZ", "Mozambique"], ["NA", "Namibia"], ["NE", "Niger"],
  ["NG", "Nigeria"], ["RW", "Rwanda"], ["ST", "São Tomé and Príncipe"], ["SN", "Senegal"],
  ["SC", "Seychelles"], ["SL", "Sierra Leone"], ["SO", "Somalia"], ["ZA", "South Africa"],
  ["SS", "South Sudan"], ["SD", "Sudan"], ["TZ", "Tanzania"], ["TG", "Togo"], ["TN", "Tunisia"],
  ["UG", "Uganda"], ["ZM", "Zambia"], ["ZW", "Zimbabwe"],
].map(([code, name]) => ({ code: code as string, name: name as string }));

export const DIASPORA_COUNTRIES: Country[] = [
  ["AU", "Australia"], ["CA", "Canada"], ["FR", "France"], ["DE", "Germany"], ["NL", "Netherlands"],
  ["SA", "Saudi Arabia"], ["SE", "Sweden"], ["AE", "United Arab Emirates"], ["GB", "United Kingdom"],
  ["US", "United States"],
].map(([code, name]) => ({ code: code as string, name: name as string }));

export const ALL_COUNTRIES: Country[] = [...AFRICAN_COUNTRIES, ...DIASPORA_COUNTRIES];
const BY_CODE = new Map(ALL_COUNTRIES.map((c) => [c.code, c.name]));

export function countryName(code: string | null | undefined): string | null {
  return code ? (BY_CODE.get(code) ?? null) : null;
}

export function isKnownCountry(code: string): boolean {
  return BY_CODE.has(code);
}
