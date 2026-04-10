import { useState } from "react";
import Icon from "@/components/ui/icon";

type Tab = "chat" | "character" | "inventory" | "dice" | "world" | "settings";

const TABS: { id: Tab; label: string; icon: string; rune: string }[] = [
  { id: "chat", label: "Мастер", icon: "MessageSquare", rune: "ᚠ" },
  { id: "character", label: "Персонаж", icon: "User", rune: "ᚢ" },
  { id: "inventory", label: "Инвентарь", icon: "Package", rune: "ᚦ" },
  { id: "dice", label: "Кости", icon: "Dices", rune: "ᚨ" },
  { id: "world", label: "Мир", icon: "BookOpen", rune: "ᚱ" },
  { id: "settings", label: "Настройки", icon: "Settings", rune: "ᚲ" },
];

const STATS = [
  { name: "СИЛ", full: "Сила", value: 16, mod: "+3" },
  { name: "ЛОВ", full: "Ловкость", value: 14, mod: "+2" },
  { name: "ТЕЛ", full: "Телосложение", value: 15, mod: "+2" },
  { name: "ИНТ", full: "Интеллект", value: 10, mod: "+0" },
  { name: "МДР", full: "Мудрость", value: 12, mod: "+1" },
  { name: "ХАР", full: "Харизма", value: 8, mod: "-1" },
];

const SKILLS = [
  { name: "Акробатика", bonus: "+4", stat: "ЛОВ", prof: true },
  { name: "Атлетика", bonus: "+5", stat: "СИЛ", prof: true },
  { name: "Аркана", bonus: "+0", stat: "ИНТ", prof: false },
  { name: "Восприятие", bonus: "+3", stat: "МДР", prof: true },
  { name: "Убеждение", bonus: "-1", stat: "ХАР", prof: false },
  { name: "Скрытность", bonus: "+2", stat: "ЛОВ", prof: false },
  { name: "История", bonus: "+0", stat: "ИНТ", prof: false },
  { name: "Проницательность", bonus: "+1", stat: "МДР", prof: false },
];

const INVENTORY_ITEMS = [
  { name: "Длинный меч", type: "weapon", weight: 3, value: "15зм", desc: "1к8 рубящий" },
  { name: "Щит", type: "armor", weight: 6, value: "10зм", desc: "+2 КД" },
  { name: "Кольчуга", type: "armor", weight: 55, value: "75зм", desc: "КД 16" },
  { name: "Зелье лечения ×3", type: "potion", weight: 1.5, value: "50зм", desc: "2к4+2 хп" },
  { name: "Верёвка (50 фт.)", type: "gear", weight: 10, value: "1зм", desc: "Пеньковая" },
  { name: "Факелы ×10", type: "gear", weight: 10, value: "1ср", desc: "1 час, 20 фт." },
  { name: "Паёк (5 дней)", type: "food", weight: 10, value: "2зм 5ср", desc: "Сухой паёк" },
  { name: "Книга заклинаний", type: "magic", weight: 3, value: "50зм", desc: "12 заклинаний" },
];

const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

type DiceRoll = { dice: string; result: number; total: number; timestamp: string; critical?: boolean };

const CHAT_MESSAGES = [
  {
    role: "master",
    text: "Добро пожаловать в Таверну «Пьяный дракон». Вечер в Вотердипе обещает быть тёмным — по углам шепчутся подозрительные личности, а у стойки бара сидит закутанный в плащ незнакомец с картой в руке.\n\nЧто делает Кэрган Буревестник?",
    time: "21:14",
  },
  {
    role: "player",
    text: "Оглядываю таверну, стараясь не привлекать внимание. Хочу рассмотреть незнакомца поближе.",
    time: "21:15",
  },
  {
    role: "master",
    text: "Бросок Проницательности (Мудрость): вы набрали 14. Незнакомец — пожилой эльф с усталыми глазами. На его руках следы от цепей, карта явно старая — пергамент пожелтел от времени. Он нервно смотрит на дверь каждую минуту.\n\nЗа соседним столиком двое людей в одинаковых серых плащах тихо переговариваются, поглядывая в сторону эльфа.",
    time: "21:15",
  },
];

