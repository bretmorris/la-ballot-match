# Address -> districts: research findings (2026-09-30)

## TL;DR / recommendation
Geocode the address (only step that must leave the browser), then do point-in-polygon locally against a
self-hosted, simplified copy of the **LA County RR/CC "Registrar Recorder Precincts with District Names"** layer.
That single layer (33,236 subprecinct polygons) carries congressional, state senate, assembly, BOE, supervisorial,
city + city-council division, school district + board/trustee area (incl. LAUSD 1-7), community college + trustee area (TA1..), and ~25 special-district fields.
It is the county's own precinct->district assignment, "Last updated September 2026" (item modified 2026-09-10).

## Verified: congressional map is the Prop 50 (AB 604) map in these sources
- Census Geocoder `120th Congressional Districts` layer: matched the official AB 604 polygons (CA GIS FeatureServer) at 18/18 test points across LA County.
- RR/CC layer field `DIST_CONG`: matched AB 604 at 17/17 test points (one point outside county). It also keeps the old map in `DIST_OLDC` ("2020 27TH..."). 3 test points differ between old and new map
  (e.g. -118.45,34.40 new=CD30 old=CD27; -118.0,34.05 new=38 old=31; -118.5,34.25 new=27 old=32), so the test is discriminating.
- WARNING: use `DIST_CONG`, NOT `DIST_OLDC`/`DIST_OLDS`/`DIST_OLDA` (older maps). Also ignore `DST_MISC5/6` (2010 supervisorial/BOE).
- Uncertain: sample was 18 points, not exhaustive. Do a full QA by overlaying AB 604 on dissolved RR/CC CD polygons before launch.

