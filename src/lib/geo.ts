/**
 * ISO 3166-1 alpha-2 country catalogue. All Buna country fields store codes,
 * so every country selector shares one worldwide source of truth.
 */
export type Country = { code: string; name: string };

export const AFRICAN_COUNTRY_CODES = [
  "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW","EH",
] as const;

/** ISO 3166-1 alpha-2 assigned country/territory codes (including territories). */
export const ISO_COUNTRY_CODES = (
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
  "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR " +
  "GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO " +
  "JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ " +
  "MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA " +
  "RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO " +
  "TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW"
).split(" ");

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
// Pin region labels that differ between Node/ICU and browser/ICU versions.
// Without this shared override, SSR can emit "Falkland Islands" while the
// browser hydrates "Falkland Islands (Islas Malvinas)" for the same ISO code.
const COUNTRY_NAME_OVERRIDES: Record<string, string> = {
  FK: "Falkland Islands",
};

export const ALL_COUNTRIES: Country[] = ISO_COUNTRY_CODES
  .map((code) => ({ code, name: COUNTRY_NAME_OVERRIDES[code] ?? displayNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE = new Map(ALL_COUNTRIES.map((country) => [country.code, country.name]));
export const AFRICAN_COUNTRIES: Country[] = AFRICAN_COUNTRY_CODES
  .map((code) => ALL_COUNTRIES.find((country) => country.code === code))
  .filter((country): country is Country => Boolean(country));

/** Kept as a compatibility export; all countries are now selectable worldwide. */
export const DIASPORA_COUNTRIES: Country[] = ALL_COUNTRIES.filter(
  (country) => !AFRICAN_COUNTRY_CODES.includes(country.code as typeof AFRICAN_COUNTRY_CODES[number]),
);

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return BY_CODE.get(code.toUpperCase()) ?? null;
}

export function isKnownCountry(code: string): boolean {
  return BY_CODE.has(code.toUpperCase());
}

/** Native HTML select options cannot display remote image assets, so use Unicode flag glyphs there. */
export function countryFlagEmoji(code: string | null | undefined): string {
  const normalized = (code ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "";
  return String.fromCodePoint(...[...normalized].map((char) => char.charCodeAt(0) + 127397));
}
