const MIST_PER_SUI = 1_000_000_000n;

export function shortAddress(value: string) {
  if (value.length <= 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function mistToSuiString(value: bigint | number | string) {
  const mist = BigInt(value);
  const whole = mist / MIST_PER_SUI;
  const fraction = mist % MIST_PER_SUI;
  const fractionText = fraction.toString().padStart(9, "0").replace(/0+$/, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

export function formatMistLabel(value: bigint | number | string) {
  return `${mistToSuiString(value)} SUI`;
}

/** Convert a SUI decimal string (e.g. "0.15") to MIST string. */
export function suiToMistString(sui: string): string {
  const trimmed = sui.trim();
  if (!trimmed) return "0";
  const [whole = "0", frac = ""] = trimmed.split(".");
  const paddedFrac = frac.padEnd(9, "0").slice(0, 9);
  const mist = BigInt(whole) * MIST_PER_SUI + BigInt(paddedFrac);
  return mist.toString();
}

export function formatDateTime(value: string | Date | number | bigint) {
  const date =
    value instanceof Date
      ? value
      : typeof value === "bigint"
        ? new Date(Number(value))
        : typeof value === "number"
          ? new Date(value)
          : new Date(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}
