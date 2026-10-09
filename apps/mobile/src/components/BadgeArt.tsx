import { View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { colors, fonts } from "@/lib/theme";
import { Icon, type IconName } from "./Icon";

/** Warm colours for earned art; soft greys for locked, so the shape still reads. */
const LIT = { top: "#FFC872", bottom: "#E5862B", deep: "#B4581B", glow: "#FFE2A8" };
const DIM = { top: "#ECE4D6", bottom: "#D9CFBE", deep: "#B8AC98", glow: "#F3EEE5" };

const FLAME =
  "M50 6 C58 22 76 30 76 54 C76 74 64 88 50 88 C36 88 24 74 24 56 C24 44 30 36 36 30 C36 42 42 48 48 48 C44 36 44 22 50 6 Z";
const FLAME_CORE = "M50 46 C55 54 62 58 62 68 C62 77 57 82 50 82 C43 82 38 77 38 69 C38 61 45 56 50 46 Z";

/** Sparkle: a four-point star. */
function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <Path
      d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`}
      fill={fill}
    />
  );
}

/** A drawn flame with the streak count on a pill, and sparkles when it's lit. */
export function StreakFlame({ count, size = 120, id = "f" }: { count: number; size?: number; id?: string }) {
  const c = count > 0 ? LIT : DIM;
  const label = String(count);

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${count} day streak`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.top} />
            <Stop offset="1" stopColor={c.bottom} />
          </LinearGradient>
        </Defs>
        {count > 0 ? (
          <G>
            <Sparkle x={16} y={30} r={6} fill={LIT.glow} />
            <Sparkle x={84} y={20} r={8} fill={LIT.top} />
            <Sparkle x={20} y={62} r={3.5} fill={LIT.top} />
          </G>
        ) : null}
        <Path d={FLAME} fill={`url(#${id}-body)`} />
        <Path d={FLAME_CORE} fill={c.glow} opacity={0.9} />

        {/* Paint the outline first so it cannot eat into the solid white numeral. */}
        <SvgText x={50} y={94} fontSize={34} fontFamily="sans-serif" fontWeight="900"
          fill="#FFFFFF" stroke={c.deep} strokeWidth={5} strokeLinejoin="round" textAnchor="middle">
          {label}
        </SvgText>
        <SvgText x={50} y={94} fontSize={34} fontFamily="sans-serif" fontWeight="900"
          fill="#FFFFFF" textAnchor="middle">
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

/** Faceted badge emblem shared by Progress and Milestones. */
export function BadgeEmblem({ count, size = 110 }: { count: number; size?: number }) {
  const edge = "M50 7 L78 17 L91 43 L87 70 L66 88 L35 88 L13 70 L9 43 L22 17 Z";
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${count} badges earned`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Path d={edge} fill="#343044" stroke="#B7944D" strokeWidth={2} />
        <Path d="M50 7 L50 48 L22 17 Z" fill="#494158" />
        <Path d="M22 17 L50 48 L9 43 L13 70 Z" fill="#383247" />
        <Path d="M50 7 L78 17 L50 48 Z" fill="#282435" />
        <Path d="M78 17 L91 43 L50 48 Z" fill="#4C425E" />
        <Path d="M91 43 L87 70 L50 48 Z" fill="#5A4D6C" />
        <Path d="M87 70 L66 88 L50 48 Z" fill="#3E354F" />
        <Path d="M66 88 L35 88 L50 48 Z" fill="#292335" />
        <Path d="M35 88 L13 70 L50 48 Z" fill="#51445F" />
        <SvgText x={50} y={96} fontSize={34} fontFamily="sans-serif" fontWeight="900"
          fill="#FFFFFF" stroke="#343044" strokeWidth={5} strokeLinejoin="round" textAnchor="middle">{count}</SvgText>
        <SvgText x={50} y={96} fontSize={34} fontFamily="sans-serif" fontWeight="900"
          fill="#FFFFFF" textAnchor="middle">{count}</SvgText>
      </Svg>
    </View>
  );
}

/** A shield badge with a picture and a ribbon number. Locked badges are the same drawing in grey. */
export function BadgeArt({
  kind,
  earned,
  number,
  icon,
  size = 84,
  id,
}: {
  kind: "streak" | "meals" | "habit";
  earned: boolean;
  number?: number;
  icon?: IconName;
  size?: number;
  id: string;
}) {
  const c = earned ? LIT : DIM;
  const shield = "M50 4 L88 18 L88 56 C88 76 70 90 50 96 C30 90 12 76 12 56 L12 18 Z";
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.top} />
            <Stop offset="1" stopColor={c.bottom} />
          </LinearGradient>
        </Defs>
        {kind === "habit" ? (
          <G>
            <Circle cx={50} cy={50} r={44} fill={`url(#${id}-bg)`} />
            <Circle cx={50} cy={50} r={34} fill={c.glow} />
          </G>
        ) : (
          <G>
            <Path d={shield} fill={`url(#${id}-bg)`} />
            <Path d={shield} fill="none" stroke={c.deep} strokeWidth={2.5} opacity={0.5} />
            {kind === "streak" ? (
              <G transform="translate(28 14) scale(0.44)">
                <Path d={FLAME} fill={c.glow} />
                <Path d={FLAME_CORE} fill={earned ? LIT.bottom : DIM.deep} opacity={0.6} />
              </G>
            ) : (
              // A katori of dal: bowl, rim and a little steam.
              <G>
                <Path
                  d="M30 34 Q33 28 30 22 M42 32 Q45 26 42 20"
                  stroke={c.glow}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                />
                <Path d="M24 40 L76 40 C74 56 64 64 50 64 C36 64 26 56 24 40 Z" fill={c.glow} />
                <Rect x={22} y={37} width={56} height={6} rx={3} fill={c.deep} opacity={0.55} />
              </G>
            )}
            {number !== undefined ? (
              <G>
                <Rect x={24} y={66} width={52} height={20} rx={10} fill={c.deep} />
                <SvgText
                  x={50}
                  y={81}
                  fontSize={14}
                  fontFamily={fonts.bold}
                  fontWeight="bold"
                  fill="#FFFFFF"
                  textAnchor="middle"
                >
                  {number}
                </SvgText>
              </G>
            ) : null}
          </G>
        )}
      </Svg>
      {kind === "habit" && icon ? <Icon name={icon} size={size * 0.34} color={earned ? LIT.deep : DIM.deep} /> : null}
    </View>
  );
}

export const ART_COLORS = { lit: LIT, dim: DIM, ink: colors.ink };
