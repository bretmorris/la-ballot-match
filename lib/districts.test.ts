import { describe, expect, it } from "vitest"
import { contestsFor, districtsOf } from "./districts"

// Real record for 200 N Spring St (LA City Hall), fetched 2026-09-30.
const cityHall = {
  DIST_CONG: "34TH US CONGRESSIONAL",
  DIST_STSEN: "26TH ST SENATE",
  DIST_STASS: "54TH STATE ASSEMBLY",
  DIST_SUP: "1ST SUPERVISORIAL",
  DIST_BEQ: "3RD BOARD OF EQUALIZATION",
  DST_CITY: "CITY OF LOS ANGELES",
  DIV_CITY: "CITY OF LOS ANGELES 14TH COUNCIL",
  DIV_USD: "LOS ANGELES USD-BD EDUCATION 2",
}

const j = (type: string, district: string | null = null) => ({ type, district, name: "" })

describe("districtsOf", () => {
  it("parses ordinal district strings", () => {
    expect(districtsOf(cityHall)).toEqual({
      congressional: "34",
      "state-senate": "26",
      assembly: "54",
      supervisorial: "1",
      "board-of-equalization": "3",
    })
  })
})

describe("contestsFor", () => {
  const contests = [
    { id: "gov", jurisdiction: j("statewide") },
    { id: "sheriff", jurisdiction: j("county") },
    { id: "cd34", jurisdiction: j("congressional", "34") },
    { id: "cd30", jurisdiction: j("congressional", "30") },
    { id: "ad54", jurisdiction: j("assembly", "54") },
    { id: "council14", jurisdiction: j("city-council", "14"), rrcc: [{ field: "DIV_CITY", value: "City of Los Angeles 14th Council" }] },
    { id: "council1", jurisdiction: j("city-council", "1"), rrcc: [{ field: "DIV_CITY", value: "CITY OF LOS ANGELES 1ST COUNCIL" }] },
    { id: "pasadena", jurisdiction: j("city"), rrcc: [{ field: "DST_CITY", value: "PASADENA" }] },
  ]

  it("selects only this voter's contests", () => {
    expect(contestsFor(contests, cityHall).map((c) => c.id)).toEqual(["gov", "sheriff", "cd34", "ad54", "council14"])
  })
})

describe("contestsFor with real contest data", () => {
  it("gives an LA City Hall voter the city, LAUSD and LACCD contests, but not other council districts", async () => {
    const { readFileSync, readdirSync } = await import("node:fs")
    const all = readdirSync("data/contests")
      .filter((f) => f.endsWith(".json"))
      .flatMap((f) => JSON.parse(readFileSync(`data/contests/${f}`, "utf8")))
    const ids = contestsFor(all, { ...cityHall, DST_USD: "LOS ANGELES USD", DST_JRC: "LOS ANGELES COMMUNITY COLLEGE" }).map((c) => c.id)
    for (const id of ["la-city-mayor", "la-city-city-attorney", "la-city-measure-sc", "us-house-ca-34", "ca-assembly-54", "ca-senate-26", "ca-governor"]) {
      expect(ids).toContain(id)
    }
    expect(ids.filter((id) => id.startsWith("los-angeles-community-college"))).toHaveLength(3)
    expect(ids.filter((id) => id.startsWith("la-city-measure"))).toHaveLength(8)
    expect(ids.some((id) => id.includes("city-council-3rd") || id.includes("city-council-9th"))).toBe(false)
    expect(ids.some((id) => id.startsWith("city-of-"))).toBe(false)
  })
})
