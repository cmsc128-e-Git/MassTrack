import { calculateEntryResults, calculateGroupResults } from "../dependencies/formulas/recompute";
import { find_formula } from "../dependencies/formulas/registry";
import type { DataBlock, Entry } from "./model";

function sameItems(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function entryResults(entry: Entry): Record<string, number> {
  return {
    ...(entry.basal_area_cm2 === undefined ? {} : { basal_area: entry.basal_area_cm2 }),
    ...entry.results,
  };
}

export function calculateSheetSummaries(
  equations: readonly string[],
  entries: readonly Entry[],
): NonNullable<DataBlock["sheet_summaries"]> {
  const rows = entries.map(entryResults);
  const columns = new Set(rows.flatMap(Object.keys));
  const summaries: NonNullable<DataBlock["sheet_summaries"]> = {};
  for (const formula of find_formula("")) {
    if (formula.inputs.scope !== "calculation" || !equations.includes(formula.name)) continue;
    const results: Record<string, number> = {};
    for (const column of columns) {
      const values = rows.map((row) => row[column]).filter(Number.isFinite);
      if (values.length === 0) continue;
      const result = formula.calculate(...values);
      if (Number.isFinite(result)) results[column] = result;
    }
    summaries[formula.name] = results;
  }
  return summaries;
}

export function recomputeDataBlock(next: DataBlock, previous?: DataBlock): DataBlock {
  const previousEntries = new Map(previous?.entries.map((entry) => [entry.entry_id, entry]));
  const changedIds = new Set<string>();
  const entryFormulas = find_formula("").filter((formula) => formula.inputs.scope === "entry");
  const entries = next.entries.map((entry) => {
    const old = previousEntries.get(entry.entry_id);
    previousEntries.delete(entry.entry_id);
    if (old && old.dbh_cm === entry.dbh_cm && old.height_m === entry.height_m) return entry;

    changedIds.add(entry.entry_id);
    const results = entryResults(entry);
    for (const formula of entryFormulas) delete results[formula.name];
    Object.assign(results, calculateEntryResults(entry));
    if (!Number.isFinite(results.basal_area)) {
      throw new Error("The diameter must produce a finite basal area.");
    }
    const updated = { ...entry, results };
    delete updated.basal_area_cm2;
    return updated;
  });
  for (const id of previousEntries.keys()) changedIds.add(id);

  const entriesById = new Map(entries.map((entry) => [entry.entry_id, entry]));
  const previousCalculations = new Map(previous?.calculations?.map((calculation) => [calculation.calculation_id, calculation]));
  const calculations = next.calculations?.map((calculation) => {
    const old = previousCalculations.get(calculation.calculation_id);
    if (old &&
        sameItems(old.entry_ids, calculation.entry_ids) &&
        sameItems(old.equations, calculation.equations) &&
        !calculation.entry_ids.some((id) => changedIds.has(id))) return calculation;

    const rows = calculation.entry_ids.map((id) => entriesById.get(id));
    const results = rows.every((row): row is Entry => row !== undefined)
      ? calculateGroupResults(calculation.equations, rows.map(entryResults))
      : {};
    return { ...calculation, results };
  });

  const equationsChanged = !previous || !sameItems(next.organisms.equations, previous.organisms.equations);
  const sheetSummaries = changedIds.size || equationsChanged
    ? calculateSheetSummaries(next.organisms.equations, entries)
    : next.sheet_summaries;
  return { ...next, entries, calculations, sheet_summaries: sheetSummaries };
}
