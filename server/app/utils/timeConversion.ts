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
    case TimeUnit.MONTHS:  return value * 60 * 60 * 24 * 30; // 30d approx
    default:               return value;
  }
}