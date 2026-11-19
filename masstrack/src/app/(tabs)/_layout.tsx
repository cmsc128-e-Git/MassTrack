import { Link } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { GlassView } from "expo-glass-effect";
import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolViewProps } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors, useScheme } from "@/theme";

// iOS uses SF Symbols; Android and web use Material Symbols.
const icon = (ios: SFSymbol, android: AndroidSymbol): SymbolViewProps["name"] => ({ ios, android, web: android });

const tabs = [
  { name: "index", title: "Projects", icon: icon("folder", "folder") },
  { name: "input", title: "Input", icon: icon("square.and.pencil", "edit_note") },
  { name: "sheet", title: "Sheet", icon: icon("tablecells", "table") },
  { name: "species", title: "Species", icon: icon("leaf", "eco") },
  { name: "dictionary", title: "Dictionary", icon: icon("book.closed", "menu_book") },
];

// Opens Settings from every tab header, so it is reachable without going back to Projects.
function SettingsButton() {
  const c = useColors();

  return (
    <Link href="/settings" asChild>
      <Pressable aria-label="Settings" style={styles.headerButton}>
        <SymbolView name={icon("gearshape", "settings")} tintColor={c.text} size={24} />
      </Pressable>
    </Link>
  );
}

export default function TabLayout() {
  const c = useColors();
  const dark = useScheme() === "dark";
  const { bottom, left, right } = useSafeAreaInsets();
  const sheetGradient = dark
    ? "linear-gradient(135deg, #c4d67a 0%, #a8c35e 100%)"
    : "linear-gradient(135deg, #1e6033 0%, #397b4c 100%)";

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        headerShadowVisible: false,
        headerTitleStyle: styles.title,
        tabBarInactiveTintColor: c.inactive,
        tabBarBackground: () => (
          <View
            pointerEvents="none"
            style={[
              styles.glassPill,
              {
                left: left + 12,
                right: right + 12,
                bottom: bottom + 4,
                borderColor: c.border,
                backgroundColor: dark ? "rgba(30,30,30,0.84)" : "rgba(255,255,255,0.84)",
              },
            ]}
          >
            <GlassView
              colorScheme={dark ? "dark" : "light"}
              glassEffectStyle="regular"
              tintColor={c.surface}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ),
        // Keep the 64pt touch area clear of the home-indicator while the glass pill floats above it.
        tabBarStyle: {
          height: 64 + bottom,
          paddingTop: 8,
          paddingBottom: bottom,
          paddingHorizontal: Math.max(left, right) + 12,
          backgroundColor: "transparent",
          borderTopWidth: 0,
        },
        tabBarIconStyle: styles.pill,
      }}
    >
      {tabs.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            headerTitle: name === "input" ? "New analysis" : title,
            headerRight: SettingsButton,
            tabBarButton: name === "sheet"
              ? (props) => (
                <Pressable
                  {...props}
                  ref={undefined}
                  style={[
                    props.style,
                    styles.sheetButton,
                    props["aria-selected"] && { backgroundImage: sheetGradient },
                  ]}
                />
              )
              : undefined,
            tabBarIcon: ({ focused, color }) => (
              <View style={styles.pill}>
                <SymbolView
                  name={icon}
                  tintColor={focused ? (name === "sheet" ? c.onAccent : c.accent) : color}
                  size={22}
                />
              </View>
            ),
            tabBarLabel: ({ focused, color, children }) => (
              <View style={styles.labelWrap}>
                <Text
                  style={[
                    styles.label,
                    {
                      color: focused ? (name === "sheet" ? c.onAccent : c.accent) : color,
                      fontWeight: focused ? "600" : "400",
                    },
                  ]}
                >
                  {children}
                </Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "600" },
  pill: { width: 52, height: 28, alignItems: "center", justifyContent: "center" },
  labelWrap: { minWidth: 52, minHeight: 20, alignItems: "center", gap: 3 },
  label: { fontSize: 12 },
  glassPill: { position: "absolute", top: 4, borderWidth: 1, borderRadius: 36, overflow: "hidden" },
  sheetButton: { borderRadius: 24, overflow: "hidden" },
  headerButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: 4 },
});
