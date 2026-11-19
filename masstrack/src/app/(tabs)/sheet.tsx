import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@/components/Button";
import { get_formula } from "@/dependencies/formulas/registry";
import type { Entry, ProjectDocument } from "@/projects/model";
import { calculateSheetSummaries, entryResults } from "@/projects/recompute";
import { loadActiveProjectId, loadProject, setActiveProjectId, updateEntryMeasurements } from "@/projects/storage";
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

// One column per formula any row has a result for, labelled from the formula registry.
function resultColumns(entries: Entry[]): Column[] {
  const names = new Set(entries.flatMap((entry) => Object.keys(entryResults(entry))));
  return [...names].map((name) => {
    const formula = get_formula(name);
    const label = formula?.symbol ? `${formula.symbol}${formula.unit ? ` (${formula.unit})` : ""}*` : name;
    return { label, width: 96, formula: name, value: (entry) => entryResults(entry)[name] ?? null };
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
  const [edit, setEdit] = useState<{ id: string; row: number; dbh: string; height: string } | null>(null);
  const [feedback, setFeedback] = useState("");
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // Tabs stay mounted, so reload every time the Sheet tab comes into view to show newly saved rows.
  useFocusEffect(
    useCallback(() => {
      const next = pickProject(projectId);
      if (next) setActiveProjectId(next.project.project_id);
      setDocument(next);
      setEdit(null);
      setFeedback("");
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
  const summaryValues = project.data_block.sheet_summaries ??
    calculateSheetSummaries(project.data_block.organisms.equations, entries);
  const addEntry = () => router.push({ pathname: "/input", params: { projectId: project.project_id } });

  function saveMeasurements() {
    if (!edit) return;
    try {
      const saved = updateEntryMeasurements(project.project_id, edit.id, {
        dbh_cm: Number(edit.dbh),
        height_m: edit.height.trim() === "" ? null : Number(edit.height),
      });
      if (!saved) throw new Error("This project is no longer available.");
      setDocument(saved);
      setEdit(null);
      setFeedback("Measurements and results saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save measurements.");
    }
  }

  // Species stretches to fill wide screens; every other column keeps a fixed width so rows line up.
  const cellStyle = (column: Column, i: number) => [
    styles.cell,
    column.width ? { width: column.width } : styles.speciesCell,
    i !== 1 && styles.numericCell,
    column.formula && [styles.calculated, { backgroundColor: c.bg }],
  ];

  return (
    <ScrollView ref={scrollRef} style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.heading}>
        <Text style={[styles.projectName, { color: c.text }]} numberOfLines={1}>{project.name}</Text>
        <Text style={[styles.note, { color: c.muted }]}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"} · saved on this device
        </Text>
      </View>

      {edit && (
        <View style={styles.editor}>
          <Text style={[styles.projectName, { color: c.text }]}>Edit row {edit.row}</Text>
          <Text style={{ color: c.text }}>DBH (cm)</Text>
          <TextInput accessibilityLabel="DBH in centimetres" keyboardType="decimal-pad" value={edit.dbh}
            onChangeText={(dbh) => setEdit({ ...edit, dbh })}
            style={[styles.editInput, { color: c.text, borderColor: c.border }]} />
          <Text style={{ color: c.text }}>Height (m, optional)</Text>
          <TextInput accessibilityLabel="Optional height in metres" keyboardType="decimal-pad" value={edit.height}
            onChangeText={(height) => setEdit({ ...edit, height })}
            style={[styles.editInput, { color: c.text, borderColor: c.border }]} />
          <Button title="Save measurements" onPress={saveMeasurements} />
          <Button title="Cancel" onPress={() => { setEdit(null); setFeedback(""); }} />
        </View>
      )}
      {feedback !== "" && <Text accessibilityLiveRegion="polite" style={[styles.note, { color: c.text }]}>{feedback}</Text>}

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
              <Text role="columnheader" style={[styles.editCell, styles.header, { color: c.text }]}>Actions</Text>
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
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit measurements for row ${index + 1}`}
                  onPress={() => {
                    setFeedback("");
                    setEdit({ id: entry.entry_id, row: index + 1, dbh: String(entry.dbh_cm), height: entry.height_m?.toString() ?? "" });
                    scrollRef.current?.scrollTo({ y: 0 });
                  }}
                  style={styles.editCell}>
                  <Text style={{ color: c.accent }}>Edit</Text>
                </Pressable>
              </View>
            ))}
            {summaries.map(({ name, label }) => (
              <View key={name} role="row" style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}>
                {columns.map((column, i) => {
                  const cell = i === 1 ? label : column.formula ? summaryValues[name]?.[column.formula] ?? null : "";
                  return (
                    <Text key={column.label} numberOfLines={1} style={[cellStyle(column, i), styles.header, { color: c.text }]}>
                      {format(cell)}
                    </Text>
                  );
                })}
                <View style={styles.editCell} />
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
  editor: { gap: 8, width: "100%", maxWidth: 360 },
  editInput: { minHeight: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12 },
  editCell: { width: 80, minHeight: 48, alignItems: "center", justifyContent: "center", padding: 12 },
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
