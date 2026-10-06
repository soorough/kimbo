import type { JourneyResponse } from "@kimbo/shared";
import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { colors, space } from "@/lib/theme";
import { formatWeight, useUnits } from "@/lib/units";
import { Surface } from "./Surface";
import { T } from "./Text";

const H = 120;
const PAD = 10;

/** Weigh-ins over time, with the goal weight as a dashed line. Needs at least two points. */
export function WeightTrend({ journey }: { journey: JourneyResponse }) {
  const unit = useUnits((u) => u.weight);
  const [w, setW] = useState(0);
  const points = journey.history;
  if (points.length < 2) return null;

  const values = points.map((p) => p.kg).concat(journey.targetKg ?? []);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const x = (i: number) => PAD + (i / (points.length - 1)) * (w - PAD * 2);
  const y = (kg: number) => PAD + ((max - kg) / (max - min)) * (H - PAD * 2);
  const change = Math.round((points.at(-1)!.kg - points[0]!.kg) * 10) / 10;

  return (
    <Surface>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <T variant="heading">Weight</T>
        <T variant="label">
          {change === 0 ? "No change" : `${change > 0 ? "+" : "−"}${formatWeight(Math.abs(change), unit)}`} since{" "}
          {new Date(`${points[0]!.date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </T>
      </View>
      <View
        style={{ height: H, marginTop: space.sm }}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      >
        {w > 0 ? (
          <Svg width={w} height={H}>
            {journey.targetKg !== null ? (
              <Line
                x1={PAD}
                x2={w - PAD}
                y1={y(journey.targetKg)}
                y2={y(journey.targetKg)}
                stroke={colors.leaf}
                strokeDasharray="4 6"
                strokeWidth={1.5}
                opacity={0.6}
              />
            ) : null}
            <Polyline
              points={points.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ")}
              fill="none"
              stroke={colors.leaf}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Circle cx={x(points.length - 1)} cy={y(points.at(-1)!.kg)} r={5} fill={colors.leaf} />
          </Svg>
        ) : null}
      </View>
      {journey.targetKg !== null ? (
        <T variant="caption">Dashed line: goal {formatWeight(journey.targetKg, unit)}</T>
      ) : null}
    </Surface>
  );
}
