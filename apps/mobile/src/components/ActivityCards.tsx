import type { ExerciseEntry, WaterEntry } from "@kimbo/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { api } from "@/lib/api";
import { colors, radius, space } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";
import { Sheet } from "./Sheet";
import { T } from "./Text";
import { WATER_BLUE, WaterSheet } from "./WaterSheet";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const EXERCISE_ICON: Record<ExerciseEntry["kind"], IconName> = {
  run: "wind",
  weights: "anchor",
  walk: "navigation",
  cycle: "disc",
  yoga: "sun",
  sport: "award",
  other: "activity",
  manual: "zap",
};

/** A water log in Recently logged: the amount, the time, and Cal AI's "…" menu (add water, delete). */
export function WaterEntryCard({ entry }: { entry: WaterEntry }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <EntryCard
        icon={<Icon name="droplet" size={20} color={WATER_BLUE} />}
        title="Water"
        detail={`${entry.ml.toLocaleString("en-IN")} ml`}
        at={entry.loggedAt}
        menu={[{ label: "Add water", icon: "plus-circle", run: () => setAdding(true) }]}
        remove={() => api.deleteWater(entry.id)}
      />
      <WaterSheet visible={adding} onClose={() => setAdding(false)} />
    </>
  );
}

/** A workout in Recently logged, Cal AI-style: "204 Calories burned", then intensity and minutes. */
export function ExerciseEntryCard({ entry }: { entry: ExerciseEntry }) {
  return (
    <EntryCard
      icon={<Icon name={EXERCISE_ICON[entry.kind]} size={20} color={colors.ink} />}
      title={entry.label}
      detail={
        <View style={{ gap: 4 }}>
          <T variant="body">
            <T variant="heading">{entry.calories} Calories</T>
            <T variant="label"> burned</T>
          </T>
          {entry.intensity || entry.minutes ? (
            <View style={styles.meta}>
              {entry.intensity ? (
                <View style={styles.metaItem}>
                  <Icon name="sun" size={13} color={colors.terracotta} />
                  <T variant="caption">Intensity: {entry.intensity[0]!.toUpperCase() + entry.intensity.slice(1)}</T>
                </View>
              ) : null}
              {entry.minutes ? (
                <View style={styles.metaItem}>
                  <Icon name="clock" size={13} color={WATER_BLUE} />
                  <T variant="caption">{entry.minutes} Mins</T>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      }
      at={entry.loggedAt}
      menu={[]}
      remove={() => api.deleteExercise(entry.id)}
    />
  );
}

function EntryCard({
  icon,
  title,
  detail,
  at,
  menu,
  remove,
}: {
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
  at: string;
  menu: { label: string; icon: IconName; run: () => void }[];
  remove: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const del = useMutation({
    mutationFn: remove,
    onSuccess: async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setOpen(false);
      await queryClient.invalidateQueries();
    },
  });
  return (
    <View style={styles.card}>
      <View style={styles.icon}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="heading">{title}</T>
        {typeof detail === "string" ? <T variant="label">{detail}</T> : detail}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`More for ${title}`} hitSlop={12} onPress={() => setOpen(true)}>
          <Icon name="more-horizontal" size={20} color={colors.inkSoft} />
        </Pressable>
        <T variant="caption">{time(at)}</T>
      </View>
      <Sheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={{ gap: space.xs }}>
          {menu.map((m) => (
            <Pressable
              key={m.label}
              accessibilityRole="button"
              onPress={() => {
                setOpen(false);
                m.run();
              }}
              style={styles.option}
            >
              <Icon name={m.icon} size={20} color={colors.ink} />
              <T variant="bodyStrong">{m.label}</T>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" disabled={del.isPending} onPress={() => del.mutate()} style={styles.option}>
            <Icon name="trash-2" size={20} color={colors.terracotta} />
            <T variant="bodyStrong" tone="terracotta">
              {del.isPending ? "Deleting…" : "Delete"}
            </T>
          </Pressable>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  meta: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  option: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md },
});
