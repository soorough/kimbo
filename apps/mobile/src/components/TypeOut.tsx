import { useEffect, useRef, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { useReduceMotion } from "@/lib/motion";
import { T } from "./Text";

/**
 * Reveals text word by word, like Kimbo is saying it. Instant when motion is reduced
 * or when `instant` is set (e.g. a line the user has already seen).
 */
export function TypeOut({
  text,
  variant,
  align,
  instant,
  numberOfLines,
  style,
  onDone,
}: {
  text: string;
  variant: "body" | "bodyStrong" | "title";
  align?: "center";
  instant?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  onDone: () => void;
}) {
  const still = useReduceMotion() || !!instant;
  const words = text.split(" ");
  const [n, setN] = useState(still ? words.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (still) {
      setN(words.length);
      done.current();
      return;
    }
    setN(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= words.length) {
        clearInterval(t);
        done.current();
      }
    }, 45);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, still]);
  return (
    <T
      variant={variant}
      align={align}
      numberOfLines={numberOfLines}
      style={[variant === "title" && { fontSize: 24, lineHeight: 31 }, style]}
    >
      {words.slice(0, n).join(" ")}
      {/* The rest is laid out invisibly so the text doesn't grow line by line. */}
      <T variant={variant} style={{ opacity: 0 }}>
        {n < words.length ? ` ${words.slice(n).join(" ")}` : ""}
      </T>
    </T>
  );
}
