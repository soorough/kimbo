import { StyleSheet, TextInput } from "react-native";
import { colors, fonts, radius, space } from "@/lib/theme";

/** The one free-text answer in setup: a first name, typed large so it reads like a greeting. */
export function NameField({
  value,
  onChange,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      autoFocus={autoFocus}
      placeholder="Your first name"
      placeholderTextColor={colors.inkFaint}
      autoCapitalize="words"
      autoComplete="given-name"
      autoCorrect={false}
      returnKeyType="done"
      maxLength={30}
      accessibilityLabel="Your first name"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.ink,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
});
