import type { MealSource, ParseMealRequest } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Icon, SheetPanel, T, type IconName } from "@/components/ui";
import { errorMessage, api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL, isMealType, mealTypeForNow } from "@/lib/format";
import { toUploadableJpeg } from "@/lib/image";
import { colors, fonts, radius, space } from "@/lib/theme";

const EXAMPLES = ["2 roti, 1 katori dal, aloo gobi", "poha and chai", "rajma chawal with salad"];
const HINTS = ["Spotting the rotis…", "Sizing up katoris…", "Matching Indian dishes…", "Almost there…"];

/**
 * The log sheet: one tap to a photo, or a sentence the way you'd say it.
 * Nothing is saved here — the result always opens the review screen.
 */
export default function LogMeal() {
  const params = useLocalSearchParams<{ mealType?: string }>();
  const presetType = isMealType(params.mealType) ? params.mealType : undefined;
  const [text, setText] = useState("");
  const startFromAi = useDraft((s) => s.startFromAi);
  const startManual = useDraft((s) => s.startManual);

  const analyse = useMutation({
    mutationFn: async ({ load }: { load: () => Promise<ParseMealRequest>; source: MealSource }) =>
      api.parseMeal(await load()),
    onSuccess: (draft, { source }) => {
      startFromAi(draft, source, presetType);
      router.replace("/review");
    },
  });

  async function photo(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"] };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    analyse.mutate({
      source: "photo",
      load: async () => {
        const image = await toUploadableJpeg(asset.uri);
        return { imageBase64: image.base64, mimeType: image.mimeType };
      },
    });
  }

  function describe(value = text) {
    const body = { text: value.trim() };
    if (body.text) analyse.mutate({ load: async () => body, source: "text" });
  }

  const title = presetType ? `Log ${MEAL_LABEL[presetType].toLowerCase()}` : "What did you eat?";

  return (
    <SheetPanel
      title={analyse.isPending ? undefined : title}
      subtitle={analyse.isPending ? undefined : "You'll check everything before it's saved."}
      onClose={() => router.back()}
    >
      {analyse.isPending ? (
        <Analysing />
      ) : (
        <View style={{ gap: space.lg }}>
          <View style={styles.tiles}>
            <Tile icon="camera" title="Snap your plate" subtitle="Best for thalis" onPress={() => photo(true)} />
            <Tile icon="image" title="From photos" subtitle="A meal you already shot" onPress={() => photo(false)} />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Or type it — e.g. 2 roti and dal"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => describe()}
              accessibilityLabel="Describe your meal"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Analyse"
              disabled={!text.trim()}
              onPress={() => describe()}
              style={[styles.send, !text.trim() && { opacity: 0.4 }]}
            >
              <Icon name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.examples}>
            {EXAMPLES.map((e) => (
              <Pressable key={e} onPress={() => setText(e)} style={styles.example}>
                <T variant="caption" tone="soft">
                  {e}
                </T>
              </Pressable>
            ))}
          </View>

          {analyse.error ? (
            <View style={styles.error}>
              <Icon name="cloud-off" size={18} color={colors.plum} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyStrong">{errorMessage(analyse.error)}</T>
                <T variant="caption">Try again, type it instead, or pick from the food list.</T>
              </View>
              <T variant="label" tone="leaf" onPress={() => analyse.variables && analyse.mutate(analyse.variables)}>
                Retry
              </T>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              startManual(presetType ?? mealTypeForNow());
              router.replace("/review");
            }}
            style={styles.manual}
          >
            <Icon name="list" size={18} color={colors.leaf} />
            <T variant="bodyStrong" tone="leaf">
              Pick from the food list
            </T>
          </Pressable>
        </View>
      )}
    </SheetPanel>
  );
}

function Tile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.tileIcon}>
        <Icon name={icon} size={22} color={colors.white} />
      </View>
      <T variant="heading">{title}</T>
      <T variant="caption">{subtitle}</T>
    </Pressable>
  );
}

function Analysing() {
  const [hint, setHint] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setHint((h) => Math.min(h + 1, HINTS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.analysing} accessibilityLiveRegion="polite">
      <Kimbo mood="thinking" size={110} />
      <T variant="title">{HINTS[hint]}</T>
      <T variant="label">You'll get to check everything before it's saved.</T>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: space.md },
  tile: {
    flex: 1,
    gap: 4,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.leafSoft,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: space.lg,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: space.sm },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: -space.sm },
  example: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.sunk },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.plumSoft,
  },
  manual: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.md,
  },
  analysing: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl },
});
