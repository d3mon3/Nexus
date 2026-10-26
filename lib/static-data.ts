/**
 * Embedded fallback game data. At runtime the server refreshes these tables from
 * Data Dragon (champion.json, runesReforged.json, item.json) — see server/ddragon.ts.
 * The embedded copies keep demo mode and offline desktop launches fully functional.
 */
import type { ChampionInfo, Role } from "./types";

export const FALLBACK_DDRAGON_VERSION = "15.20.1";
export const DDRAGON = "https://ddragon.leagueoflegends.com";

const R: Record<string, Role> = { T: "TOP", J: "JUNGLE", M: "MIDDLE", B: "BOTTOM", S: "UTILITY" };

// id|DataDragonKey|roles   (display names are derived, with overrides below)
const CHAMPION_TABLE = `
1|Annie|MS 2|Olaf|JT 3|Galio|MS 4|TwistedFate|M 5|XinZhao|J 6|Urgot|T 7|Leblanc|M 8|Vladimir|MT 9|Fiddlesticks|J
10|Kayle|T 11|MasterYi|J 12|Alistar|S 13|Ryze|M 14|Sion|T 15|Sivir|B 16|Soraka|S 17|Teemo|T 18|Tristana|BM
19|Warwick|JT 20|Nunu|J 21|MissFortune|B 22|Ashe|B 23|Tryndamere|T 24|Jax|TJ 25|Morgana|S 26|Zilean|S
27|Singed|T 28|Evelynn|J 29|Twitch|B 30|Karthus|J 31|Chogath|T 32|Amumu|J 33|Rammus|J 34|Anivia|M 35|Shaco|J
36|DrMundo|T 37|Sona|S 38|Kassadin|M 39|Irelia|TM 40|Janna|S 41|Gangplank|T 42|Corki|M 43|Karma|S 44|Taric|S
45|Veigar|M 48|Trundle|J 50|Swain|S 51|Caitlyn|B 53|Blitzcrank|S 54|Malphite|T 55|Katarina|M 56|Nocturne|J
57|Maokai|S 58|Renekton|T 59|JarvanIV|J 60|Elise|J 61|Orianna|M 62|MonkeyKing|J 63|Brand|S 64|LeeSin|J
67|Vayne|B 68|Rumble|T 69|Cassiopeia|M 72|Skarner|J 74|Heimerdinger|M 75|Nasus|T 76|Nidalee|J 77|Udyr|J
78|Poppy|J 79|Gragas|J 80|Pantheon|S 81|Ezreal|B 82|Mordekaiser|T 83|Yorick|T 84|Akali|MT 85|Kennen|T
86|Garen|T 89|Leona|S 90|Malzahar|M 91|Talon|M 92|Riven|T 96|KogMaw|B 98|Shen|T 99|Lux|S 101|Xerath|S
102|Shyvana|J 103|Ahri|M 104|Graves|J 105|Fizz|M 106|Volibear|J 107|Rengar|J 110|Varus|B 111|Nautilus|S
112|Viktor|M 113|Sejuani|J 114|Fiora|T 115|Ziggs|B 117|Lulu|S 119|Draven|B 120|Hecarim|J 121|Khazix|J
122|Darius|T 126|Jayce|T 127|Lissandra|M 131|Diana|J 133|Quinn|T 134|Syndra|M 136|AurelionSol|M 141|Kayn|J
142|Zoe|M 143|Zyra|S 145|Kaisa|B 147|Seraphine|S 150|Gnar|T 154|Zac|J 157|Yasuo|MT 161|Velkoz|S 163|Taliyah|J
164|Camille|T 166|Akshan|M 200|Belveth|J 201|Braum|S 202|Jhin|B 203|Kindred|J 221|Zeri|B 222|Jinx|B
223|TahmKench|T 233|Briar|J 234|Viego|J 235|Senna|S 236|Lucian|B 238|Zed|M 240|Kled|T 245|Ekko|JM 246|Qiyana|M
254|Vi|J 266|Aatrox|T 267|Nami|S 268|Azir|M 350|Yuumi|S 360|Samira|B 412|Thresh|S 420|Illaoi|T 421|RekSai|J
427|Ivern|J 429|Kalista|B 432|Bard|S 497|Rakan|S 498|Xayah|B 516|Ornn|T 517|Sylas|MJ 518|Neeko|MS 523|Aphelios|B
526|Rell|S 555|Pyke|S 711|Vex|M 777|Yone|MT 799|Ambessa|T 800|Mel|M 875|Sett|T 876|Lillia|J 887|Gwen|T
888|Renata|S 893|Aurora|MT 895|Nilah|B 897|KSante|T 901|Smolder|B 902|Milio|S 910|Hwei|M 950|Naafiri|M
`;

