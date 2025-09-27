import { TimeUnit, toSeconds } from "../utils/timeConversion";
import { CacheTypes, Difficulties } from "./shared_enums";

export const MAX_NUMBER: Readonly<Record<Difficulties, number>> = {
  [Difficulties.LAYMAN]: 64,
  [Difficulties.CHILL_GUY]: 256,
  [Difficulties.ELFAK_ENJOYER]: 512,
  [Difficulties.BASED_MASTER]: 2048
} as const;


export const CACHE_DURATION  = {
    [CacheTypes.GENERIC_CACHE]: toSeconds(15, TimeUnit.MINUTES),

} as const;















