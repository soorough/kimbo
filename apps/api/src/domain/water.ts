const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5 };
const num = (w: string) => (WORD_NUM[w.toLowerCase()] ?? Number(w)) || 0;

/** Glass, bottle and large bottle, as on the log water sheet. */
export const WATER_SIZES = { glass: 250, bottle: 500, largeBottle: 750 } as const;

/**
 * How much water a sentence says, in ml: "500 ml", "1.5 litres", "2 glasses", "a bottle".
 * Null when it isn't about water or gives no amount.
 */
export function readWater(text: string): { mentioned: boolean; ml: number | null } {
  if (!/\b(water|paani|pani)\b/i.test(text)) return { mentioned: false, ml: null };
  const ml = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml) return { mentioned: true, ml: Math.round(Number(ml[1])) };
  const litres = text.match(/(\d+(?:\.\d+)?|a|one|half)\s*(?:l|litres?|liters?)\b/i);
  if (litres) return { mentioned: true, ml: Math.round(num(litres[1]!) * 1000) };
  const n = "(\\d+|a|an|one|two|three|four|five|six)";
  const large = text.match(new RegExp(`${n}\\s*(?:large|big)\\s*bottles?`, "i"));
  if (large) return { mentioned: true, ml: num(large[1]!) * WATER_SIZES.largeBottle };
  const bottle = text.match(new RegExp(`${n}\\s*bottles?`, "i"));
  if (bottle) return { mentioned: true, ml: num(bottle[1]!) * WATER_SIZES.bottle };
  const glass = text.match(new RegExp(`${n}\\s*(?:glass(?:es)?|cups?)`, "i"));
  if (glass) return { mentioned: true, ml: num(glass[1]!) * WATER_SIZES.glass };
  return { mentioned: true, ml: null };
}
