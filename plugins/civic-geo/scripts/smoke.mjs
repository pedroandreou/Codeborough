// Zero-install sanity check for the civic-geo engine against the REAL datasets.
// Run from anywhere:  node plugins/civic-geo/scripts/smoke.mjs
// No build, no npm install, no OpenClaw needed - just Node.

import {
  facilities,
  listCoverage,
  geocode,
  normalisePostcode,
  findNearest,
  getDetails,
  safetyCount,
  routeSafety,
  DATA_DIR,
} from "../src/geo.mjs";

const line = (s) => console.log("\n" + "─".repeat(70) + "\n" + s);

console.log("DATA_DIR:", DATA_DIR);
console.log("facilities:", facilities());

line("COVERAGE");
for (const c of listCoverage())
  console.log(
    `${c.facility.padEnd(18)} ${String(c.total).padStart(5)}  ${Object.keys(c.boroughs).join(", ")}`,
  );

line('GEOCODE "1 Triton Square"');
const here = geocode("1 Triton Square");
console.log(here);

line("NEAREST 3 libraries to Triton Square");
console.log(JSON.stringify(findNearest({ lat: here.lat, lon: here.lon, category: "library", limit: 3 }), null, 2));

line("NEAREST 3 public toilets to Brixton (within 2km)");
const brixton = geocode("Brixton");
console.log(JSON.stringify(findNearest({ lat: brixton.lat, lon: brixton.lon, category: "toilet", limit: 3, radiusKm: 2 }), null, 2));

line("NEAREST polling station to Lambeth");
const lambeth = geocode("Lambeth");
const poll = findNearest({ lat: lambeth.lat, lon: lambeth.lon, category: "polling station", limit: 1 });
console.log(JSON.stringify(poll, null, 2));

line("DETAILS of that polling station");
if (poll.results[0]) console.log(JSON.stringify(getDetails(poll.results[0].id), null, 2));

line("SAFETY (CCTV) within 500m of Brixton");
console.log(JSON.stringify(safetyCount({ lat: brixton.lat, lon: brixton.lon, radiusM: 500 }), null, 2));

line("POSTCODE GEOCODING (offline, from our own data)");
// Find any nearby record that actually carries a postcode, to prove exact + outward.
const withPc = findNearest({ lat: brixton.lat, lon: brixton.lon, limit: 30 }).results
  .map((r) => /[a-z]{1,2}\d[a-z\d]?\s*\d[a-z]{2}/i.exec(r.address || "")?.[0])
  .find(Boolean);
console.log("sample postcode from data:", withPc, "->", normalisePostcode(withPc || ""));
if (withPc) {
  console.log("full   :", geocode(withPc));
  console.log("outward:", geocode((normalisePostcode(withPc) || " ").split(" ")[0]));
}
console.log("bogus  :", geocode("ZZ9 9ZZ"));

line("ROUTE SAFETY - monitored streets along Brixton -> nearest polling station");
const dest = findNearest({ lat: brixton.lat, lon: brixton.lon, category: "polling station", limit: 1 }).results[0];
if (dest) {
  const rs = routeSafety({ fromLat: brixton.lat, fromLon: brixton.lon, toLat: dest.lat, toLon: dest.lon, corridorM: 150 });
  console.log(`to ${dest.name}: ${rs.route_length_m} m, ${rs.cctv_count} cameras in corridor, ${rs.monitored_pct}% monitored`);
  console.log("nearest camera:", rs.nearest_cameras[0]?.name, `(${rs.nearest_cameras[0]?.distance_m} m off-route)`);
}

console.log("\n✅ smoke test ran. Eyeball the results above against expectations.");
