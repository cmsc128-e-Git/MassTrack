import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Button";
import { calculate_formula, get_formula } from "@/dependencies/formulas/registry";
import type { Entry, ProjectDocument } from "@/projects/model";
import { loadActiveProjectId, loadProject, setActiveProjectId } from "@/projects/storage";
import { useColors } from "@/theme";

type Cell = string | number | null;
type Column = { label: string; width?: number; value: (entry: Entry, index: number) => Cell; formula?: string };

// Equations that summarize a whole column; shown as footer rows when the project uses them.
const SUMMARIES = [
  { name: "add", label: "Total (all rows)" },
  { name: "average", label: "Mean (all rows)" },
];

const MEASURED_COLUMNS: Column[] = [
  { label: "#", width: 44, value: (_, index) => index + 1 },
  { label: "Species", value: (entry) => entry.species },
  { label: "DBH (cm)", width: 84, value: (entry) => entry.dbh_cm },
  { label: "H (m)", width: 72, value: (entry) => entry.height_m },
];

// Rows saved before results existed only have basal_area_cm2.
const resultsOf = (entry: Entry): Record<string, number> =>
  entry.results ?? (entry.basal_area_cm2 === undefined ? {} : { basal_area: entry.basal_area_cm2 });

// One column per formula any row has a result for, labelled from the formula registry.
function resultColumns(entries: Entry[]): Column[] {
  const names = new Set(entries.flatMap((entry) => Object.keys(resultsOf(entry))));
  return [...names].map((name) => {
    const formula = get_formula(name);
    const label = formula?.symbol ? `${formula.symbol}${formula.unit ? ` (${formula.unit})` : ""}*` : name;
    return { label, width: 96, formula: name, value: (entry) => resultsOf(entry)[name] ?? null };
  });
}

// Up to 2 decimals without padding, so 0.05 m stays 0.05 instead of rounding to 0.1.
const format = (cell: Cell) =>
  cell === null ? "—" : typeof cell === "number" ? cell.toLocaleString(undefined, { maximumFractionDigits: 2 }) : cell;

// The project named in the URL, otherwise the last project selected on the dashboard.
function pickProject(projectId?: string): ProjectDocument | null {
  const activeProjectId = projectId ?? loadActiveProjectId();
  return activeProjectId ? loadProject(activeProjectId) : null;
}

export default function Sheet() {
  const c = useColors();
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const [document, setDocument] = useState<ProjectDocument | null>(null);

  // Tabs stay mounted, so reload every time the Sheet tab comes into view to show newly saved rows.
  useFocusEffect(
    useCallback(() => {
      const next = pickProject(projectId);
      if (next) setActiveProjectId(next.project.project_id);
      setDocument(next);
    }, [projectId]),
  );

  if (!document) {
    return (
      <View style={[styles.emptyScreen, { backgroundColor: c.bg }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No project yet</Text>
          <Text style={[styles.note, styles.emptyNote, { color: c.muted }]}>Create a project from the Projects tab to start recording data.</Text>
          <View style={styles.primaryAction}>
            <Button title="Go to projects" onPress={() => router.navigate("/")} />
          </View>
        </View>
      </View>
    );
  }

  const { project } = document;
  const entries = project.data_block.entries;
  const results = resultColumns(entries);
  const columns = [...MEASURED_COLUMNS, ...results];
  const summaries = SUMMARIES.filter(({ name }) => project.data_block.organisms.equations.includes(name));
  const addEntry = () => router.push({ pathname: "/input", params: { projectId: project.project_id } });

  // Species stretches to fill wide screens; every other column keeps a fixed width so rows line up.
  const cellStyle = (column: Column, i: number) => [
    styles.cell,
    column.width ? { width: column.width } : styles.speciesCell,
    i !== 1 && styles.numericCell,
    column.formula && [styles.calculated, { backgroundColor: c.bg }],
  ];

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={[styles.projectName, { color: c.text }]} numberOfLines={1}>{project.name}</Text>
        <Text style={[styles.note, { color: c.muted }]}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · saved on this device
        </Text>
      </View>

      {entries.length === 0 ? (
        <Text style={[styles.note, { color: c.muted }]}>No entries yet. Measure an individual in Input to add the first row.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll} contentContainerStyle={styles.tableContent}>
          <View style={[styles.table, { borderColor: c.border }]}>
            <View role="row" style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}>
              {columns.map((column, i) => (
                <Text key={column.label} role="columnheader" style={[cellStyle(column, i), styles.header, { color: c.text }]}>
                  {column.label}
                </Text>
              ))}
            </View>
            {entries.map((entry, index) => (
              <View
                key={entry.entry_id}
                role="row"
                aria-label={columns.map((column) => `${column.label} ${format(column.value(entry, index))}`).join(", ")}
                style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
              >
                {columns.map((column, i) => (
                  <Text key={column.label} numberOfLines={1} style={[cellStyle(column, i), { color: c.text }]}>
                    {format(column.value(entry, index))}
                  </Text>
                ))}
              </View>
            ))}
            {summaries.map(({ name, label }) => (
              <View key={name} role="row" style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}>
                {columns.map((column, i) => {
                  const values = column.formula ? entries.map((entry, index) => column.value(entry, index)).filter((v): v is number => typeof v === "number") : [];
                  const cell = i === 1 ? label : column.formula ? calculate_formula(name, ...values) ?? null : "";
                  return (
                    <Text key={column.label} numberOfLines={1} style={[cellStyle(column, i), styles.header, { color: c.text }]}>
                      {format(cell)}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {results.map(({ formula }) => {
        const definition = formula ? get_formula(formula) : undefined;
        return definition?.expression ? (
          <Text key={formula} style={[styles.note, { color: c.muted }]}>* Calculated: {definition.expression}. Read-only; add rows in Input.</Text>
        ) : null;
      })}
      <View style={styles.primaryAction}>
        <Button title="+ Add entry" onPress={addEntry} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignSelf: "center", width: "100%", maxWidth: 1120, padding: 20, gap: 16, paddingBottom: 32 },
  primaryAction: { width: "100%", maxWidth: 320, alignSelf: "center" },
  heading: { gap: 2 },
  projectName: { fontSize: 22, fontWeight: "700" },
  // ScrollView grows to fill its parent by default; stop that so the table is only as tall as its rows.
  tableScroll: { flexGrow: 0 },
  // ...but let the table stretch sideways to fill wide screens.
  tableContent: { flexGrow: 1 },
  table: { flexGrow: 1, borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  row: { flexDirection: "row", minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { paddingHorizontal: 10, paddingVertical: 14, fontSize: 14 },
  speciesCell: { flex: 1, minWidth: 160 },
  header: { fontSize: 13, fontWeight: "700" },
  numericCell: { textAlign: "right" },
  calculated: { fontWeight: "700" },
  note: { fontSize: 14, lineHeight: 20 },
  emptyScreen: { flex: 1, padding: 20, justifyContent: "center" },
  empty: { width: "100%", maxWidth: 520, alignSelf: "center", alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 24, fontWeight: "700" },
  emptyNote: { textAlign: "center" },
});
