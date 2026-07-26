import type {
  HistoricalDateEra,
  HistoricalDatePrecision,
} from "../contextual-types.js";

export interface ChronologyBounds {
  startYear: number;
  endYear: number;
}

const unconvertedCalendars = new Set([
  "hebrew",
  "islamic",
  "julian",
  "regnal",
  "roman",
  "unspecified-unconverted",
]);

interface ChronologyDateInput {
  precision: HistoricalDatePrecision;
  era?: HistoricalDateEra | undefined;
  year?: number | undefined;
  calendarSystem?: string | undefined;
  conversionStatus?: "not_required" | "unconverted" | undefined;
}

function signedYear(
  year: number,
  era: HistoricalDateEra | undefined,
): number {
  return era === "BCE" ? 1 - year : year;
}

export function chronologyBoundsForStructuredDate(
  value: ChronologyDateInput | undefined,
): ChronologyBounds | null {
  if (
    !value
    || value.conversionStatus === "unconverted"
    || value.precision === "named_period"
    || value.precision === "unknown"
    || value.year === undefined
    || value.era === undefined
  ) {
    return null;
  }

  const calendar = value.calendarSystem?.trim().toLocaleLowerCase();
  if (calendar && unconvertedCalendars.has(calendar)) {
    return null;
  }

  if (value.precision === "century") {
    if (value.era === "BCE") {
      return {
        startYear: 1 - (value.year * 100),
        endYear: 1 - ((value.year - 1) * 100) - 1,
      };
    }
    return {
      startYear: ((value.year - 1) * 100) + 1,
      endYear: value.year * 100,
    };
  }

  const statedYear = signedYear(value.year, value.era);
  if (value.precision !== "decade") {
    return {
      startYear: statedYear,
      endYear: statedYear,
    };
  }

  if (value.era === "BCE") {
    const otherEnd = signedYear(value.year + 9, value.era);
    return {
      startYear: Math.min(statedYear, otherEnd),
      endYear: Math.max(statedYear, otherEnd),
    };
  }

  return {
    startYear: statedYear,
    endYear: statedYear + 9,
  };
}
