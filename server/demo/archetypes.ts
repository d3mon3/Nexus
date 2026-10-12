import type { Role } from "@/lib/types";

/** Item/rune templates per champion archetype, used to make demo builds plausible. */

export type Archetype = "critMelee" | "marksman" | "adAssassin" | "apAssassin" | "mage" | "bruiser" | "tank" | "enchanter" | "tankSupport";

const OVERRIDES: Record<string, Archetype> = {};
const set = (a: Archetype, keys: string) => keys.split(" ").forEach((k) => (OVERRIDES[k] = a));
set("critMelee", "Yasuo Yone Tryndamere MasterYi Gangplank Yunara");
set("adAssassin", "Zed Talon Qiyana Khazix Rengar Naafiri Kayn Pyke Shaco Nocturne Pantheon");
set("apAssassin", "Akali Katarina Ekko Fizz Evelynn Diana Leblanc Sylas Kassadin Elise Nidalee Aurora");
set("tank", "Malphite Ornn Sion Chogath Sejuani Zac Amumu Rammus KSante DrMundo Poppy TahmKench Shen Skarner Nunu");
set("tankSupport", "Nautilus Leona Braum Alistar Rell Thresh Blitzcrank Rakan Maokai Taric");
set("enchanter", "Lulu Janna Nami Soraka Sona Yuumi Karma Milio Seraphine Renata Bard Senna");
set("mage", "Lux Xerath Brand Zyra Velkoz Morgana Swain Hwei Zilean Annie Neeko Mel");
set("bruiser", "Aatrox Darius Riven Jax Irelia Camille Fiora Renekton Sett Garen Wukong MonkeyKing Viego LeeSin XinZhao Vi Hecarim Volibear Olaf Warwick Trundle Udyr Belveth Briar Ambessa Gwen Mordekaiser Illaoi Urgot Yorick Nasus Kled Jayce Gnar Kennen Rumble Teemo Kayle Quinn Graves Kindred");

export function archetypeOf(key: string, primaryRole: Role): Archetype {
  if (OVERRIDES[key]) return OVERRIDES[key];
  switch (primaryRole) {
    case "BOTTOM":
      return "marksman";
    case "UTILITY":
      return "enchanter";
    case "MIDDLE":
      return "mage";
    case "JUNGLE":
    case "TOP":
    default:
      return "bruiser";
  }
}

interface Template {
  starting: number[][];
  boots: number[];
  core: number[]; // 5 items, order = build order
  alt: number[]; // alternative 5-item path (higher win rate)
  situational: number[];
  runes: { primaryStyle: number; subStyle: number; perks: number[]; shards: number[] }[];
  skill: ("Q" | "W" | "E")[];
}

