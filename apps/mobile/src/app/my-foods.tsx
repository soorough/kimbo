import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { FoodCard, LibraryEmpty, LogFoodTabs, useLogFoodParams } from "@/components/LogFood";
import { Button, Icon, Screen } from "@/components/ui";
import { useDraft } from "@/lib/draft";
import { mealTypeForNow } from "@/lib/format";
import { myFoodLabel, useMyFoods, type MyFood } from "@/lib/my-foods";
import { colors, fonts, radius, space } from "@/lib/theme";

/** Log Food → My foods: foods the user typed in from a label, kept on this phone. */
export default function MyFoods() {
  const { pick, replaceKey } = useLogFoodParams();
  const { foods, loaded, load } = useMyFoods();
  const [search, setSearch] = useState("");
  useEffect(() => {
    load();
  }, [load]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? foods.filter((f) => myFoodLabel(f).toLowerCase().includes(q)) : foods;
  }, [foods, search]);

  function add(food: MyFood) {
    const draft = useDraft.getState();
    if (!pick) draft.startQuick(mealTypeForNow());
    draft.addCustom(myFoodLabel(food), food.servingSize, food.perServing, pick ? replaceKey : undefined);
    if (pick) router.back();
    else router.push("/review");
  }

  return (
    <Screen
      back
      title="Log food"
      scroll={false}
      padded={false}
      bottomClearance={false}
      footer={foods.length ? <Button kind="ink" label="Add food" onPress={() => router.push("/add-food")} /> : undefined}
    >
      <LogFoodTabs active="/my-foods" />
      {!loaded ? null : foods.length === 0 ? (
        <LibraryEmpty
          emoji="🥫"
          title="My Foods"
          message="Add a custom food to your personal list."
          action="Add food"
          onAction={() => router.push("/add-food")}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.inkFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor={colors.inkFaint}
              style={styles.input}
              accessibilityLabel="Search my foods"
            />
          </View>
          {shown.map((food) => (
            <FoodCard
              key={food.id}
              title={myFoodLabel(food)}
              calories={Math.round(food.perServing.calories)}
              portion={food.servingSize}
              onAdd={() => add(food)}
            />
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xl, gap: space.md },
  search: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink, paddingVertical: space.md },
});
