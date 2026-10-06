import { Pressable, StyleSheet, View } from "react-native";
import { colors, fonts, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { T } from "./Text";

export function Chip({
  label,
  selected,
  disabled,
  icon,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? colors.white : colors.leafDeep} /> : null}
      <T style={{ fontFamily: fonts.semibold, fontSize: 14, color: selected ? colors.white : colors.ink }}>{label}</T>
    </Pressable>
  );
}

/** Mutually exclusive options as one control (meal type, sex, goal). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === o.value }}
          onPress={() => onChange(o.value)}
          style={[styles.segment, value === o.value && styles.segmentOn]}
        >
          <T
            numberOfLines={1}
            style={{ fontFamily: fonts.semibold, fontSize: 14, color: value === o.value ? colors.ink : colors.inkSoft }}
          >
            {o.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.leaf, borderColor: colors.leaf },
  segmentRow: { flexDirection: "row", backgroundColor: colors.sunk, borderRadius: radius.pill, padding: 4 },
  segment: { flex: 1, alignItems: "center", paddingVertical: space.sm, borderRadius: radius.pill },
  segmentOn: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
});
