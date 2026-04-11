// Хранилище состояния кампании D&D — localStorage с автосохранением

export interface Attribute {
  str: number; dex: number; con: number;
  int: number; wis: number; cha: number;
}

export interface SkillData {
  name: string;
  attr: keyof Attribute;
  attrLabel: string;
  proficient: boolean;
  expertise?: boolean;
}

export interface CharacterState {
  name: string;
  race: string;
  cls: string;
  level: number;
  attributes: Attribute;
  hp: { current: number; max: number; temp: number };
  ac: number;
  initiative: number;
  speed: number;
  profBonus: number;
  hitDice: string;
  background: string;
  alignment: string;
  skills: Record<string, { proficient: boolean; expertise: boolean }>;
  classFeatures: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "weapon" | "armor" | "potion" | "gear" | "food" | "magic" | "tool";
  rarity: "common" | "uncommon" | "rare" | "very_rare" | "legendary" | "artifact";
  weight: number;
  value: string;
  qty: number;
  equipped: boolean;
  desc: string;
  mechanics?: string;
  lore?: string;
  // weapon
  damage?: string;
  damageType?: string;
  properties?: string[];
  // armor
  acBonus?: number;
  strRequirement?: number;
  stealthDisadvantage?: boolean;
  // potion/magic
  effect?: string;
  duration?: string;
  requiresAttunement?: boolean;
  charges?: number;
}

export interface Currency {
  cp: number; sp: number; ep: number; gp: number; pp: number;
}

export interface NPC {
  id: string;
  name: string;
  race: string;
  role: string;
  relation: number; // -10 to +10
  location: string;
  traits: string[];
  speechStyle?: string;
  secrets?: string;
  quests?: string[];
  promises?: string[];
}

export interface ChronicleEntry {
  id: string;
  session: number;
  date: string;
  title: string;
  description: string;
  participants: string[];
  location: string;
  consequences: string;
  flags: string[];
}

export interface PlotThread {
  id: string;
  name: string;
  status: "active" | "paused" | "completed";
  description: string;
  npcs: string[];
  locations: string[];
  timer?: string;
}

export interface WorldBible {
  name: string;
  era: string;
  description: string;
  magicLevel: string;
  factions: { name: string; goal: string; relation: number }[];
  locations: { name: string; description: string; type: string }[];
  history: string[];
  gods: { name: string; domain: string; alignment: string }[];
}

export interface ChatMessage {
  role: "master" | "player";
  text: string;
  time: string;
}

export interface Settings {
  provider: "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  apiKey: string;
  narrativeStyle: string;
  difficulty: string;
  language: string;
}

export interface GameState {
  character: CharacterState;
  inventory: { items: InventoryItem[]; currency: Currency };
  world: WorldBible;
  npcs: NPC[];
  chronicle: ChronicleEntry[];
  plotThreads: PlotThread[];
  chatHistory: ChatMessage[];
  settings: Settings;
  currentLocation: string;
  sessionNumber: number;
}

// ─── Модификаторы ─────────────────────────────────────────────────
export function attrMod(value: number): number {
  return Math.floor((value - 10) / 2);
}

export function modStr(value: number): string {
  const m = attrMod(value);
  return m >= 0 ? `+${m}` : `${m}`;
}

export function getSkillBonus(
  character: CharacterState,
  skill: SkillData
): number {
  const base = attrMod(character.attributes[skill.attr]);
  const prof = character.skills[skill.name];
  if (!prof) return base;
  if (prof.expertise) return base + character.profBonus * 2;
  if (prof.proficient) return base + character.profBonus;
  return base;
}

// ─── Валюта ────────────────────────────────────────────────────────
export function currencyToCopper(c: Currency): number {
  return c.cp + c.sp * 10 + c.ep * 50 + c.gp * 100 + c.pp * 1000;
}

export function copperToCurrency(cp: number): Currency {
  const pp = Math.floor(cp / 1000); cp %= 1000;
  const gp = Math.floor(cp / 100); cp %= 100;
  const sp = Math.floor(cp / 10); cp %= 10;
  return { cp, sp, ep: 0, gp, pp };
}