export const TEMPLATES: Record<Archetype, Template> = {
  critMelee: {
    starting: [[1055, 2003], [1054, 2003]],
    boots: [3006, 3047, 3111],
    core: [6673, 3031, 6675, 3072, 6333],
    alt: [3031, 6675, 6673, 6333, 3026],
    situational: [3026, 3033, 3036, 3814, 3091, 3153],
    runes: [
      { primaryStyle: 8000, subStyle: 8400, perks: [8008, 9111, 9104, 8299, 8444, 8473], shards: [5005, 5008, 5011] },
      { primaryStyle: 8000, subStyle: 8400, perks: [8010, 9111, 9104, 8299, 8444, 8451], shards: [5005, 5008, 5011] },
    ],
    skill: ["Q", "E", "W"],
  },
  marksman: {
    starting: [[1055, 2003]],
    boots: [3006, 3047, 3009],
    core: [6672, 3031, 6675, 3036, 3072],
    alt: [3153, 3091, 3031, 3036, 3026],
    situational: [3026, 3033, 6673, 3072, 6333, 3036],
    runes: [
      { primaryStyle: 8000, subStyle: 8100, perks: [8008, 9111, 9104, 8014, 8139, 8135], shards: [5005, 5008, 5011] },
      { primaryStyle: 8000, subStyle: 8300, perks: [8005, 9111, 9104, 8014, 8304, 8345], shards: [5005, 5008, 5011] },
    ],
    skill: ["Q", "W", "E"],
  },
  adAssassin: {
    starting: [[1036, 2003, 2003], [1055, 2003]],
    boots: [3158, 3047, 3111],
    core: [3142, 6697, 6694, 3814, 6698],
    alt: [6692, 3142, 6694, 3814, 3026],
    situational: [3026, 3814, 6333, 3156, 3036, 3071],
    runes: [
      { primaryStyle: 8100, subStyle: 8000, perks: [8112, 8143, 8140, 8105, 9111, 8014], shards: [5008, 5008, 5011] },
      { primaryStyle: 8000, subStyle: 8100, perks: [8010, 9111, 9104, 8299, 8143, 8105], shards: [5008, 5008, 5011] },
    ],
    skill: ["Q", "E", "W"],
  },
  apAssassin: {
    starting: [[1056, 2003], [1054, 2003]],
    boots: [3020, 3111, 3047],
    core: [3152, 4645, 3089, 3135, 3157],
    alt: [3100, 4645, 3089, 3157, 3135],
    situational: [3157, 3135, 3165, 3102, 3089, 4645],
    runes: [
      { primaryStyle: 8100, subStyle: 8200, perks: [8112, 8126, 8140, 8135, 8226, 8237], shards: [5008, 5008, 5011] },
      { primaryStyle: 8000, subStyle: 8400, perks: [8010, 9111, 9104, 8299, 8444, 8473], shards: [5008, 5008, 5011] },
    ],
    skill: ["Q", "W", "E"],
  },
  mage: {
    starting: [[1056, 2003, 2003], [1082, 2003]],
    boots: [3020, 3158, 3111],
    core: [6655, 4645, 3089, 3135, 3157],
    alt: [6655, 3165, 3089, 3157, 3135],
    situational: [3157, 3165, 3135, 3089, 3102, 3100],
    runes: [
      { primaryStyle: 8200, subStyle: 8300, perks: [8229, 8226, 8210, 8237, 8304, 8345], shards: [5008, 5008, 5011] },
      { primaryStyle: 8100, subStyle: 8200, perks: [8112, 8126, 8140, 8135, 8226, 8237], shards: [5008, 5008, 5011] },
    ],
    skill: ["Q", "E", "W"],
  },
  bruiser: {
    starting: [[1055, 2003], [1054, 2003]],
    boots: [3047, 3111, 3006],
    core: [3078, 6610, 3053, 6333, 3071],
    alt: [3071, 3053, 6333, 3074, 3026],
    situational: [3026, 3053, 3065, 3075, 6333, 3074],
    runes: [
      { primaryStyle: 8000, subStyle: 8400, perks: [8010, 9111, 9104, 8299, 8444, 8451], shards: [5008, 5008, 5011] },
      { primaryStyle: 8400, subStyle: 8000, perks: [8437, 8446, 8444, 8451, 9111, 9104], shards: [5008, 5008, 5011] },
    ],
    skill: ["Q", "E", "W"],
  },
  tank: {
    starting: [[1054, 2003]],
    boots: [3047, 3111],
    core: [3068, 3084, 3075, 6665, 4401],
    alt: [6665, 3084, 2502, 3075, 3143],
    situational: [3143, 3065, 4401, 2504, 3110, 3083],
    runes: [
      { primaryStyle: 8400, subStyle: 8300, perks: [8437, 8446, 8444, 8451, 8304, 8347], shards: [5007, 5001, 5011] },
      { primaryStyle: 8400, subStyle: 8000, perks: [8439, 8463, 8473, 8451, 9111, 9104], shards: [5007, 5001, 5011] },
    ],
    skill: ["Q", "W", "E"],
  },
  tankSupport: {
    starting: [[3865, 2003, 2003]],
    boots: [3047, 3111, 3009],
    core: [3190, 3109, 3050, 6665, 3075],
    alt: [3190, 3050, 3109, 3110, 3143],
    situational: [3222, 3107, 3143, 3110, 3075, 2504],
    runes: [
      { primaryStyle: 8400, subStyle: 8300, perks: [8439, 8463, 8473, 8453, 8304, 8347], shards: [5007, 5001, 5011] },
      { primaryStyle: 8400, subStyle: 8200, perks: [8465, 8463, 8473, 8453, 8226, 8210], shards: [5007, 5001, 5011] },
    ],
    skill: ["Q", "W", "E"],
  },
  enchanter: {
    starting: [[3865, 2003, 2003]],
    boots: [3158, 3020, 3009],
    core: [6617, 3504, 6616, 3107, 3222],
    alt: [6621, 6617, 3504, 3107, 4005],
    situational: [3222, 3107, 2065, 4005, 6621, 3504],
    runes: [
      { primaryStyle: 8200, subStyle: 8400, perks: [8214, 8226, 8210, 8237, 8463, 8453], shards: [5008, 5008, 5011] },
      { primaryStyle: 8400, subStyle: 8200, perks: [8465, 8463, 8473, 8453, 8226, 8210], shards: [5007, 5001, 5011] },
    ],
    skill: ["E", "W", "Q"],
  },
};

export const ROLE_SPELLS: Record<Role, [number, number][]> = {
  TOP: [
    [4, 12],
    [4, 14],
  ],
  JUNGLE: [
    [4, 11],
    [6, 11],
  ],
  MIDDLE: [
    [4, 14],
    [4, 12],
  ],
  BOTTOM: [
    [4, 7],
    [4, 21],
  ],
  UTILITY: [
    [4, 14],
    [4, 3],
  ],
};

/** Standard skill sequence for levels 1–18 given a max priority. */
export function skillSequence(priority: ("Q" | "W" | "E")[]): ("Q" | "W" | "E" | "R")[] {
  const [first, second, third] = priority;
  const seq: ("Q" | "W" | "E" | "R")[] = [first, second, third];
  const counts: Record<string, number> = { [first]: 1, [second]: 1, [third]: 1, R: 0 };
  for (let level = 4; level <= 18; level++) {
    if (level === 6 || level === 11 || level === 16) {
      seq.push("R");
      counts.R++;
      continue;
    }
    const next = counts[first] < 5 ? first : counts[second] < 5 ? second : third;
    seq.push(next);
    counts[next]++;
  }
  return seq;
}
