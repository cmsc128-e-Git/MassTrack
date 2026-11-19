import { add, average, basalArea, type Formula } from "./formulas_actual";

export type MeasuredField = "dbh_cm" | "height_m";
export type FormulaInputs =
  | { scope: "entry"; fields: MeasuredField[] }
  | { scope: "calculation"; formula: string };

export type FormulaDefinition = {
  name: string;
  description: string;
  expression?: string;
  // Short column name and unit for per-individual results shown in the data sheet.
  symbol?: string;
  unit?: string;
  inputs: FormulaInputs;
  calculate: Formula;
};

const formulaDefinitions: Record<string, FormulaDefinition> = {
  add: {
    name: "add",
    description: "Adds all supplied values.",
    calculate: add,
    inputs: { scope: "calculation", formula: "basal_area" },
  },
  average: {
    name: "average",
    description: "Calculates the arithmetic mean of the supplied values.",
    calculate: average,
    inputs: { scope: "calculation", formula: "basal_area" },
  },
  basal_area: {
    name: "basal_area",
    description: "Calculates basal area from diameter in centimetres.",
    expression: "BA = π × (D/2)²",
    symbol: "BA",
    unit: "cm²",
    calculate: basalArea,
    inputs: { scope: "entry", fields: ["dbh_cm"] },
  },
};

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function find_formula(name: string): FormulaDefinition[] {
  const search = normalize(name);

  return Object.values(formulaDefinitions).filter((formula) =>
    normalize(formula.name).includes(search),
  );
}

export function get_formula(name: string): FormulaDefinition | undefined {
  return formulaDefinitions[normalize(name)];
}

export function calculate_formula(
  name: string,
  ...values: number[]
): number | undefined {
  return get_formula(name)?.calculate(...values);
}
