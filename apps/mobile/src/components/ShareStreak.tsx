import * as Haptics from "expo-haptics";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { colors, fonts, radius, space } from "@/lib/theme";
import { StreakFlame } from "./BadgeArt";
import { Icon, type IconName } from "./Icon";
import { Kimbo } from "./Kimbo";
import { Sheet } from "./Sheet";
import { T } from "./Text";

const WARM = ["#F2A541", "#FBD993", colors.paper];
const GREY = ["#7A7570", "#CFCAC2", colors.paper];

/**
 * A card worth sharing: gradient, big art, a title and a line or two, and the kimbo wordmark.
 * Earned: Share sends it as an image through the phone's share menu and Save puts it in the
 * gallery. Locked: the same card in grey with one disabled "Locked" button and what's left to do.
 */
export function ShareCard({
  visible,
  onClose,
  art,
  title,
  lines,
  locked,
  id,
}: {
  visible: boolean;
  onClose: () => void;
  art: ReactNode;
  title: string;
  lines: string[];
  locked?: string;
  id: string;
}) {
  const card = useRef<View>(null);
  const [note, setNote] = useState<string | null>(null);
  const stops = locked ? GREY : WARM;

  const snap = () => captureRef(card, { format: "png", quality: 1, result: "tmpfile" });

  const share = async () => {
    setNote(null);
    try {
      const uri = await snap();
      if (!(await Sharing.isAvailableAsync())) return setNote("Sharing isn't available on this phone.");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: `Share ${title}` });
    } catch {
      setNote("Couldn't make the image. Try again.");
    }
  };

  const save = async () => {
    setNote(null);
    try {
      const perm = await requestPermissionsAsync(true);
      if (!perm.granted) return setNote("Allow photo access to save the card.");
      await Asset.create(await snap());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setNote("Saved to your photos.");
    } catch {
      setNote("Couldn't save the card. Try again.");
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setNote(null);
        onClose();
      }}
    >
      <View style={{ gap: space.lg }}>
        {/* collapsable={false} keeps this a real native view so it can be captured as an image. */}
        <View ref={card} collapsable={false} style={styles.card}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={`${id}-bg`} x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={stops[0]} />
                <Stop offset="0.45" stopColor={stops[1]} />
                <Stop offset="1" stopColor={stops[2]} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}-bg)`} />
          </Svg>
          <View style={styles.cardTop}>
            <Kimbo mood={locked ? "idle" : "cheer"} size={34} />
            <T style={styles.wordmark}>kimbo</T>
          </View>
          {art}
          <T style={[styles.title, locked ? { color: colors.inkSoft } : undefined]} align="center">
            {title}
          </T>
          {lines.map((l) => (
            <T key={l} style={styles.sub} align="center">
              {l}
            </T>
          ))}
          {locked ? null : <T style={styles.tag}>Eating like home, one day at a time.</T>}
        </View>

        {locked ? (
          <View style={{ gap: space.sm }}>
            <View style={[styles.action, styles.actionLocked]}>
              <Icon name="lock" size={18} color={colors.white} />
              <T style={[styles.actionText, { color: colors.white }]}>Locked</T>
            </View>
            <T variant="label" align="center">
              {locked}
            </T>
          </View>
        ) : (
          <View style={styles.actions}>
            <Action icon="share-2" label="Share" onPress={share} primary />
            <Action icon="download" label="Save" onPress={save} />
          </View>
        )}
        {note ? (
          <T variant="label" align="center">
            {note}
          </T>
        ) : null}
      </View>
    </Sheet>
  );
}

/** The day streak as a card. */
export function ShareStreak({
  visible,
  onClose,
  streak,
  startedOn,
}: {
  visible: boolean;
  onClose: () => void;
  streak: number;
  startedOn: string | null;
}) {
  const started = startedOn
    ? new Date(`${startedOn}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  return (
    <ShareCard
      id="streak"
      visible={visible}
      onClose={onClose}
      art={<StreakFlame count={streak} size={170} id="share" />}
      title="DAY STREAK"
      lines={started ? [`Started on ${started}`] : []}
      locked={streak === 0 ? "Log a meal today to start your streak." : undefined}
    />
  );
}

function Action({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.actionPrimary,
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
    >
      <Icon name={icon} size={20} color={primary ? colors.white : colors.ink} />
      <T style={[styles.actionText, primary ? { color: colors.white } : undefined]}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.paper,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.sm, alignSelf: "flex-start" },
  wordmark: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.ink },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: 0.5, color: "#B4581B" },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  tag: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkFaint, marginTop: space.md },
  actions: { flexDirection: "row", gap: space.md },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.sunk,
  },
  actionPrimary: { backgroundColor: colors.ink },
  actionLocked: { flex: 0, alignSelf: "stretch", backgroundColor: colors.inkSoft },
  actionText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