const WORLD_EVENTS = [
  { date: "День 1, Утро", title: "Прибытие в Вотердип", desc: "Партия прибыла в Город Великолепия через Южные ворота." },
  { date: "День 1, Вечер", title: "Встреча в таверне", desc: "Обнаружен подозрительный эльф с картой неизвестного подземелья." },
  { date: "День 2, День", title: "Допрос в порту", desc: "Выяснено, что эльф — Аэрандил Серебряный Лист, беглец из Подземья." },
];

const NPCS = [
  { name: "Аэрандил Серебряный Лист", race: "Эльф", role: "Таинственный информатор", attitude: "neutral" },
  { name: "Тавита Зимний Ветер", race: "Полурослик", role: "Трактирщица «Пьяного Дракона»", attitude: "friendly" },
  { name: "Сержант Марко Вейн", race: "Человек", role: "Стражник городской стражи", attitude: "neutral" },
  { name: "Теневой Лис", race: "Неизвестно", role: "Агент Серых плащей", attitude: "hostile" },
];

function RuneBorder() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div className="rune-corner rune-corner-tl">᛫ ᚠ ᚢ ᚦ ᛫</div>
      <div className="rune-corner rune-corner-tr">᛫ ᚨ ᚱ ᚲ ᛫</div>
      <div className="rune-corner rune-corner-bl">᛫ ᚷ ᚹ ᚺ ᛫</div>
      <div className="rune-corner rune-corner-br">᛫ ᚾ ᛁ ᛃ ᛫</div>
    </div>
  );
}

function StatBlock({ stat }: { stat: typeof STATS[0] }) {
  return (
    <div className="stat-block">
      <div className="stat-value">{stat.value}</div>
      <div className="stat-name">{stat.name}</div>
      <div className="stat-mod">{stat.mod}</div>
    </div>
  );
}

function ChatTab() {
  const [input, setInput] = useState("");
  const [messages] = useState(CHAT_MESSAGES);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-fantasy mb-4" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "player" ? "flex-row-reverse" : ""}`}>
            <div className={`chat-avatar ${msg.role === "master" ? "chat-avatar-master" : "chat-avatar-player"}`}>
              {msg.role === "master" ? "🐉" : "⚔️"}
            </div>
            <div className={`chat-bubble ${msg.role === "master" ? "chat-bubble-master" : "chat-bubble-player"}`}>
              <p className="text-sm leading-relaxed whitespace-pre-line">{msg.text}</p>
              <span className="text-xs opacity-50 mt-1 block">{msg.time}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Опишите действие вашего персонажа..."
          className="fantasy-input w-full resize-none"
          rows={2}
        />
        <button className="btn-primary mt-2 w-full flex items-center justify-center gap-2">
          <Icon name="Send" size={16} />
          Действовать
        </button>
      </div>
    </div>
  );
}

