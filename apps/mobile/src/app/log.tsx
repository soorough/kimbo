import type { MealDraft, MealSource, MealType, ParseMealRequest, RecentMeal } from "@kimbo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Icon, SheetPanel, T, type IconName } from "@/components/ui";
import { errorMessage, api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { MEAL_LABEL, isMealType, mealTypeForNow } from "@/lib/format";
import { toUploadableJpeg } from "@/lib/image";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Examples follow the meal of the moment, so the hint looks like what people are about to type. */
const EXAMPLES: Record<MealType, string[]> = {
  breakfast: ["poha and chai", "2 idli with sambar", "aloo paratha with curd"],
  lunch: ["2 roti, 1 katori dal, aloo gobi", "rajma chawal with salad"],
  snack: ["samosa and chai", "a bowl of fruit"],
  dinner: ["dal khichdi with raita", "2 roti with paneer sabzi"],
};
/** Kitchen words the recogniser should expect, so "katori" isn't heard as "category". */
const VOICE_HINTS = [
  "roti",
  "chapati",
  "paratha",
  "katori",
  "dal",
  "sabzi",
  "rajma",
  "chawal",
  "chole",
  "poha",
  "upma",
  "idli",
  "dosa",
  "sambar",
  "paneer",
  "bhindi",
  "aloo gobi",
  "raita",
  "chai",
  "thali",
  "khichdi",
  "biryani",
];
const HINTS = ["Reading your plate…", "Counting roti and katoris…", "Matching dishes…"];

/**
 * The log sheet: one tap to a photo, or a sentence the way you'd say it.
 * Nothing is saved here — the result always opens the review screen.
 */
export default function LogMeal() {
  const params = useLocalSearchParams<{ mealType?: string; voice?: string }>();
  const presetType = isMealType(params.mealType) ? params.mealType : undefined;
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const heard = useRef("");
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

  function describe(value = text, source: MealSource = "text") {
    const body = { text: value.trim() };
    if (body.text) analyse.mutate({ load: async () => body, source });
  }

  // Speech becomes text on the phone, then goes through the same parser as typing.
  useSpeechRecognitionEvent("result", (e) => {
    const said = e.results[0]?.transcript ?? "";
    setText(said);
    if (e.isFinal) heard.current = said;
  });
  useSpeechRecognitionEvent("end", () => {
    setListening(false);
    const said = heard.current;
    heard.current = "";
    if (said.trim()) describe(said, "voice");
  });
  useSpeechRecognitionEvent("error", (e) => {
    setListening(false);
    if (e.error === "aborted") return;
    setVoiceError(
      e.error === "no-speech" || e.error === "speech-timeout"
        ? "Didn't catch that. Try again, or type it."
        : e.error === "not-allowed"
          ? "Turn on the microphone for Kimbo in Settings to speak your meal."
          : "Voice isn't available right now. Type it instead.",
    );
  });

  async function toggleVoice() {
    if (listening) return ExpoSpeechRecognitionModule.stop();
    setVoiceError(null);
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setVoiceError("Turn on the microphone for Kimbo in Settings to speak your meal.");
      return;
    }
    heard.current = "";
    setText("");
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-IN",
      interimResults: true,
      contextualStrings: VOICE_HINTS,
    });
  }

  // Log food's "Voice Log" opens this sheet already listening.
  const autoVoice = useRef(params.voice === "1");
  useEffect(() => {
    if (!autoVoice.current) return;
    autoVoice.current = false;
    toggleVoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function quickAdd(draft: MealDraft) {
    startFromAi(draft, "repeat", presetType);
    router.replace("/review");
  }

  const mealNow = presetType ?? mealTypeForNow();
  const title = presetType
    ? `Log ${MEAL_LABEL[presetType].toLowerCase()}`
    : `What did you have for ${mealNow === "snack" ? "a snack" : MEAL_LABEL[mealNow].toLowerCase()}?`;

  return (
    <SheetPanel title={analyse.isPending ? undefined : title} subtitle={undefined} onClose={() => router.back()}>
      {analyse.isPending ? (
        <Analysing />
      ) : (
        <View style={{ gap: space.lg }}>
          <SavedMeals onPick={(draft) => quickAdd(draft)} />
          <RecentMeals onPick={(meal) => quickAdd(meal.draft)} />

          <View style={[styles.inputRow, listening && styles.inputListening]}>
            <TextInput
              value={text}
              onChangeText={setText}
              editable={!listening}
              placeholder={listening ? "Listening…" : "Type or say what you ate"}
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => describe()}
              accessibilityLabel="Describe your meal"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={listening ? "Stop listening" : "Say what you ate"}
              onPress={toggleVoice}
              style={[styles.mic, listening && styles.micOn]}
            >
              <Icon name={listening ? "square" : "mic"} size={18} color={listening ? colors.white : colors.leaf} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Analyse"
              disabled={!text.trim() || listening}
              onPress={() => describe()}
              style={[styles.send, (!text.trim() || listening) && { opacity: 0.4 }]}
            >
              <Icon name="arrow-up" size={20} color={colors.white} />
            </Pressable>
          </View>
          <View style={styles.examples}>
            {EXAMPLES[mealNow].map((e) => (
              <Pressable key={e} onPress={() => setText(e)} style={styles.example}>
                <T variant="caption" tone="soft">
                  {e}
                </T>
              </Pressable>
            ))}
          </View>
          {voiceError ? (
            <T variant="caption" tone="plum">
              {voiceError}
            </T>
          ) : null}

          <View style={styles.tiles}>
            <Tile icon="camera" title="Camera" onPress={() => photo(true)} />
            <Tile icon="image" title="Gallery" onPress={() => photo(false)} />
            <Tile
              icon="list"
              title="Food list"
              onPress={() => {
                startManual(presetType ?? mealTypeForNow());
                router.replace("/review");
              }}
            />
          </View>

          {analyse.error ? (
            <View style={styles.error}>
              <Icon name="cloud-off" size={18} color={colors.plum} />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="bodyStrong">{errorMessage(analyse.error)}</T>
                <T variant="caption">Type it or pick from the food list instead.</T>
              </View>
              <T variant="label" tone="leaf" onPress={() => analyse.variables && analyse.mutate(analyse.variables)}>
                Retry
              </T>
            </View>
          ) : null}
        </View>
      )}
    </SheetPanel>
  );
}