const NAME_OVERRIDES: Record<string, string> = {
  MonkeyKing: "Wukong",
  Chogath: "Cho'Gath",
  Khazix: "Kha'Zix",
  KogMaw: "Kog'Maw",
  Velkoz: "Vel'Koz",
  Kaisa: "Kai'Sa",
  Belveth: "Bel'Veth",
  RekSai: "Rek'Sai",
  KSante: "K'Sante",
  Leblanc: "LeBlanc",
  DrMundo: "Dr. Mundo",
  JarvanIV: "Jarvan IV",
  Nunu: "Nunu & Willump",
  Renata: "Renata Glasc",
  AurelionSol: "Aurelion Sol",
  TahmKench: "Tahm Kench",
};

const TITLES: Record<string, string> = {
  Yasuo: "the Unforgiven",
  Yone: "the Unforgotten",
  Zed: "the Master of Shadows",
  Akali: "the Rogue Assassin",
  Katarina: "the Sinister Blade",
  Ahri: "the Nine-Tailed Fox",
  LeeSin: "the Blind Monk",
  Riven: "the Exile",
  Aatrox: "the Darkin Blade",
  Darius: "the Hand of Noxus",
  Jax: "Grandmaster at Arms",
  Viego: "the Ruined King",
  Kayn: "the Shadow Reaper",
  Sylas: "the Unshackled",
  Ekko: "the Boy Who Shattered Time",
  Jinx: "the Loose Cannon",
  Thresh: "the Chain Warden",
  Lux: "the Lady of Luminosity",
  Kaisa: "Daughter of the Void",
  Ezreal: "the Prodigal Explorer",
  Orianna: "the Lady of Clockwork",
  Syndra: "the Dark Sovereign",
  Irelia: "the Blade Dancer",
  Fiora: "the Grand Duelist",
  Camille: "the Steel Shadow",
  Talon: "the Blade's Shadow",
  Leblanc: "the Deceiver",
  Viktor: "the Herald of the Arcane",
  Aurora: "the Witch Between Worlds",
  Ambessa: "Matriarch of War",
  Mel: "the Soul's Reflection",
  Smolder: "the Fiery Fledgling",
  Hwei: "the Visionary",
};

