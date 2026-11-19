export type Cell = string | number | null;
export type Direction = "asc" | "desc";

// Spreadsheet-style sort: numbers by value, text alphabetically, empty cells always last.
// Returns a new array; rows with equal cells keep their original order.
export function sortRows<T>(rows: T[], cell: (row: T) => Cell, direction: Direction): T[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = cell(a);
    const y = cell(b);
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return sign * (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)));
  });
}