/** Meals the user named and kept; "Edit" opens the list to rename or delete them. */
function SavedMeals({ onPick }: { onPick: (draft: MealDraft) => void }) {
  const saved = useQuery({ queryKey: ["savedMeals"], queryFn: api.savedMeals });
  const meals = saved.data?.meals ?? [];
  if (!meals.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.sectionHead}>
        <T variant="overline" tone="soft">
          MY MEALS
        </T>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit my meals"
          hitSlop={10}
          onPress={() => router.push("/my-meals")}
        >
          <T variant="label" tone="leaf">
            Edit
          </T>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentRow}
        style={styles.recentScroll}
      >
        {meals.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityLabel={`${m.name}, ${m.calories} kilocalories. Add`}
            onPress={() => onPick(m.draft)}
            style={({ pressed }) => [styles.recent, styles.saved, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.recentBody}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="bookmark" size={13} color={colors.leaf} />
                <T variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {m.name}
                </T>
              </View>
              <T variant="caption">{m.calories} kcal</T>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** Past meals as one-tap chips: tap opens review to tweak and save, × drops it from the list. */
function RecentMeals({ onPick }: { onPick: (meal: RecentMeal) => void }) {
  const queryClient = useQueryClient();
  const recent = useQuery({ queryKey: ["recentMeals"], queryFn: api.recentMeals });
  const hide = useMutation({
    mutationFn: (key: string) => api.hideRecentMeal(key),
    onMutate: (key) =>
      queryClient.setQueryData<{ meals: RecentMeal[] }>(["recentMeals"], (d) =>
        d ? { meals: d.meals.filter((m) => m.key !== key) } : d,
      ),
    onError: () => queryClient.invalidateQueries({ queryKey: ["recentMeals"] }),
  });
  const meals = recent.data?.meals ?? [];
  if (!meals.length) return null;

  return (
    <View style={{ gap: space.sm }}>
      <T variant="overline" tone="soft">
        RECENT
      </T>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentRow}
        style={styles.recentScroll}
      >
        {meals.map((m) => (
          <View key={m.key} style={styles.recent}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${m.label}, ${m.calories} kilocalories. Add again`}
              onPress={() => onPick(m)}
              style={({ pressed }) => [styles.recentBody, pressed && { opacity: 0.7 }]}
            >
              <T variant="bodyStrong" numberOfLines={1}>
                {m.label}
              </T>
              <T variant="caption">
                {m.calories} kcal{m.timesLogged > 1 ? ` · ${m.timesLogged}×` : ""}
              </T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${m.label} from recent`}
              hitSlop={10}
              onPress={() => hide.mutate(m.key)}
              style={styles.recentRemove}
            >
              <Icon name="x" size={14} color={colors.inkSoft} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** A compact source button: icon over a short label, three to a row. */
function Tile({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.tileIcon}>
        <Icon name={icon} size={18} color={colors.white} />
      </View>
      <T variant="label" style={{ color: colors.ink }}>
        {title}
      </T>
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
      <T variant="label">Nothing is saved until you check it.</T>
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: space.md },
  // Bleed to the sheet edges so chips scroll off-screen instead of being clipped by padding.
  recentScroll: { marginHorizontal: -space.xl },
  recentRow: { gap: space.sm, paddingHorizontal: space.xl },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 240,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  recentBody: { flexShrink: 1, paddingLeft: space.md, paddingRight: space.xs, paddingVertical: space.sm, gap: 2 },
  saved: { borderColor: colors.leaf, backgroundColor: colors.leafSoft, paddingRight: space.md },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recentRemove: { paddingHorizontal: space.sm, alignSelf: "stretch", justifyContent: "center" },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.leafSoft,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.leaf,
    alignItems: "center",
    justifyContent: "center",
  },
  inputListening: { borderColor: colors.leaf, borderWidth: 2 },
  mic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.leafSoft,
  },
  micOn: { backgroundColor: colors.leaf },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
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
  analysing: { alignItems: "center", gap: space.md, paddingVertical: space.xxxl },
});