function deriveName(key: string): string {
  return NAME_OVERRIDES[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export const FALLBACK_CHAMPIONS: ChampionInfo[] = CHAMPION_TABLE.trim()
  .split(/\s+/)
  .map((row) => {
    const [id, key, roles] = row.split("|");
    return {
      id: Number(id),
      key,
      name: deriveName(key),
      title: TITLES[key] ?? "",
      roles: roles.split("").map((c) => R[c]),
      tags: [],
    };
  });

/* ------------------------------------------------------------------ items */

export const ITEMS: Record<number, string> = {
  3123: "Executioner's Calling",
  6609: "Chempunk Chainsword",
  3916: "Oblivion Orb",
  3076: "Bramble Vest",
  3139: "Mercurial Scimitar",
  8020: "Abyssal Mask",
  6653: "Liandry's Torment",
  3137: "Cryptbloom",
  6695: "Serpent's Fang",
  1036: "Long Sword",
  1054: "Doran's Shield",
  1055: "Doran's Blade",
  1056: "Doran's Ring",
  1082: "Dark Seal",
  2003: "Health Potion",
  2031: "Refillable Potion",
  2055: "Control Ward",
  2065: "Shurelya's Battlesong",
  2502: "Unending Despair",
  2504: "Kaenic Rookern",
  3009: "Boots of Swiftness",
  3050: "Zeke's Convergence",
  3065: "Spirit Visage",
  3068: "Sunfire Aegis",
  3075: "Thornmail",
  3083: "Warmog's Armor",
  3084: "Heartsteel",
  3107: "Redemption",
  3109: "Knight's Vow",
  3110: "Frozen Heart",
  3143: "Randuin's Omen",
  3190: "Locket of the Iron Solari",
  3222: "Mikael's Blessing",
  3504: "Ardent Censer",
  3865: "World Atlas",
  4005: "Imperial Mandate",
  4401: "Force of Nature",
  6616: "Staff of Flowing Water",
  6617: "Moonstone Renewer",
  6621: "Dawncore",
  6665: "Jak'Sho, The Protean",
  3006: "Berserker's Greaves",
  3020: "Sorcerer's Shoes",
  3026: "Guardian Angel",
  3031: "Infinity Edge",
  3033: "Mortal Reminder",
  3036: "Lord Dominik's Regards",
  3042: "Muramana",
  3047: "Plated Steelcaps",
  3053: "Sterak's Gage",
  3071: "Black Cleaver",
  3072: "Bloodthirster",
  3074: "Ravenous Hydra",
  3078: "Trinity Force",
  3089: "Rabadon's Deathcap",
  3091: "Wit's End",
  3100: "Lich Bane",
  3102: "Banshee's Veil",
  3111: "Mercury's Treads",
  3135: "Void Staff",
  3142: "Youmuu's Ghostblade",
  3152: "Hextech Rocketbelt",
  3153: "Blade of the Ruined King",
  3156: "Maw of Malmortius",
  3157: "Zhonya's Hourglass",
  3158: "Ionian Boots of Lucidity",
  3161: "Spear of Shojin",
  3165: "Morellonomicon",
  3340: "Stealth Ward",
  3363: "Farsight Alteration",
  3364: "Oracle Lens",
  3814: "Edge of Night",
  4645: "Shadowflame",
  6333: "Death's Dance",
  6610: "Sundered Sky",
  6655: "Luden's Companion",
  6672: "Kraken Slayer",
  6673: "Immortal Shieldbow",
  6675: "Navori Flickerblade",
  6692: "Eclipse",
  6694: "Serylda's Grudge",
  6697: "Hubris",
  6698: "Profane Hydra",
};

/* ----------------------------------------------------------- summoner spells */

export const SPELLS: Record<number, { key: string; name: string }> = {
  1: { key: "SummonerBoost", name: "Cleanse" },
  3: { key: "SummonerExhaust", name: "Exhaust" },
  4: { key: "SummonerFlash", name: "Flash" },
  6: { key: "SummonerHaste", name: "Ghost" },
  7: { key: "SummonerHeal", name: "Heal" },
  11: { key: "SummonerSmite", name: "Smite" },
  12: { key: "SummonerTeleport", name: "Teleport" },
  14: { key: "SummonerDot", name: "Ignite" },
  21: { key: "SummonerBarrier", name: "Barrier" },
};

/* ------------------------------------------------------------------- runes */

export interface RuneDef {
  id: number;
  name: string;
  icon: string; // relative to /cdn/img/
  style: number;
  row: number; // 0 = keystone row
}

export interface RuneStyleDef {
  id: number;
  key: string;
  name: string;
  icon: string;
  color: string;
}

export const RUNE_STYLES: RuneStyleDef[] = [
  { id: 8000, key: "Precision", name: "Precision", icon: "perk-images/Styles/7201_Precision.png", color: "#C8AA6E" },
  { id: 8100, key: "Domination", name: "Domination", icon: "perk-images/Styles/7200_Domination.png", color: "#D44242" },
  { id: 8200, key: "Sorcery", name: "Sorcery", icon: "perk-images/Styles/7202_Sorcery.png", color: "#9FAAFC" },
  { id: 8400, key: "Resolve", name: "Resolve", icon: "perk-images/Styles/7204_Resolve.png", color: "#A1D586" },
  { id: 8300, key: "Inspiration", name: "Inspiration", icon: "perk-images/Styles/7203_Whimsy.png", color: "#49AAB9" },
];

// style|row|id|Folder/Name  (icon = perk-images/Styles/<Style>/<Folder>/<Name>.png unless a path is given)
const RUNE_TABLE: [number, number, number, string, string][] = [
  [8000, 0, 8005, "Press the Attack", "Precision/PressTheAttack/PressTheAttack.png"],
  [8000, 0, 8008, "Lethal Tempo", "Precision/LethalTempo/LethalTempoTemp.png"],
  [8000, 0, 8021, "Fleet Footwork", "Precision/FleetFootwork/FleetFootwork.png"],
  [8000, 0, 8010, "Conqueror", "Precision/Conqueror/Conqueror.png"],
  [8000, 1, 9101, "Absorb Life", "Precision/AbsorbLife/AbsorbLife.png"],
  [8000, 1, 9111, "Triumph", "Precision/Triumph.png"],
  [8000, 1, 8009, "Presence of Mind", "Precision/PresenceOfMind/PresenceOfMind.png"],
  [8000, 2, 9104, "Legend: Alacrity", "Precision/LegendAlacrity/LegendAlacrity.png"],
  [8000, 2, 9105, "Legend: Haste", "Precision/LegendHaste/LegendHaste.png"],
  [8000, 2, 9103, "Legend: Bloodline", "Precision/LegendBloodline/LegendBloodline.png"],
  [8000, 3, 8014, "Coup de Grace", "Precision/CoupDeGrace/CoupDeGrace.png"],
  [8000, 3, 8017, "Cut Down", "Precision/CutDown/CutDown.png"],
  [8000, 3, 8299, "Last Stand", "Sorcery/LastStand/LastStand.png"],
  [8100, 0, 8112, "Electrocute", "Domination/Electrocute/Electrocute.png"],
  [8100, 0, 8128, "Dark Harvest", "Domination/DarkHarvest/DarkHarvest.png"],
  [8100, 0, 9923, "Hail of Blades", "Domination/HailOfBlades/HailOfBlades.png"],
  [8100, 1, 8126, "Cheap Shot", "Domination/CheapShot/CheapShot.png"],
  [8100, 1, 8139, "Taste of Blood", "Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png"],
  [8100, 1, 8143, "Sudden Impact", "Domination/SuddenImpact/SuddenImpact.png"],
  [8100, 2, 8137, "Sixth Sense", "Domination/SixthSense/SixthSense.png"],
  [8100, 2, 8140, "Grisly Mementos", "Domination/GrislyMementos/GrislyMementos.png"],
  [8100, 2, 8141, "Deep Ward", "Domination/DeepWard/DeepWard.png"],
  [8100, 3, 8135, "Treasure Hunter", "Domination/TreasureHunter/TreasureHunter.png"],
  [8100, 3, 8105, "Relentless Hunter", "Domination/RelentlessHunter/RelentlessHunter.png"],
  [8100, 3, 8106, "Ultimate Hunter", "Domination/UltimateHunter/UltimateHunter.png"],
  [8200, 0, 8214, "Summon Aery", "Sorcery/SummonAery/SummonAery.png"],
  [8200, 0, 8229, "Arcane Comet", "Sorcery/ArcaneComet/ArcaneComet.png"],
  [8200, 0, 8230, "Phase Rush", "Sorcery/PhaseRush/PhaseRush.png"],
  [8200, 1, 8224, "Axiom Arcanist", "Sorcery/NullifyingOrb/Axiom_Arcanist.png"],
  [8200, 1, 8226, "Manaflow Band", "Sorcery/ManaflowBand/ManaflowBand.png"],
  [8200, 1, 8275, "Nimbus Cloak", "Sorcery/NimbusCloak/6361.png"],
  [8200, 2, 8210, "Transcendence", "Sorcery/Transcendence/Transcendence.png"],
  [8200, 2, 8234, "Celerity", "Sorcery/Celerity/CelerityTemp.png"],
  [8200, 2, 8233, "Absolute Focus", "Sorcery/AbsoluteFocus/AbsoluteFocus.png"],
  [8200, 3, 8237, "Scorch", "Sorcery/Scorch/Scorch.png"],
  [8200, 3, 8232, "Waterwalking", "Sorcery/Waterwalking/Waterwalking.png"],
  [8200, 3, 8236, "Gathering Storm", "Sorcery/GatheringStorm/GatheringStorm.png"],
  [8400, 0, 8437, "Grasp of the Undying", "Resolve/GraspOfTheUndying/GraspOfTheUndying.png"],
  [8400, 0, 8439, "Aftershock", "Resolve/VeteranAftershock/VeteranAftershock.png"],
  [8400, 0, 8465, "Guardian", "Resolve/Guardian/Guardian.png"],
  [8400, 1, 8446, "Demolish", "Resolve/Demolish/Demolish.png"],
  [8400, 1, 8463, "Font of Life", "Resolve/FontOfLife/FontOfLife.png"],
  [8400, 1, 8401, "Shield Bash", "Resolve/MirrorShell/MirrorShell.png"],
  [8400, 2, 8429, "Conditioning", "Resolve/Conditioning/Conditioning.png"],
  [8400, 2, 8444, "Second Wind", "Resolve/SecondWind/SecondWind.png"],
  [8400, 2, 8473, "Bone Plating", "Resolve/BonePlating/BonePlating.png"],
  [8400, 3, 8451, "Overgrowth", "Resolve/Overgrowth/Overgrowth.png"],
  [8400, 3, 8453, "Revitalize", "Resolve/Revitalize/Revitalize.png"],
  [8400, 3, 8242, "Unflinching", "Sorcery/Unflinching/Unflinching.png"],
  [8300, 0, 8351, "Glacial Augment", "Inspiration/GlacialAugment/GlacialAugment.png"],
  [8300, 0, 8360, "Unsealed Spellbook", "Inspiration/UnsealedSpellbook/UnsealedSpellbook.png"],
  [8300, 0, 8369, "First Strike", "Inspiration/FirstStrike/FirstStrike.png"],
  [8300, 1, 8306, "Hextech Flashtraption", "Inspiration/HextechFlashtraption/HextechFlashtraption.png"],
  [8300, 1, 8304, "Magical Footwear", "Inspiration/MagicalFootwear/MagicalFootwear.png"],
  [8300, 1, 8321, "Cash Back", "Inspiration/CashBack/CashBack2.png"],
  [8300, 2, 8313, "Triple Tonic", "Inspiration/PerfectTiming/AlchemistCabinet.png"],
  [8300, 2, 8352, "Time Warp Tonic", "Inspiration/TimeWarpTonic/TimeWarpTonic.png"],
  [8300, 2, 8345, "Biscuit Delivery", "Inspiration/BiscuitDelivery/BiscuitDelivery.png"],
  [8300, 3, 8347, "Cosmic Insight", "Inspiration/CosmicInsight/CosmicInsight.png"],
  [8300, 3, 8410, "Approach Velocity", "Resolve/ApproachVelocity/ApproachVelocity.png"],
  [8300, 3, 8316, "Jack of All Trades", "Inspiration/JackOfAllTrades/JackofAllTrades2.png"],
];

export const RUNES: RuneDef[] = RUNE_TABLE.map(([style, row, id, name, path]) => ({
  id,
  name,
  style,
  row,
  icon: `perk-images/Styles/${path}`,
}));

export const STAT_SHARDS: Record<number, { name: string; icon: string }> = {
  5008: { name: "Adaptive Force", icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png" },
  5005: { name: "Attack Speed", icon: "perk-images/StatMods/StatModsAttackSpeedIcon.png" },
  5007: { name: "Ability Haste", icon: "perk-images/StatMods/StatModsCDRScalingIcon.png" },
  5010: { name: "Move Speed", icon: "perk-images/StatMods/StatModsMovementSpeedIcon.png" },
  5001: { name: "Health Scaling", icon: "perk-images/StatMods/StatModsHealthPlusIcon.png" },
  5011: { name: "Health", icon: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
  5013: { name: "Tenacity and Slow Resist", icon: "perk-images/StatMods/StatModsTenacityIcon.png" },
};

/* ------------------------------------------------------------------ queues */

export const QUEUES: Record<number, string> = {
  0: "Custom",
  400: "Normal Draft",
  420: "Ranked Solo/Duo",
  430: "Normal Blind",
  440: "Ranked Flex",
  450: "ARAM",
  480: "Swiftplay",
  490: "Quickplay",
  700: "Clash",
  900: "URF",
  1010: "ARURF",
  1700: "Arena",
  1710: "Arena",
  1900: "URF",
  2400: "ARAM Chaos",
};

export const QUEUE_FILTERS: { value: string; label: string; ids: number[] | null }[] = [
  { value: "all", label: "All Queues", ids: null },
  { value: "solo", label: "Ranked Solo", ids: [420] },
  { value: "flex", label: "Ranked Flex", ids: [440] },
  { value: "normal", label: "Normal", ids: [400, 430, 480, 490] },
  { value: "aram", label: "ARAM", ids: [450] },
  { value: "aram-mayhem", label: "ARAM Chaos", ids: [2400] },
  { value: "arena", label: "Arena", ids: [1700, 1710] },
];

export function queueName(id: number): string {
  return QUEUES[id] ?? `Queue ${id}`;
}
