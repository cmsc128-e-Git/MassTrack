export function parseMeasure(value: string): number {
  const trimmed = value.trim();
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed)) return NaN;
  return Number(trimmed.replace(",", "."));
}