export function currencyWeight(c: Currency): number {
  const total = c.cp + c.sp + c.ep + c.gp + c.pp;
  return Math.round((total / 50) * 10) / 10;
}

// ─── Начальное состояние ──────────────────────────────────────────
const DEFAULT_STATE: GameState = {
  character: {
    name: "Кэрган Буревестник",
    race: "Человек",
    cls: "Воин",
    level: 5,
    attributes: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
    hp: { current: 42, max: 52, temp: 0 },
    ac: 18,
    initiative: 2,
    speed: 30,
    profBonus: 3,
    hitDice: "5к10",
    background: "Солдат",
    alignment: "Нейтральный добрый",
    skills: {
      "Акробатика": { proficient: true, expertise: false },
      "Атлетика": { proficient: true, expertise: false },
      "Восприятие": { proficient: true, expertise: false },
    },
    classFeatures: [
      "⚔️ Атака действием бонуса",
      "🛡️ Второе дыхание (1/отдых)",
      "💫 Всплеск действий (1/отдых)",
      "🗡️ Боевой стиль: Дуэль +2",
    ],
  },
  inventory: {
    items: [
      { id: "1", name: "Длинный меч", type: "weapon", rarity: "common", weight: 3, value: "15 ЗМ", qty: 1, equipped: true, desc: "Стальной клинок с рукоятью из кожи. Хорошо сбалансирован.", lore: "Стандартное оружие ветерана. На клинке едва заметное клеймо кузнеца.", mechanics: "1к8 рубящий урон", damage: "1к8", damageType: "Рубящий", properties: ["Фехтовальное"] },
      { id: "2", name: "Щит", type: "armor", rarity: "common", weight: 6, value: "10 ЗМ", qty: 1, equipped: true, desc: "Деревянный щит с металлическим умбоном.", mechanics: "+2 к КД", acBonus: 2 },
      { id: "3", name: "Кольчуга", type: "armor", rarity: "common", weight: 55, value: "75 ЗМ", qty: 1, equipped: true, desc: "Плотно переплетённые стальные кольца. Надёжная защита.", mechanics: "КД 16", acBonus: 16, stealthDisadvantage: true },
      { id: "4", name: "Зелье лечения", type: "potion", rarity: "common", weight: 0.5, value: "50 ЗМ", qty: 3, equipped: false, desc: "Красноватая жидкость в стеклянном флаконе.", mechanics: "Восстанавливает 2к4+2 HP", effect: "Восстанавливает 2к4+2 очка здоровья", duration: "Мгновенно" },
      { id: "5", name: "Верёвка, пеньковая (50 фт.)", type: "gear", rarity: "common", weight: 10, value: "1 ЗМ", qty: 1, equipped: false, desc: "Прочная пеньковая верёвка.", mechanics: "Грузоподъёмность 200 фунтов" },
      { id: "6", name: "Факелы", type: "gear", rarity: "common", weight: 1, value: "1 СМ", qty: 10, equipped: false, desc: "Деревянные факелы, пропитанные смолой.", mechanics: "Свет 20 фт., 1 час горения" },
      { id: "7", name: "Паёк", type: "food", rarity: "common", weight: 2, value: "5 СМ", qty: 5, equipped: false, desc: "Сухой паёк: вяленое мясо, сухари, орехи.", mechanics: "1 день питания" },
      { id: "8", name: "Книга заклинаний", type: "magic", rarity: "uncommon", weight: 3, value: "50 ЗМ", qty: 1, equipped: false, desc: "Тёмная кожаная обложка с серебряными застёжками. Страницы покрыты тайными символами.", lore: "Найдена среди вещей павшего мага. 12 заклинаний 1-3 кругов.", requiresAttunement: false, effect: "Содержит 12 заклинаний" },
    ],
    currency: { cp: 47, sp: 23, ep: 0, gp: 158, pp: 2 },
  },
  world: {
    name: "Фаэрун",
    era: "Эпоха Смут",
    description: "Обширный континент на планете Торил, мир меча и магии, где боги ходят по земле.",
    magicLevel: "Высокий",
    factions: [
      { name: "Арфисты", goal: "Поддержание баланса и свободы", relation: 2 },
      { name: "Приказ Перчатки", goal: "Борьба со злом и порядок", relation: 3 },
      { name: "Серые плащи", goal: "Неизвестно", relation: -5 },
    ],
    locations: [
      { name: "Вотердип", description: "Город Великолепия, крупнейший торговый порт", type: "Город" },
      { name: "Таверна «Пьяный дракон»", description: "Тёмная таверна в доковом районе", type: "Здание" },
    ],
    history: [
      "Год 1479 ДР. Окончание Времени Невзгод.",
      "Серые плащи начали похищения торговцев в порту Вотердипа.",
    ],
    gods: [
      { name: "Тир", domain: "Правосудие", alignment: "Законно-добрый" },
      { name: "Мистра", domain: "Магия", alignment: "Нейтрально-добрый" },
    ],
  },
  npcs: [
    { id: "1", name: "Аэрандил Серебряный Лист", race: "Эльф", role: "Таинственный информатор", relation: 2, location: "Таверна «Пьяный дракон»", traits: ["Нервный", "Образованный", "Скрытный"], speechStyle: "Говорит тихо, часто делает паузы, употребляет архаизмы", secrets: "Беглец из Подземья, знает расположение тайного прохода", quests: ["Защитить от Серых плащей"] },
    { id: "2", name: "Тавита Зимний Ветер", race: "Полурослик", role: "Трактирщица", relation: 4, location: "Таверна «Пьяный дракон»", traits: ["Радушная", "Наблюдательная", "Осторожная"], speechStyle: "Говорит быстро, любит шутки, называет гостей «голубчик»" },
    { id: "3", name: "Сержант Марко Вейн", race: "Человек", role: "Стражник", relation: 0, location: "Западный район Вотердипа", traits: ["Принципиальный", "Усталый", "Честный"] },
    { id: "4", name: "Теневой Лис", race: "Неизвестно", role: "Агент Серых плащей", relation: -7, location: "Неизвестно", traits: ["Жестокий", "Расчётливый", "Неуловимый"], secrets: "Настоящее имя неизвестно. Действует от имени таинственного покровителя." },
  ],
  chronicle: [
    { id: "1", session: 1, date: "День 1, Утро", title: "Прибытие в Вотердип", description: "Партия прибыла в Город Великолепия через Южные ворота. Стражники были напряжены — сказали о серии похищений.", participants: [], location: "Южные ворота Вотердипа", consequences: "Получена базовая информация о городе", flags: [] },
    { id: "2", session: 1, date: "День 1, Вечер", title: "Встреча с Аэрандилом", description: "В таверне «Пьяный дракон» обнаружен подозрительный эльф с картой. За ним следили двое в серых плащах.", participants: ["Аэрандил Серебряный Лист", "Тавита Зимний Ветер"], location: "Таверна «Пьяный дракон»", consequences: "Начало главного квеста. Эльф просит защиты.", flags: ["вступил_в_контакт_с_аэрандилом"] },
  ],
  plotThreads: [
    { id: "1", name: "Тайна Серых плащей", status: "active", description: "Загадочная организация похищает торговцев в порту Вотердипа. Их цели и покровитель неизвестны.", npcs: ["Теневой Лис"], locations: ["Вотердип", "Доковый район"], timer: "Аэрандил будет схвачен через 3 дня" },
    { id: "2", name: "Карта Аэрандила", status: "active", description: "Эльф владеет картой тайного прохода в Подземье. Что там скрыто?", npcs: ["Аэрандил Серебряный Лист"], locations: ["Подземье"] },
  ],
  chatHistory: [
    { role: "master", text: "Добро пожаловать в Таверну «Пьяный дракон». Вечер в Вотердипе обещает быть тёмным — по углам шепчутся подозрительные личности, а у стойки бара сидит закутанный в плащ незнакомец с картой в руке.\n\nЧто делает Кэрган Буревестник?", time: "21:14" },
    { role: "player", text: "Оглядываю таверну, стараясь не привлекать внимание. Хочу рассмотреть незнакомца поближе.", time: "21:15" },
    { role: "master", text: "Проверка Проницательности (Мудрость): вы набрали 14. Незнакомец — пожилой эльф с усталыми глазами. На его руках следы от цепей, карта явно старая — пергамент пожелтел от времени. Он нервно смотрит на дверь каждую минуту.\n\nЗа соседним столиком двое людей в одинаковых серых плащах тихо переговариваются, поглядывая в его сторону.", time: "21:15" },
  ],
  settings: {
    provider: "openai",
    model: "gemini-flash",
    temperature: 0.8,
    apiKey: "",
    narrativeStyle: "Эпический",
    difficulty: "Обычная",
    language: "Русский",
  },
  currentLocation: "Таверна «Пьяный дракон», Вотердип",
  sessionNumber: 1,
};

