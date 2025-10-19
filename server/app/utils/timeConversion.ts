export enum TimeUnit {
  SECONDS = "s",
  MINUTES = "m",
  HOURS   = "h",
  DAYS    = "d",
  MONTHS  = "M"
}

export function toSeconds(value: number, unit: TimeUnit = TimeUnit.SECONDS): number {
  switch (unit) {
    case TimeUnit.SECONDS: return value;
    case TimeUnit.MINUTES: return value * 60;
    case TimeUnit.HOURS:   return value * 60 * 60;
    case TimeUnit.DAYS:    return value * 60 * 60 * 24;
    case TimeUnit.MONTHS:  return value * 60 * 60 * 24 * 28; // 30d approx
    default:               return value;
  }
}

export function formatNeo4jDate(neo4jDateTime: any): string | null {
  if (!neo4jDateTime) return null;
  
  const day = String(neo4jDateTime.day);
  const month = String(neo4jDateTime.month); // Months are 0-indexed
  const year = String(neo4jDateTime.year);

  return `${year}-${month}-${day}`; // I LOVE ISO STANDARS SO MUCH
}