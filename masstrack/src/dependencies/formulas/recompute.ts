import { find_formula, get_formula, type MeasuredField } from "./registry";

type Measurements = Record<MeasuredField, number | null>;

export function calculateEntryResults(entry: Measurements): Record<string, number> {
  const results: Record<string, number> = {};
  for (const formula of find_formula("")) {
    if (formula.inputs.scope !== "entry") continue;
    const values = formula.inputs.fields.map((field) => entry[field]);
    if (!values.every((value): value is number => value !== null && Number.isFinite(value))) {
      continue;
    }
    const result = formula.calculate(...values);
    if (Number.isFinite(result)) results[formula.name] = result;
  }
  return results;
}

// Resolve each prerequisite before its consumers, regardless of equation selection order.
export function calculateGroupResults(
  equations: readonly string[],
  rows: readonly Record<string, number>[],
): Record<string, number[]> {
  const resolved = new Map<string, number[] | undefined>();
  const visiting = new Set<string>();

  function resolve(name: string): number[] | undefined {
    if (resolved.has(name)) return resolved.get(name);
    const formula = get_formula(name);
    if (!formula || visiting.has(name) || rows.length === 0) return undefined;

    visiting.add(name);
    let result: number[] | undefined;
    if (formula.inputs.scope === "entry") {
      const values = rows.map((row) => row[formula.name]);
      if (values.every(Number.isFinite)) result = values;
    } else {
      const values = resolve(formula.inputs.formula);
      if (values) {
        const value = formula.calculate(...values);
        if (Number.isFinite(value)) result = [value];
      }
    }
    visiting.delete(name);
    resolved.set(name, result);
    return result;
  }

  return Object.fromEntries(equations.flatMap((name) => {
    const result = resolve(name);
    return result ? [[name, result]] : [];
  }));
}