function CharacterTab() {
  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div className="character-header">
        <div className="character-portrait">
          <span className="text-5xl">🧙</span>
        </div>
        <div className="character-info flex-1">
          <h2 className="font-display text-2xl text-gold leading-tight">Кэрган Буревестник</h2>
          <p className="text-parchment-muted text-sm">Человек · Воин · 5 уровень</p>
          <p className="text-parchment-muted text-sm">Предпосылка: Солдат · Нейтральный добрый</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="hp-block">
              <span className="text-xs text-parchment-muted">ХП</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-crimson">42</span>
                <span className="text-parchment-muted text-sm">/ 52</span>
              </div>
              <div className="hp-bar"><div className="hp-fill" style={{ width: "80%" }} /></div>
            </div>
            <div className="hp-block">
              <span className="text-xs text-parchment-muted">КД</span>
              <span className="text-xl font-bold text-gold">18</span>
            </div>
            <div className="hp-block">
              <span className="text-xs text-parchment-muted">Иниц.</span>
              <span className="text-xl font-bold text-silver">+2</span>
            </div>
            <div className="hp-block">
              <span className="text-xs text-parchment-muted">Скор.</span>
              <span className="text-xl font-bold text-silver">30 фт</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="section-title">Характеристики</h3>
        <div className="grid grid-cols-6 gap-2">
          {STATS.map((s) => <StatBlock key={s.name} stat={s} />)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <h3 className="section-title">Навыки</h3>
          <div className="space-y-1">
            {SKILLS.map((sk) => (
              <div key={sk.name} className="skill-row">
                <span className={`skill-dot ${sk.prof ? "skill-dot-prof" : ""}`} />
                <span className="skill-name">{sk.name}</span>
                <span className="skill-bonus">{sk.bonus}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <h3 className="section-title">Спасброски</h3>
            <div className="space-y-1">
              {STATS.map((s) => (
                <div key={s.name} className="skill-row">
                  <span className={`skill-dot ${["СИЛ","ТЕЛ"].includes(s.name) ? "skill-dot-prof" : ""}`} />
                  <span className="skill-name">{s.full}</span>
                  <span className="skill-bonus">{["СИЛ","ТЕЛ"].includes(s.name) ? "+5" : s.mod}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="section-title">Опыт</h3>
            <div className="progress-block">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-parchment-muted">XP</span>
                <span className="text-gold">6500 / 14000</span>
              </div>
              <div className="xp-bar"><div className="xp-fill" style={{ width: "46%" }} /></div>
              <p className="text-xs text-parchment-muted mt-1">До 6 ур.: 7 500 XP</p>
            </div>
          </div>
          <div>
            <h3 className="section-title">Классовые черты</h3>
            <div className="space-y-1 text-sm">
              {["⚔️ Атака действием бонуса", "🛡️ Второе дыхание (1/отдых)", "💫 Всплеск действий (1/отдых)", "🗡️ Боевой стиль: Дуэль +2"].map(t => (
                <div key={t} className="trait-item">{t}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryTab() {
  const totalWeight = INVENTORY_ITEMS.reduce((s, i) => s + i.weight, 0);
  const maxWeight = 16 * 15;
  const typeEmoji: Record<string, string> = {
    weapon: "⚔️", armor: "🛡️", potion: "🧪", gear: "🎒", food: "🍖", magic: "✨",
  };
  const typeColor: Record<string, string> = {
    weapon: "text-crimson", armor: "text-silver", potion: "text-emerald",
    gear: "text-parchment-muted", food: "text-amber-400", magic: "text-violet-300",
  };

  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div>
        <h3 className="section-title mb-3">Валюта</h3>
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Медь", sym: "мм", amount: 47, cls: "text-amber-600" },
            { label: "Серебро", sym: "ср", amount: 23, cls: "text-silver" },
            { label: "Электрум", sym: "эл", amount: 0, cls: "text-teal-300" },
            { label: "Золото", sym: "зм", amount: 158, cls: "text-gold" },
            { label: "Платина", sym: "пл", amount: 2, cls: "text-slate-300" },
          ].map((c) => (
            <div key={c.sym} className="coin-block">
              <span className={`text-xl font-bold ${c.cls}`}>{c.amount}</span>
              <span className={`text-xs ${c.cls}`}>{c.sym}</span>
              <span className="text-xs text-parchment-muted">{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="section-title mb-0">Предметы</h3>
          <span className="text-xs text-parchment-muted">{totalWeight} / {maxWeight} фунтов</span>
        </div>
        <div className="weight-bar mb-3">
          <div className="weight-fill" style={{ width: `${(totalWeight / maxWeight) * 100}%` }} />
        </div>
        <div className="space-y-2">
          {INVENTORY_ITEMS.map((item, i) => (
            <div key={i} className="inventory-item">
              <div className={`text-sm font-semibold ${typeColor[item.type]}`}>
                {typeEmoji[item.type]} {item.name}
              </div>
              <div className="flex gap-3 text-xs text-parchment-muted mt-0.5">
                <span>{item.desc}</span>
                <span>·</span>
                <span>{item.weight} фунт.</span>
                <span>·</span>
                <span className="text-gold">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiceTab() {
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);

  const rollDice = (sides: number) => {
    setRolling(true);
    setTimeout(() => {
      const results: number[] = [];
      let total = modifier;
      for (let i = 0; i < count; i++) {
        const r = Math.floor(Math.random() * sides) + 1;
        results.push(r);
        total += r;
      }
      const isCrit = sides === 20 && results[0] === 20;
      const isFumble = sides === 20 && results[0] === 1;
      const entry: DiceRoll = {
        dice: `${count}к${sides}`,
        result: results[0],
        total,
        timestamp: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        critical: isCrit || isFumble,
      };
      setRolls((prev) => [entry, ...prev.slice(0, 19)]);
      setRolling(false);
    }, 300);
  };

  const diceSymbols: Record<number, string> = { 4: "◆", 6: "⬡", 8: "◈", 10: "◉", 12: "⬟", 20: "⬠", 100: "◎" };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex gap-6 mb-5">
          <div>
            <label className="text-xs text-parchment-muted mb-2 block">Количество костей</label>
            <div className="flex items-center gap-3">
              <button className="btn-icon" onClick={() => setCount(Math.max(1, count - 1))}>−</button>
              <span className="text-gold font-display text-2xl w-8 text-center">{count}</span>
              <button className="btn-icon" onClick={() => setCount(Math.min(10, count + 1))}>+</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-parchment-muted mb-2 block">Модификатор</label>
            <div className="flex items-center gap-3">
              <button className="btn-icon" onClick={() => setModifier(modifier - 1)}>−</button>
              <span className="text-gold font-display text-2xl w-12 text-center">
                {modifier >= 0 ? `+${modifier}` : modifier}
              </span>
              <button className="btn-icon" onClick={() => setModifier(modifier + 1)}>+</button>
            </div>
          </div>
        </div>
        <div className="dice-grid">
          {DICE_TYPES.map((d) => (
            <button
              key={d}
              onClick={() => rollDice(d)}
              disabled={rolling}
              className={`dice-btn ${rolling ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="dice-icon">{diceSymbols[d]}</span>
              <span className="dice-label">к{d}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="section-title">История бросков</h3>
        <div className="space-y-2 overflow-y-auto scroll-fantasy" style={{ maxHeight: "280px" }}>
          {rolls.length === 0 && (
            <p className="text-parchment-muted text-sm text-center py-8 italic">Бросьте кости, авантюрист...</p>
          )}
          {rolls.map((r, i) => (
            <div key={i} className={`roll-entry ${r.critical ? "roll-critical" : ""}`}>
              <span className="roll-dice">{r.dice}</span>
              <div className="flex-1 flex items-center gap-2">
                <span className="roll-result">{r.total}</span>
                {r.result === 20 && <span className="text-gold text-xs animate-pulse">✦ КРИТИЧЕСКИЙ УДАР</span>}
                {r.result === 1 && <span className="text-crimson text-xs animate-pulse">✦ ПРОВАЛ</span>}
              </div>
              <span className="text-xs text-parchment-muted">{r.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WorldTab() {
  const [worldSection, setWorldSection] = useState<"lore" | "events" | "npcs">("lore");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[
          { id: "lore", label: "📖 Библия мира" },
          { id: "events", label: "📜 События" },
          { id: "npcs", label: "👥 NPC" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setWorldSection(s.id as "lore" | "events" | "npcs")}
            className={`sub-tab ${worldSection === s.id ? "sub-tab-active" : ""}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {worldSection === "lore" && (
        <div className="overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 310px)" }}>
          <h3 className="font-display text-lg text-gold mb-3">Фаэрун — Забытые Королевства</h3>
          <div className="space-y-3 text-sm text-parchment-muted leading-relaxed">
            <p>Фаэрун — обширный континент на планете Торил, мир меча и магии, где боги ходят по земле, а судьбы героев вершатся в темницах под руинами древних империй.</p>
            <h4 className="text-parchment font-semibold mt-4 text-base">Вотердип</h4>
            <p>Город Великолепия — крупнейший и самый влиятельный торговый порт Северного Фаэруна. Управляется Открытой Лордой Лэрал Силвермейн и тайным советом Замаскированных Лордов.</p>
            <h4 className="text-parchment font-semibold mt-4 text-base">Тайные фракции</h4>
            <p>Среди теней города действуют Арфисты, Приказ Перчатки, Изумрудный Анклав, Лорды Альянса и Знак Жнеца — каждая со своими целями и методами.</p>
            <h4 className="text-parchment font-semibold mt-4 text-base">Текущая угроза</h4>
            <p>Таинственные «Серые плащи» похищают торговцев в порту. Городская стража бездействует. Кто за этим стоит — неизвестно.</p>
          </div>
        </div>
      )}

      {worldSection === "events" && (
        <div className="space-y-3 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 310px)" }}>
          {WORLD_EVENTS.map((e, i) => (
            <div key={i} className="event-item">
              <div className="event-date">{e.date}</div>
              <div className="event-title">{e.title}</div>
              <div className="event-desc">{e.desc}</div>
            </div>
          ))}
        </div>
      )}

      {worldSection === "npcs" && (
        <div className="space-y-3 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 310px)" }}>
          {NPCS.map((npc, i) => (
            <div key={i} className="npc-item">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-parchment font-semibold">{npc.name}</div>
                  <div className="text-parchment-muted text-xs">{npc.race} · {npc.role}</div>
                </div>
                <span className={`attitude-badge attitude-${npc.attitude}`}>
                  {npc.attitude === "friendly" ? "Дружелюбен" : npc.attitude === "hostile" ? "Враждебен" : "Нейтрален"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [temperature, setTemperature] = useState(0.8);
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div>
        <h3 className="section-title">LLM Провайдер</h3>
        <div className="grid grid-cols-3 gap-2">
          {["openai", "anthropic", "local"].map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`provider-btn ${provider === p ? "provider-btn-active" : ""}`}
            >
              {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Local"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="section-title">Модель</h3>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="fantasy-select w-full">
          {provider === "openai" && <>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
          </>}
          {provider === "anthropic" && <>
            <option value="claude-opus-4">Claude Opus 4</option>
            <option value="claude-sonnet-4">Claude Sonnet 4</option>
            <option value="claude-haiku-3">Claude Haiku 3.5</option>
          </>}
          {provider === "local" && <>
            <option value="ollama-llama">Llama 3 (Ollama)</option>
            <option value="lm-studio">LM Studio</option>
          </>}
        </select>
      </div>

      <div>
        <h3 className="section-title">API Ключ</h3>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="fantasy-input w-full"
        />
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <h3 className="section-title mb-0">Температура</h3>
          <span className="text-gold font-bold">{temperature}</span>
        </div>
        <input
          type="range" min={0} max={2} step={0.1}
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="fantasy-range w-full"
        />
        <div className="flex justify-between text-xs text-parchment-muted mt-1">
          <span>Точный</span>
          <span>Творческий</span>
        </div>
      </div>

      <div>
        <h3 className="section-title">Параметры игры</h3>
        <div className="space-y-2">
          {[
            { label: "Система правил", value: "D&D 5e" },
            { label: "Сложность", value: "Обычная" },
            { label: "Язык нарратива", value: "Русский" },
            { label: "Стиль мастера", value: "Эпический" },
          ].map((r) => (
            <div key={r.label} className="setting-row">
              <span className="text-parchment-muted text-sm">{r.label}</span>
              <span className="text-parchment text-sm font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary w-full flex items-center justify-center gap-2">
        <Icon name="Save" size={16} />
        Сохранить настройки
      </button>
    </div>
  );
}

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  const renderContent = () => {
    switch (activeTab) {
      case "chat": return <ChatTab />;
      case "character": return <CharacterTab />;
      case "inventory": return <InventoryTab />;
      case "dice": return <DiceTab />;
      case "world": return <WorldTab />;
      case "settings": return <SettingsTab />;
    }
  };

  return (
    <div className="app-root">
      <div className="bg-texture" />
      <div className="ornament-top" />
      <div className="ornament-bottom" />

      <div className="app-container">
        <header className="app-header">
          <div className="relative z-10 flex items-center justify-between px-6 py-3">
            <div className="header-runes">ᚠᚢᚦᚨᚱᚲᚷᚹ</div>
            <div className="text-center">
              <h1 className="app-title">Хроники Подземья</h1>
              <p className="app-subtitle">AI Мастер Подземелий · D&D 5e</p>
            </div>
            <div className="header-runes">ᚺᚾᛁᛃᛇᛈᛉᛊ</div>
          </div>
          <div className="header-divider" />
        </header>

        <main className="app-main">
          <nav className="app-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-item ${activeTab === tab.id ? "nav-item-active" : ""}`}
              >
                <span className="nav-rune">{tab.rune}</span>
                <Icon name={tab.icon} size={18} fallback="CircleAlert" />
                <span className="nav-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          <div className="app-content">
            <div className="content-inner">
              <h2 className="content-title">
                <span className="content-title-rune">{TABS.find((t) => t.id === activeTab)?.rune}</span>
                {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <div className="content-body">
                {renderContent()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}