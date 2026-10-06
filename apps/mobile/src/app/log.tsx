import type { MealSource, ParseMealRequest } from "@kimbo/shared";
import { useMutation } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Kimbo } from "@/components/Kimbo";
import { Button, Card, Screen } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { colors, font, radius, space } from "@/lib/theme";

const EXAMPLES = ["2 roti, one katori dal and aloo gobi", "poha and chai", "rice, rajma and salad"];

export default function LogMeal() {
  const [text, setText] = useState("");
  const startFromAi = useDraft((s) => s.startFromAi);
  const startManual = useDraft((s) => s.startManual);

  const analyse = useMutation({
    mutationFn: ({ body }: { body: ParseMealRequest; source: MealSource }) => api.parseMeal(body),
    onSuccess: (draft, { source }) => {
      startFromAi(draft, source);
      router.replace("/review");
    },
  });

  async function photo(fromCamera: boolean) {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.5, base64: true };
    const result = fromCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    analyse.mutate({ body: { imageBase64: asset.base64, mimeType: asset.mimeType ?? "image/jpeg" }, source: "photo" });
  }

  if (analyse.isPending) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Kimbo mood="thinking" size={120} />
          <Text style={font.h2}>Kimbo is looking at your meal…</Text>
          <Text style={font.small}>You'll get to check everything before it's saved.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Text style={font.h2}>Describe it</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="e.g. 2 roti, one katori dal and aloo gobi"
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
        />
        <View style={styles.examples}>
          {EXAMPLES.map((e) => (
            <Text key={e} style={styles.example} onPress={() => setText(e)}>
              {e}
            </Text>
          ))}
        </View>
        <Button
          label="Analyse"
          disabled={!text.trim()}
          onPress={() => analyse.mutate({ body: { text: text.trim() }, source: "text" })}
        />
      </Card>

      <Card>
        <Text style={font.h2}>Or snap your plate</Text>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Button label="Camera" icon="📷" kind="secondary" onPress={() => photo(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Gallery" icon="🖼" kind="secondary" onPress={() => photo(false)} />
          </View>
        </View>
      </Card>

      {analyse.error ? (
        <Card style={{ borderColor: colors.calm }}>
          <Text style={font.body}>{errorMessage(analyse.error)}</Text>
          <Button label="Try again" kind="secondary" onPress={() => analyse.variables && analyse.mutate(analyse.variables)} />
        </Card>
      ) : null}

      <Button
        label="Pick from the food list instead"
        kind="ghost"
        onPress={() => {
          startManual(useDraft.getState().mealType);
          router.replace("/review");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
  input: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: "top",
  },
  examples: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  example: {
    fontSize: 13,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
});
