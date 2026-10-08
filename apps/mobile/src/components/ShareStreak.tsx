import * as Haptics from "expo-haptics";
import { Asset, requestPermissionsAsync } from "expo-media-library";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { colors, fonts, radius, space } from "@/lib/theme";
import { StreakFlame } from "./BadgeArt";
import { Icon, type IconName } from "./Icon";
import { Kimbo } from "./Kimbo";
import { Sheet } from "./Sheet";
import { T } from "./Text";

/**
 * The streak as a card worth sharing: warm gradient, the drawn flame with the count, when it
 * started, and the kimbo wordmark. Share opens the phone's share menu with the card as an
 * image; Save puts it in the gallery.
 */
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
  const card = useRef<View>(null);
  const [note, setNote] = useState<string | null>(null);

  const snap = () => captureRef(card, { format: "png", quality: 1, result: "tmpfile" });

  const share = async () => {
    setNote(null);
    try {
      const uri = await snap();
      if (!(await Sharing.isAvailableAsync())) return setNote("Sharing isn't available on this phone.");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your streak" });
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

  const started = startedOn
    ? new Date(`${startedOn}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: space.lg }}>
        {/* collapsable={false} keeps this a real native view so it can be captured as an image. */}
        <View ref={card} collapsable={false} style={styles.card}>
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="share-bg" x1="1" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F2A541" />
                <Stop offset="0.45" stopColor="#FBD993" />
                <Stop offset="1" stopColor={colors.paper} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#share-bg)" />
          </Svg>
          <View style={styles.cardTop}>
            <Kimbo mood="cheer" size={34} />
            <T style={styles.wordmark}>kimbo</T>
          </View>
          <StreakFlame count={streak} size={170} id="share" />
          <T style={styles.title}>DAY STREAK</T>
          {started ? <T style={styles.sub}>Started on {started}</T> : null}
          <T style={styles.tag}>Eating like home, one day at a time.</T>
        </View>

        <View style={styles.actions}>
          <Action icon="share-2" label="Share" onPress={share} primary />
          <Action icon="download" label="Save" onPress={save} />
        </View>
        {note ? (
          <T variant="label" align="center">
            {note}
          </T>
        ) : null}
      </View>
    </Sheet>
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
      <T style={[styles.actionText, primary && { color: colors.white }]}>{label}</T>
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
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: 1, color: "#B4581B" },
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
  actionText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
