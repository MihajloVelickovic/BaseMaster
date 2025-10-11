export enum TimeUnit {
  SECONDS = "s",
  MINUTES = "m",
  HOURS   = "h",
  DAYS    = "d",
  MONTHS  = "M"
}

export function toSeconds(value: number, unit: TimeUnit): number {
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

  const jsDate = new Date(neo4jDateTime.epochMillis);
  const day = String(jsDate.getDate()).padStart(2, '0');
  const month = String(jsDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const year = jsDate.getFullYear();

  return `${day}/${month}/${year}`;
}