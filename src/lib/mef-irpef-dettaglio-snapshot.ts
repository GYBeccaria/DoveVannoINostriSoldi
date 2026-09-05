import "server-only";

import dataArtifact from "@/data/generated/mef-irpef-dettaglio-2017-2025.data.json";
import metadataArtifact from "@/data/generated/mef-irpef-dettaglio-2017-2025.meta.json";
import {
  validateMefIrpefDettaglioBundle,
  type MefIrpefDettaglioData,
  type MefIrpefDettaglioMetadata,
  type MefIrpefDettaglioRow,
  type MefIrpefDettaglioSchema,
  type MefIrpefDettaglioTable,
} from "@/lib/data/mef-irpef-dettaglio-contract";

const validated = validateMefIrpefDettaglioBundle(dataArtifact, metadataArtifact);

export const mefIrpefDettaglioData: MefIrpefDettaglioData = validated.data;
export const mefIrpefDettaglioMetadata: MefIrpefDettaglioMetadata = validated.metadata;

const FAMILIES = new Set(mefIrpefDettaglioData.tables.map((table) => table.family));
const BREAKDOWNS = new Set(mefIrpefDettaglioData.tables.map((table) => table.breakdown));

export type MefIrpefDettaglioQuery = Readonly<{
  family?: string;
  breakdown?: string;
  year?: number;
}>;

export type MefIrpefDettaglioTableResult = Readonly<{
  table: MefIrpefDettaglioTable;
  schema: MefIrpefDettaglioSchema;
  rows: readonly { keys: readonly string[]; values: readonly (number | null)[] }[];
}>;

export type MefIrpefDettaglioQueryResult = Readonly<{
  datasetId: string;
  period: MefIrpefDettaglioData["period"];
  caveats: readonly string[];
  instruments: MefIrpefDettaglioData["instruments"];
  availability: MefIrpefDettaglioData["availability"];
  tables: readonly MefIrpefDettaglioTableResult[];
  coverage: MefIrpefDettaglioData["coverage"];
  source: Readonly<{ owner: string; landingUrl: string; licenseId: string; observedAt: string }>;
}>;

function normalizeYear(year: number | undefined): number | undefined {
  if (year === undefined) return undefined;
  const { from, to } = mefIrpefDettaglioData.period;
  if (!Number.isSafeInteger(year) || year < from || year > to) {
    throw new Error(`Anno fuori dal periodo coperto (${from}-${to}).`);
  }
  return year;
}

function normalizeFamily(family: string | undefined): string | undefined {
  if (family === undefined) return undefined;
  const value = family.toLowerCase();
  if (!FAMILIES.has(value as never)) {
    throw new Error("Famiglia non riconosciuta: usare tipo_reddito, calcolo_irpef oppure bonus_irpef.");
  }
  return value;
}

function normalizeBreakdown(breakdown: string | undefined): string | undefined {
  if (breakdown === undefined) return undefined;
  const map: Record<string, string> = {
    regione: "regione", region: "regione",
    classeeta: "classeEta", classeEta: "classeEta", eta: "classeEta",
    sesso: "sesso", sex: "sesso",
  };
  const value = map[breakdown] ?? map[breakdown.toLowerCase()];
  if (!value || !BREAKDOWNS.has(value as never)) {
    throw new Error("Taglio non riconosciuto: usare regione, classeEta oppure sesso.");
  }
  return value;
}

export function queryMefIrpefDettaglio(query: MefIrpefDettaglioQuery = {}): MefIrpefDettaglioQueryResult {
  const family = normalizeFamily(query.family);
  const breakdown = normalizeBreakdown(query.breakdown);
  const year = normalizeYear(query.year);

  const wanted = new Map<number, MefIrpefDettaglioTable>();
  mefIrpefDettaglioData.tables.forEach((table, index) => {
    if (family !== undefined && table.family !== family) return;
    if (breakdown !== undefined && table.breakdown !== breakdown) return;
    if (year !== undefined && table.year !== year) return;
    wanted.set(index, table);
  });

  const byTable = new Map<number, { keys: readonly string[]; values: readonly (number | null)[] }[]>();
  for (const raw of mefIrpefDettaglioData.rows) {
    const row = raw as MefIrpefDettaglioRow;
    if (!wanted.has(row.t)) continue;
    const bucket = byTable.get(row.t) ?? [];
    bucket.push({ keys: row.k, values: row.v });
    byTable.set(row.t, bucket);
  }

  const tables: MefIrpefDettaglioTableResult[] = [...wanted.entries()].map(([index, table]) => ({
    table,
    schema: mefIrpefDettaglioData.schemas[table.schemaId],
    rows: byTable.get(index) ?? [],
  }));

  return {
    datasetId: mefIrpefDettaglioData.datasetId,
    period: mefIrpefDettaglioData.period,
    caveats: mefIrpefDettaglioData.caveats,
    instruments: mefIrpefDettaglioData.instruments,
    availability: mefIrpefDettaglioData.availability,
    tables,
    coverage: mefIrpefDettaglioData.coverage,
    source: {
      owner: mefIrpefDettaglioMetadata.source.owner,
      landingUrl: mefIrpefDettaglioMetadata.source.landingUrl,
      licenseId: mefIrpefDettaglioMetadata.source.licenseId,
      observedAt: mefIrpefDettaglioMetadata.observedAt,
    },
  };
}