// ─── Store ─────────────────────────────────────────────────────────
const STORAGE_KEY = "dnd_campaign_state";

export function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as GameState;
      const PAID_MODELS = ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo", "claude-opus-4", "claude-sonnet-4", "claude-haiku-3"];
      const savedModel = saved.settings?.model ?? "";
      const migratedModel = PAID_MODELS.includes(savedModel) ? "gemini-flash" : savedModel;
      // Мержим с дефолтами на случай новых полей
      return {
        ...DEFAULT_STATE,
        ...saved,
        character: { ...DEFAULT_STATE.character, ...saved.character },
        inventory: { ...DEFAULT_STATE.inventory, ...saved.inventory },
        settings: { ...DEFAULT_STATE.settings, ...saved.settings, model: migratedModel },
      };
    }
  } catch (_e) {
    // ignore parse errors, use defaults
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_e) {
    // ignore storage errors
  }
}

export function exportState(state: GameState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign_${state.character.name}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importState(file: File): Promise<GameState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string) as GameState);
      } catch { reject(new Error("Неверный формат файла")); }
    };
    reader.readAsText(file);
  });
}

// Все навыки D&D 5e
export const ALL_SKILLS: SkillData[] = [
  { name: "Акробатика", attr: "dex", attrLabel: "Ловкость", proficient: false },
  { name: "Атлетика", attr: "str", attrLabel: "Сила", proficient: false },
  { name: "Аркана", attr: "int", attrLabel: "Интеллект", proficient: false },
  { name: "Восприятие", attr: "wis", attrLabel: "Мудрость", proficient: false },
  { name: "Выживание", attr: "wis", attrLabel: "Мудрость", proficient: false },
  { name: "Запугивание", attr: "cha", attrLabel: "Харизма", proficient: false },
  { name: "История", attr: "int", attrLabel: "Интеллект", proficient: false },
  { name: "Магия", attr: "int", attrLabel: "Интеллект", proficient: false },
  { name: "Медицина", attr: "wis", attrLabel: "Мудрость", proficient: false },
  { name: "Обман", attr: "cha", attrLabel: "Харизма", proficient: false },
  { name: "Природа", attr: "int", attrLabel: "Интеллект", proficient: false },
  { name: "Проницательность", attr: "wis", attrLabel: "Мудрость", proficient: false },
  { name: "Религия", attr: "int", attrLabel: "Интеллект", proficient: false },
  { name: "Скрытность", attr: "dex", attrLabel: "Ловкость", proficient: false },
  { name: "Убеждение", attr: "cha", attrLabel: "Харизма", proficient: false },
  { name: "Уход за животными", attr: "wis", attrLabel: "Мудрость", proficient: false },
];

export const ATTR_LABELS: Record<keyof Attribute, string> = {
  str: "Сила", dex: "Ловкость", con: "Телосложение",
  int: "Интеллект", wis: "Мудрость", cha: "Харизма",
};