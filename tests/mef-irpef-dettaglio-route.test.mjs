import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import "./helpers/register-ts-alias.mjs";

const { GET } = await import("../src/app/api/territori/irpef-dettaglio/route.ts");
const U = "http://localhost/api/territori/irpef-dettaglio";

test("la route restituisce la tabella richiesta", async () => {
  const response = GET(new NextRequest(`${U}?famiglia=tipo_reddito&taglio=regione&anno=2025`));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=3600/);
  const payload = await response.json();
  assert.equal(payload.datasetId, "mef-irpef-dettaglio");
  assert.equal(payload.tables.length, 1);
  assert.ok(payload.tables[0].rows.length > 0);
  assert.equal(payload.source.licenseId, "CC-BY-3.0-IT");
  assert.ok(payload.caveats.length > 0);
});

test("la route rifiuta una richiesta senza filtri", async () => {
  const response = GET(new NextRequest(U));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /almeno un filtro/i);
});

test("la route rifiuta anni non canonici o fuori periodo", () => {
  for (const v of ["2025x", "25", "2.025", "", "-1"]) {
    assert.equal(GET(new NextRequest(`${U}?anno=${v}`)).status, 400, v);
  }
  assert.equal(GET(new NextRequest(`${U}?anno=2026`)).status, 400);
});

test("la route rifiuta token malformati e valori sconosciuti", () => {
  assert.equal(GET(new NextRequest(`${U}?famiglia=tipo'--`)).status, 400);
  assert.equal(GET(new NextRequest(`${U}?famiglia=iva`)).status, 400);
  assert.equal(GET(new NextRequest(`${U}?taglio=provincia`)).status, 400);
});