## 1. Census Geocoder (geocoding.geo.census.gov) - tested
- `GET /geocoder/geographies/onelineaddress?address=200+N+Spring+St,+Los+Angeles,+CA+90012&benchmark=Public_AR_Current&vintage=Current_Current&format=json`
- Result: lon -118.2456, lat 34.0516. Layers: 120th Congressional (CD 34), **2026** State Legislative Upper (SD 26) and Lower (AD 54), Incorporated Place (Los Angeles city), Unified School District (LAUSD), county, tract, block, ZCTA, etc.
- NOT returned: BOE, supervisorial, council district, LAUSD board seat, community college district/trustee area, special districts. (USD is returned but not board seat.)
- No API key; public domain US gov service. Batch limit 10,000. No documented rate limit (uncertain; don't rely on it for high traffic).
- **No CORS header** on responses (tested): browser fetch from our origin will fail. Options: `format=jsonp&callback=` (works but address still goes to Census, via a script tag), or a thin proxy route (address transits our server; do not log). Use `/locations/onelineaddress` (coordinates only) since we get districts locally anyway.
- Privacy: address goes to Census (gov, no key/account). No third-party ad tech. State this in privacy copy.
- Fallback geocoders if Census misses (new builds, PO boxes, rural AV): Nominatim/Photon (usage-policy limits), Esri World Geocoder (key + terms), LA County address points (data.lacounty.gov). Not tested.

## 2. LA County RR/CC (lavote.gov)
- Interactive Sample Ballot: https://www.lavote.gov/isb ; "Find My Election Information": https://www.lavote.gov/home/voting-elections/current-elections/find-my-election-information . Sample ballots mailing began Sept 2026 (lacounty.gov news 2026-09-24).
- I found NO public JSON/API behind ISB (did not reverse-engineer; may need a registration-style lookup with name/DOB/address, and scraping it would defeat privacy and likely violate ToS). Treat as "link out to official ISB" for authoritative per-voter ballot.
- Measure Information Booklet PDF: https://content.lavote.gov/docs/rrcc/documents/2026-measure-information-booklet-v-83455145b-15e7-40cc-92c3-2ffda6497eb6.pdf (source for district-specific measures).
- **Precinct -> district GIS (the key find)**:
  - Item: https://data.lacounty.gov/datasets/registrar-recorder-precincts-with-district-names (ArcGIS item id e0f19a39ec8d4d18a7f9e153e9e70b4f)
  - REST: `https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Registrar_Recorder_Precincts_with_District_Names/FeatureServer/2` (layer id is **2**, name SubprecinctPifInfoName; maxRecordCount 2000; 33,236 features; CORS `access-control-allow-origin: *`)
  - Fields (selected): PRECINCT, DIST_CONG, DIST_STSEN, DIST_STASS, DIST_SUP, DIST_BEQ, DST_CITY/DIV_CITY (e.g. "CITY OF LOS ANGELES 14TH COUNCIL"), DST_USD/DIV_USD ("LOS ANGELES USD-BD EDUCATION 2"), DST_HSD/DST_ESD, DST_JRC/DIV_JRC ("MT SAN ANTONIO COMMUNITY COLL TA3"), DST_WA/MWD/FIR/PARK/LIB/SAN/MOS/FLD/TRN/CEM/HOSP... etc. Value `0` or blank = none.
  - Test on 200 N Spring St point: CD34, SD26, AD54, Sup 1, BOE 3, LA city council 14, LAUSD board 2, LA Community College, plus MWD, LA County Flood Control, West Vector Control.
  - Other related items: Registrar_Recorder_Precincts (FeatureServer), Registrar_Recorder_Precincts_Election, Los Angeles County Districts (https://data.lacounty.gov/datasets/los-angeles-county-districts).
  - Bulk GeoJSON size: 2,000 features with maxAllowableOffset=0.0001 deg (~11 m), precision 5 = ~695 KB -> estimate ~11-12 MB raw for all 33,236 (est., not downloaded); roughly 3-4 MB gzipped (guess). Better: dissolve by distinct district-tuple (1,067 distinct school/CC/city combos in one projection, more for full tuple) and/or tile by grid; or use topojson.
  - Licensing: County terms of use https://egis-lacounty.hub.arcgis.com/pages/terms-of-use/ ("informational purposes... may change/discontinue access at any time"). Redistribution of derived data not clearly addressed - **confirm with RR/CC GIS or cite in attribution; uncertain**. Download once at build time; do not call the REST service live from users' browsers (would leak lat/lng and depend on uptime).
  - Boundary caveat: polygons can lag; voters near edges should be told to confirm on their official sample ballot/ISB.
- Maps & GIS pages: https://www.lavote.gov/home/voting-elections/election-resources/election-maps ; https://www.lavote.gov/home/voting-elections/election-resources/types-of-gis-maps-and-data

## 3. Other boundary sources
- **AB 604 / Prop 50 congressional**: Statewide Database https://statewidedatabase.org/pub/data/d25/AB604.zip (1,599,989 bytes; shapefile; also block equivalency) ; CA GIS FeatureServer `https://services3.arcgis.com/uknczv4rpevve42E/ArcGIS/rest/services/AB_604_-_California_Congressional_Districts_2027-2032_as_enacted_by_Proposition_50_view/FeatureServer/0` (field DISTRICT) ; item https://gis.data.ca.gov/maps/California::ab-604-california-congressional-districts-2027-2032-as-enacted-by-proposition-50/about . Use for QA of RR/CC CDs. Note: in effect for Nov 2026 election; seated Jan 3 2027.
- State Senate/Assembly: unchanged from 2021 CRC maps (Census labels them "2026 State Legislative Districts"). TIGER: https://www2.census.gov/geo/tiger/TIGER2025/SLDU/tl_2025_06_sldu.zip is 3.28 MB (2025 file; 2026 equivalent path not checked; 404 for TIGER2026/CD index listing).
- Census TIGERweb 120th CD layer: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/0
- LA City council districts / LAUSD board: https://geohub.lacity.org/datasets/lausd-board-of-education-districts ; REST https://maps.lacity.org/lahub/rest/services/LAUSD_Schools/MapServer/7 (supports geoJSON). Council districts on geohub.lacity.org (not individually verified; RR/CC layer already has DIV_CITY council 1-15).
- LA County GIS hub: https://egis-lacounty.hub.arcgis.com/ (CSV/GeoJSON/shp downloads).
- BOE, supervisorial, community college TAs: all present in RR/CC layer (BOE Dist 3 for LA core; supervisorial via DIST_SUP). Standalone downloads not located; not needed.
- Not checked: whether a given city's council seat is actually on the Nov 2026 ballot (data says district membership only, not contests).

## 4. Google Civic Information API (voterInfoQuery)
- Docs: https://developers.google.com/civic-information/docs/v2/elections/voterInfoQuery . Requires API key (we have none); contests only if the state/county supplies VIP feed data.
- Google group reports (https://groups.google.com/g/google-civicinfo-api) state California could not provide contest data to Google for counties ("will not be available in time for the California primary"); thread date not confirmed here. Representatives API was turned down (https://groups.google.com/g/google-civicinfo-api/c/9fwFn-dhktA).
- Also sends full address to Google. Verdict: do not depend on it; not testable without key. UNCERTAIN for Nov 2026.

## 5. Paid / other
- Cicero (https://www.cicerodata.com/api/): address -> districts + officials; $298/5,000 credits commercial ($268 nonprofit/gov) up to $8,848/1M; sends address to vendor; ToS not reviewed.
- BallotReady API (elections, candidates, measures, districts; key required, pricing not public - contact sales). Ballotpedia API: paid subscription or flat files. Ballotpedia sample ballot lookup tools list: https://ballotpedia.org/Sample_ballot_lookup_tools . All send the address to a third party; none needed for district membership.

## Recommended architecture
1. Build step: script pulls RR/CC layer (paged 2,000 at a time, outSR=4326, simplified), keeps only needed fields, converts values to compact codes, writes TopoJSON/GeoJSON tiles to /public (commit URL + size, not data, until licensing checked).
2. Client: user enters address -> geocode (Census via thin no-log proxy or JSONP; coordinate-only endpoint) -> point-in-polygon (e.g. flatgeobuf/geojson + turf `booleanPointInPolygon`, lazy-load tile by lat/lng grid) -> district tuple -> match against a contests table keyed by district names -> show.
3. Cross-check CD/SD/AD against the Census geocoder's own layers when available (cheap integrity test).
4. Link out to https://www.lavote.gov/isb as authoritative; show disclaimer for boundary-edge addresses.
5. Privacy copy: only the street address goes to Census (or our proxy); polygons and district matching happen locally; no analytics on the address.

## Open questions / blockers
- Licensing of redistributing RR/CC derived polygons (County ToU is vague) - ask RR/CC GIS (data.lacounty.gov contact).
- Census geocoder has no CORS: need proxy or JSONP; uptime/rate limits undocumented.
- Mapping DIST_* strings (e.g. "LOS ANGELES USD-BD EDUCATION 2") to contest records requires our own contests table; source for contests (RR/CC measure booklet, candidate statements, SoS) not yet researched.
- Full-county QA of congressional values against AB 604 not done (18-point sample only).
- Poorly geocoded/PO box/new construction addresses fall back to manual selection or ISB link.

## Decision (2026-09-30)

Verified live: a single point query against the RR/CC layer (CORS-enabled) returns every district
for that location, e.g. 200 N Spring St → `DIST_CONG: "34TH US CONGRESSIONAL"`, `DIST_STSEN: "26TH ST SENATE"`,
`DIST_STASS: "54TH STATE ASSEMBLY"`, `DIST_SUP: "1ST SUPERVISORIAL"`, `DIST_BEQ: "3RD BOARD OF EQUALIZATION"`,
`DIV_CITY: "CITY OF LOS ANGELES 14TH COUNCIL"`, `DIV_USD: "LOS ANGELES USD-BD EDUCATION 2"`, `DST_JRC: "LOS ANGELES COMMUNITY COLLEGE"`.

So instead of shipping ~11 MB of polygons:
1. Geocode via a stateless, non-logging Next.js route handler that proxies the Census geocoder
   (or skip it entirely with browser geolocation).
2. Browser queries the RR/CC FeatureServer directly with the lat/lng (`geometryType=esriGeometryPoint`,
   `inSR=4326`, `returnGeometry=false`, only the needed `outFields`).
3. `lib/districts.ts` maps those attribute strings to contest ids.
