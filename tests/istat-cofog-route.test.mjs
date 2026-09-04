import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server.js";
import "./helpers/register-ts-alias.mjs";

const { GET } = await import("../src/app/api/spese/istat-cofog/route.ts");

test("la route restituisce il territorio e l'anno richiesti", async () => {
  const response = GET(new NextRequest("http://localhost/api/spese/istat-cofog?territorio=IT&anno=2023"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control") ?? "", /max-age=3600/);
  const payload = await response.json();
  assert.equal(payload.datasetId, "istat-cofog");
  assert.equal(payload.observations.length, 11);
  assert.ok(payload.caveats.length > 0);
  assert.equal(payload.source.licenseId, "not-declared");
  assert.equal(payload.measure.code, "P3_D_W0_S13");
});

test("la route rifiuta una richiesta senza filtri", async () => {
  const response = GET(new NextRequest("http://localhost/api/spese/istat-cofog"));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /almeno un filtro/i);
});

test("la route rifiuta anni non canonici o fuori periodo", () => {
  for (const value of ["2023x", "23", "2.023", "", "-1"]) {
    assert.equal(GET(new NextRequest(`http://localhost/api/spese/istat-cofog?anno=${value}`)).status, 400, value);
  }
  assert.equal(GET(new NextRequest("http://localhost/api/spese/istat-cofog?anno=2024")).status, 400);
});

test("la route rifiuta codici malformati e sconosciuti", () => {
  assert.equal(GET(new NextRequest("http://localhost/api/spese/istat-cofog?territorio=IT'--")).status, 400);
  assert.equal(GET(new NextRequest("http://localhost/api/spese/istat-cofog?territorio=ZZ")).status, 400);
  assert.equal(GET(new NextRequest("http://localhost/api/spese/istat-cofog?funzione=G999")).status, 400);
});
