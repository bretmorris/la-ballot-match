// Guards for accepting a geocoder match. CAMS (LA County's locator) happily returns lookalikes:
// "1600 Pennsylvania Ave, Washington DC 20500" → a Los Angeles parcel at 1600 Pennsylvania Ave.

/** Address-level match types from CAMS; others are street centerlines, ZIP centroids, etc. */
export const ADDRESS_TYPES = new Set(["PointAddress", "Parcel", "StreetAddress", "Subaddress"])

/** The match must keep the house number and, if the voter typed a ZIP, that ZIP. */
export function plausibleMatch(input: string, matched: string): boolean {
  const house = input.trim().match(/^(\d+)/)?.[1]
  if (!house || !new RegExp(`^${house}\\b`).test(matched.trim())) return false
  // A ZIP is a 5-digit group that isn't the leading house number.
  const zips = [...input.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].filter((m) => m.index !== input.indexOf(house))
  const zip = zips.at(-1)?.[1]
  return !zip || matched.includes(zip)
}
