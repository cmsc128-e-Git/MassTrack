import { add, average, basalArea, type Formula } from "./formulas_actual";

export type FormulaDefinition = {
  name: string;
  description: string;
  expression?: string;
  symbol?: string;
  unit?: string;
  inputsLabel: string;
  output: string;
  dependsOn: string;
  source: string;
  calculate: Formula;
};

const formulaDefinitions: Record<string, FormulaDefinition> = {
  add: {
    name: "add",
    description: "Calculates total basal area across the measured individuals.",
    expression: "TBA = Σᵢ₌₁ⁿ BAᵢ",
    symbol: "TBA",
    unit: "cm²",
    inputsLabel: "BAᵢ — basal area per individual (cm²)",
    output: "TBA — total basal area (cm²)",
    dependsOn: "The basal area of every measured individual.",
    source: "Wolfram Language, Total: https://reference.wolfram.com/language/ref/Total.html",
    calculate: add,
  },
  average: {
    name: "average",
    description: "Calculates the arithmetic mean basal area across the measured individuals.",
    expression: "BĀ = (Σᵢ BAᵢ) / n",
    symbol: "BĀ",
    unit: "cm²",
    inputsLabel: "BAᵢ — basal area per individual (cm²); n — number of individuals",
    output: "BĀ — average basal area (cm²)",
    dependsOn: "The basal area of every measured individual and their count.",
    source: "Wolfram MathWorld, Arithmetic Mean: https://mathworld.wolfram.com/ArithmeticMean.html",
    calculate: average,
  },
  basal_area: {
    name: "basal_area",
    description: "Calculates basal area from diameter in centimetres.",
    expression: "BA = π × (D/2)²",
    symbol: "BA",
    unit: "cm²",
    inputsLabel: "D — diameter at breast height (cm)",
    output: "BA — basal area per individual (cm²)",
    dependsOn: "That individual's DBH, converted to centimetres before calculation.",
    source: "Wolfram MathWorld, Circle (A = πr²): https://mathworld.wolfram.com/Circle.html",
    calculate: basalArea,
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
