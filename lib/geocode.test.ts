import { describe, expect, it } from "vitest"
import { plausibleMatch } from "./geocode"

describe("plausibleMatch", () => {
  it("accepts a faithful match", () => {
    expect(plausibleMatch("200 N Spring St, Los Angeles, CA 90012", "200 N SPRING ST, LOS ANGELES CA, 90012")).toBe(true)
    expect(plausibleMatch("11333 Valley Blvd, El Monte 91731", "11333 VALLEY BLVD, EL MONTE CA, 91731")).toBe(true)
    expect(plausibleMatch("11333 Valley Blvd, El Monte", "11333 VALLEY BLVD, EL MONTE CA, 91731")).toBe(true)
  })
  it("rejects a different ZIP (out-of-county lookalike)", () => {
    expect(plausibleMatch("1600 Pennsylvania Ave NW, Washington, DC 20500", "1600 PENNSYLVANIA AVE, LOS ANGELES CA, 90033")).toBe(false)
  })
  it("rejects matches without the typed house number", () => {
    expect(plausibleMatch("Main St, Santa Monica, CA", "Main St, Santa Monica, 90401")).toBe(false)
    expect(plausibleMatch("Los Angeles, CA 90012", "S Los Angeles St, Los Angeles, 90012")).toBe(false)
    expect(plausibleMatch("12 Main St", "120 MAIN ST, ALHAMBRA CA, 91801")).toBe(false)
  })
})
