import { useState, useRef, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";
import ItemTooltip from "@/components/ItemTooltip";
import SkillTooltip from "@/components/SkillTooltip";
import {
  loadState, saveState, exportState, importState,
  GameState, ChatMessage, InventoryItem,
  attrMod, modStr, getSkillBonus, currencyWeight,
  ALL_SKILLS, ATTR_LABELS,
} from "@/lib/gameStore";

const AI_URL = "https://functions.poehali.dev/aeaa9d24-1eec-4354-8f5a-418a5d1f7c11";

type Tab = "chat" | "character" | "inventory" | "dice" | "world" | "settings";
const TABS: { id: Tab; label: string; icon: string; rune: string }[] = [
  { id: "chat", label: "Мастер", icon: "MessageSquare", rune: "ᚠ" },
  { id: "character", label: "Персонаж", icon: "User", rune: "ᚢ" },
  { id: "inventory", label: "Инвентарь", icon: "Package", rune: "ᚦ" },
  { id: "dice", label: "Кости", icon: "Dices", rune: "ᚨ" },
  { id: "world", label: "Мир", icon: "BookOpen", rune: "ᚱ" },
  { id: "settings", label: "Настройки", icon: "Settings", rune: "ᚲ" },
];
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
type DiceRoll = { dice: string; result: number; total: number; timestamp: string; critical?: boolean };

// ─── Chat Tab ──────────────────────────────────────────────────────
function ChatTab({ state, setState }: { state: GameState; setState: (s: GameState) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.chatHistory, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setError("");

    const playerMsg: ChatMessage = {
      role: "player",
      text,
      time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
    };
    const newHistory = [...state.chatHistory, playerMsg];
    const newState = { ...state, chatHistory: newHistory };
    setState(newState);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.slice(-6),
          character: {
            ...state.character,
            attributes: state.character.attributes,
            skills: Object.fromEntries(
              ALL_SKILLS.map((sk) => [
                sk.name,
                getSkillBonus(state.character, {
                  ...sk,
                  proficient: state.character.skills[sk.name]?.proficient ?? false,
                }),
              ])
            ),
          },
          inventory: state.inventory,
          npcs: state.npcs,
          world: state.world,
          chronicle: state.chronicle.slice(-5),
          plotThreads: state.plotThreads,
          currentLocation: state.currentLocation,
          provider: state.settings.provider,
          model: state.settings.model,
          temperature: state.settings.temperature,
          apiKey: state.settings.apiKey,
        }),
      });

      const raw = await res.json();
      // Платформа может обернуть ответ в { body: ... }
      const data = raw?.body ?? raw;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (!res.ok) throw new Error(parsed.error || "Ошибка сервера");
      if (parsed.error) throw new Error(parsed.error);
      if (!parsed.reply) throw new Error("Пустой ответ от мастера");

      const masterMsg: ChatMessage = {
        role: "master",
        text: parsed.reply,
        time: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
      };
      setState({ ...newState, chatHistory: [...newHistory, masterMsg] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 scroll-fantasy mb-3">
        {state.chatHistory.map((msg, i) => (
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
        {loading && (
          <div className="flex gap-3">
            <div className="chat-avatar chat-avatar-master">🐉</div>
            <div className="chat-bubble chat-bubble-master">
              <div className="typing-dots"><span/><span/><span/></div>
            </div>
          </div>
        )}
        {error && (
          <div className="error-banner">⚠ {error}</div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="mt-auto flex-shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Опишите действие персонажа... (Enter — отправить)"
          className="fantasy-input w-full resize-none"
          rows={2}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn-primary mt-2 w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Icon name="Send" size={16} />
          {loading ? "Мастер думает..." : "Действовать"}
        </button>
      </div>
    </div>
  );
}

// ─── Character Tab ─────────────────────────────────────────────────
function CharacterTab({ state }: { state: GameState }) {
  const ch = state.character;
  const attrs = ch.attributes;

  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      {/* Шапка */}
      <div className="character-header">
        <div className="character-portrait"><span className="text-5xl">🧙</span></div>
        <div className="character-info flex-1">
          <h2 className="font-display text-2xl text-gold leading-tight">{ch.name}</h2>
          <p className="text-parchment-muted text-sm">{ch.race} · {ch.cls} · {ch.level} уровень</p>
          <p className="text-parchment-muted text-sm">{ch.background} · {ch.alignment}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <div className="hp-block">
              <span className="text-xs text-parchment-muted">ХП</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-crimson">{ch.hp.current}</span>
                <span className="text-parchment-muted text-sm">/ {ch.hp.max}</span>
              </div>
              <div className="hp-bar"><div className="hp-fill" style={{ width: `${(ch.hp.current / ch.hp.max) * 100}%` }} /></div>
            </div>
            {[
              { label: "КД", val: ch.ac, color: "text-gold" },
              { label: "Иниц.", val: ch.initiative >= 0 ? `+${ch.initiative}` : ch.initiative, color: "text-silver" },
              { label: "Скор.", val: `${ch.speed} фт`, color: "text-silver" },
              { label: "Проф.", val: `+${ch.profBonus}`, color: "text-emerald" },
            ].map(b => (
              <div key={b.label} className="hp-block">
                <span className="text-xs text-parchment-muted">{b.label}</span>
                <span className={`text-xl font-bold ${b.color}`}>{b.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Характеристики */}
      <div>
        <h3 className="section-title">Характеристики</h3>
        <div className="grid grid-cols-6 gap-2">
          {(Object.keys(attrs) as (keyof typeof attrs)[]).map((key) => (
            <div key={key} className="stat-block">
              <div className="stat-value">{attrs[key]}</div>
              <div className="stat-name">{ATTR_LABELS[key].slice(0, 3).toUpperCase()}</div>
              <div className="stat-mod">{modStr(attrs[key])}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Навыки с тултипом */}
        <div>
          <h3 className="section-title">Навыки (нажми для броска)</h3>
          <div className="space-y-0.5">
            {ALL_SKILLS.map((sk) => {
              const profData = ch.skills[sk.name];
              const isProficient = profData?.proficient ?? false;
              const isExpertise = profData?.expertise ?? false;
              const skWithProf = { ...sk, proficient: isProficient, expertise: isExpertise };
              const bonus = getSkillBonus(ch, skWithProf);
              return (
                <SkillTooltip key={sk.name} skill={skWithProf} character={ch}>
                  <div className="skill-row cursor-pointer hover:bg-white/5 px-1 rounded transition-colors">
                    <span className={`skill-dot ${isExpertise ? "skill-dot-expertise" : isProficient ? "skill-dot-prof" : ""}`} />
                    <span className="skill-name">{sk.name}</span>
                    <span className="skill-attr-tag">{sk.attrLabel.slice(0, 3)}</span>
                    <span className="skill-bonus">{bonus >= 0 ? `+${bonus}` : bonus}</span>
                  </div>
                </SkillTooltip>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {/* Спасброски */}
          <div>
            <h3 className="section-title">Спасброски</h3>
            <div className="space-y-1">
              {(Object.keys(attrs) as (keyof typeof attrs)[]).map((key) => {
                const isProfSave = key === "str" || key === "con";
                const base = attrMod(attrs[key]);
                const val = isProfSave ? base + ch.profBonus : base;
                return (
                  <div key={key} className="skill-row">
                    <span className={`skill-dot ${isProfSave ? "skill-dot-prof" : ""}`} />
                    <span className="skill-name">{ATTR_LABELS[key]}</span>
                    <span className="skill-bonus">{val >= 0 ? `+${val}` : val}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* XP */}
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

          {/* Черты */}
          <div>
            <h3 className="section-title">Классовые черты</h3>
            <div className="space-y-1 text-sm">
              {ch.classFeatures.map((f) => (
                <div key={f} className="trait-item">{f}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inventory Tab ─────────────────────────────────────────────────
function InventoryTab({ state, setState }: { state: GameState; setState: (s: GameState) => void }) {
  const { items, currency } = state.inventory;
  const itemWeight = items.reduce((s, i) => s + i.weight * i.qty, 0);
  const coinWeight = currencyWeight(currency);
  const totalWeight = itemWeight + coinWeight;
  const maxWeight = state.character.attributes.str * 15;

  const typeEmoji: Record<string, string> = {
    weapon: "⚔️", armor: "🛡️", potion: "🧪", gear: "🎒", food: "🍖", magic: "✨", tool: "🔧",
  };
  const typeColor: Record<string, string> = {
    weapon: "text-crimson", armor: "text-silver", potion: "text-emerald",
    gear: "text-parchment-muted", food: "text-amber-400", magic: "text-violet-300", tool: "text-parchment-muted",
  };

  function handleEquip(id: string) {
    const newItems = items.map((item) =>
      item.id === id ? { ...item, equipped: !item.equipped } : item
    );
    setState({ ...state, inventory: { ...state.inventory, items: newItems } });
  }

  function handleDrop(id: string) {
    setState({ ...state, inventory: { ...state.inventory, items: items.filter((i) => i.id !== id) } });
  }

  function handleUse(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newItems = item.qty > 1
      ? items.map((i) => i.id === id ? { ...i, qty: i.qty - 1 } : i)
      : items.filter((i) => i.id !== id);
    // Зелье лечения: прибавляем HP
    if (item.type === "potion" && item.name.includes("лечения")) {
      const heal = Math.floor(Math.random() * 4) + 1 + Math.floor(Math.random() * 4) + 1 + 2;
      const newHp = Math.min(state.character.hp.current + heal, state.character.hp.max);
      setState({
        ...state,
        character: { ...state.character, hp: { ...state.character.hp, current: newHp } },
        inventory: { ...state.inventory, items: newItems },
      });
    } else {
      setState({ ...state, inventory: { ...state.inventory, items: newItems } });
    }
  }

  const coinColors: Record<string, string> = {
    cp: "text-amber-600", sp: "text-silver", ep: "text-teal-300", gp: "text-gold", pp: "text-slate-300",
  };
  const coinLabels = { cp: "Медь (мм)", sp: "Серебро (см)", ep: "Электрум (эм)", gp: "Золото (зм)", pp: "Платина (пм)" };

  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      {/* Валюта */}
      <div>
        <h3 className="section-title mb-3">Кошелёк</h3>
        <div className="grid grid-cols-5 gap-2">
          {(Object.keys(currency) as (keyof typeof currency)[]).map((k) => (
            <div key={k} className="coin-block">
              <span className={`text-xl font-bold ${coinColors[k]}`}>{currency[k]}</span>
              <span className={`text-xs font-semibold ${coinColors[k]}`}>{k.toUpperCase()}</span>
              <span className="text-xs text-parchment-muted leading-tight text-center">{coinLabels[k]}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-parchment-muted mt-2">Вес монет: {coinWeight} фунт.</p>
      </div>

      {/* Вес */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <h3 className="section-title mb-0">Снаряжение</h3>
          <span className="text-xs text-parchment-muted">{totalWeight.toFixed(1)} / {maxWeight} фунтов</span>
        </div>
        <div className="weight-bar mb-3">
          <div className="weight-fill" style={{ width: `${Math.min((totalWeight / maxWeight) * 100, 100)}%` }} />
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <ItemTooltip key={item.id} item={item} onEquip={handleEquip} onUse={handleUse} onDrop={handleDrop}>
              <div className={`inventory-item cursor-pointer ${item.equipped ? "inventory-item-equipped" : ""}`}>
                <div className="flex justify-between items-start">
                  <div className={`text-sm font-semibold ${typeColor[item.type]}`}>
                    {typeEmoji[item.type]} {item.name}
                    {item.qty > 1 && <span className="text-parchment-muted ml-1">×{item.qty}</span>}
                  </div>
                  {item.equipped && <span className="text-xs text-gold opacity-75">✦ Экипирован</span>}
                </div>
                <div className="flex gap-3 text-xs text-parchment-muted mt-0.5">
                  <span>{item.mechanics || item.desc}</span>
                  <span>·</span>
                  <span>{item.weight} фунт.</span>
                  <span>·</span>
                  <span className="text-gold">{item.value}</span>
                </div>
              </div>
            </ItemTooltip>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Dice Tab ──────────────────────────────────────────────────────
type AdvMode = "advantage" | "normal" | "disadvantage";

interface ExtDiceRoll extends DiceRoll {
  rolls2?: number[];
  advMode?: AdvMode;
  formula?: string;
}

function DiceTab() {
  const [rolls, setRolls] = useState<ExtDiceRoll[]>([]);
  const [count, setCount] = useState(1);
  const [modifier, setModifier] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [advMode, setAdvMode] = useState<AdvMode>("normal");
  const [activeSide, setActiveSide] = useState<number | null>(null);

  const diceSymbols: Record<number, string> = { 4: "◆", 6: "⬡", 8: "◈", 10: "◉", 12: "⬟", 20: "⬠", 100: "◎" };

  const rollDice = (sides: number) => {
    setRolling(true);
    setActiveSide(sides);
    setTimeout(() => {
      const isD20 = sides === 20;
      const useAdv = isD20 && advMode !== "normal";

      let chosenRoll: number;
      let allRolls: number[];
      let formula: string;

      if (useAdv) {
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = Math.floor(Math.random() * 20) + 1;
        allRolls = [r1, r2];
        chosenRoll = advMode === "advantage" ? Math.max(r1, r2) : Math.min(r1, r2);
        const modStr2 = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";
        formula = `[${r1}, ${r2}] → ${chosenRoll}${modStr2} = ${chosenRoll + modifier}`;
      } else {
        allRolls = [];
        let sum = 0;
        for (let i = 0; i < count; i++) {
          const r = Math.floor(Math.random() * sides) + 1;
          allRolls.push(r);
          sum += r;
        }
        chosenRoll = allRolls[0];
        const modStr2 = modifier !== 0 ? ` ${modifier >= 0 ? "+" : ""}${modifier}` : "";
        formula = count > 1
          ? `[${allRolls.join(", ")}] = ${sum}${modStr2} = ${sum + modifier}`
          : `${chosenRoll}${modStr2} = ${chosenRoll + modifier}`;
      }

      const total = chosenRoll + modifier;
      const isCrit = isD20 && chosenRoll === 20;
      const isFumble = isD20 && chosenRoll === 1;

      const label = useAdv
        ? advMode === "advantage" ? "🟢 Преимущество" : "🔴 Помеха"
        : `${count}к${sides}`;

      setRolls((prev) => [{
        dice: label,
        result: chosenRoll,
        total,
        timestamp: new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" }),
        critical: isCrit || isFumble,
        rolls2: useAdv ? allRolls : allRolls.length > 1 ? allRolls : undefined,
        advMode: isD20 ? advMode : "normal",
        formula,
      }, ...prev.slice(0, 19)]);
      setRolling(false);
    }, 250);
  };

  const advOptions: { id: AdvMode; label: string; cls: string }[] = [
    { id: "advantage", label: "🟢 Преимущество", cls: "adv-btn-advantage" },
    { id: "normal", label: "⚪ Нормальный", cls: "adv-btn-normal" },
    { id: "disadvantage", label: "🔴 Помеха", cls: "adv-btn-disadvantage" },
  ];

  return (
    <div className="space-y-4">
      {/* Переключатель преимущество/помеха */}
      <div>
        <label className="text-xs text-parchment-muted mb-2 block">Режим броска к20</label>
        <div className={`adv-switcher ${advMode === "advantage" ? "adv-switcher-adv" : advMode === "disadvantage" ? "adv-switcher-dis" : ""}`}>
          {advOptions.map((o) => (
            <button key={o.id}
              onClick={() => setAdvMode(o.id)}
              className={`adv-btn ${o.cls} ${advMode === o.id ? "adv-btn-active" : ""}`}>
              {o.label}
            </button>
          ))}
        </div>
        {advMode !== "normal" && (
          <p className="text-xs text-parchment-muted mt-1 italic">
            {advMode === "advantage"
              ? "Бросается 2к20, берётся большее значение"
              : "Бросается 2к20, берётся меньшее значение"}
          </p>
        )}
      </div>

      {/* Контролы */}
      <div className="flex gap-6">
        <div>
          <label className="text-xs text-parchment-muted mb-2 block">Количество</label>
          <div className="flex items-center gap-3">
            <button className="btn-icon"
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={advMode !== "normal"}>−</button>
            <span className="text-gold font-display text-2xl w-8 text-center">
              {advMode !== "normal" ? 2 : count}
            </span>
            <button className="btn-icon"
              onClick={() => setCount(Math.min(10, count + 1))}
              disabled={advMode !== "normal"}>+</button>
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

      {/* Кости */}
      <div className="dice-grid">
        {DICE_TYPES.map((d) => (
          <button key={d} onClick={() => rollDice(d)} disabled={rolling}
            className={`dice-btn ${rolling && activeSide === d ? "dice-btn-rolling" : ""} ${rolling ? "opacity-50 cursor-not-allowed" : ""} ${advMode !== "normal" && d !== 20 ? "opacity-40" : ""}`}>
            <span className="dice-icon">{diceSymbols[d]}</span>
            <span className="dice-label">к{d}</span>
          </button>
        ))}
      </div>

      {/* История */}
      <div>
        <h3 className="section-title">История бросков</h3>
        <div className="space-y-2 overflow-y-auto scroll-fantasy" style={{ maxHeight: "240px" }}>
          {rolls.length === 0 && (
            <p className="text-parchment-muted text-sm text-center py-8 italic">Бросьте кости, авантюрист...</p>
          )}
          {rolls.map((r, i) => (
            <div key={i} className={`roll-entry ${r.critical ? "roll-critical" : ""} ${r.advMode === "advantage" ? "roll-adv" : r.advMode === "disadvantage" ? "roll-dis" : ""}`}>
              <span className="roll-dice">{r.dice}</span>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="roll-result">{r.total}</span>
                  {r.result === 20 && r.advMode !== "disadvantage" && <span className="text-gold text-xs animate-pulse">✦ НАТ. 20!</span>}
                  {r.result === 1 && r.advMode !== "advantage" && <span className="text-crimson text-xs animate-pulse">✦ ПРОВАЛ</span>}
                </div>
                {r.formula && <span className="text-xs text-parchment-muted">{r.formula}</span>}
              </div>
              <span className="text-xs text-parchment-muted">{r.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── World Tab ─────────────────────────────────────────────────────
function WorldTab({ state }: { state: GameState }) {
  const [section, setSection] = useState<"lore" | "events" | "npcs" | "plots">("lore");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "lore", label: "📖 Мир" },
          { id: "events", label: "📜 Хроника" },
          { id: "npcs", label: "👥 NPC" },
          { id: "plots", label: "🗺️ Сюжет" },
        ].map((s) => (
          <button key={s.id}
            onClick={() => setSection(s.id as typeof section)}
            className={`sub-tab ${section === s.id ? "sub-tab-active" : ""}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 310px)" }}>
        {section === "lore" && (
          <div className="space-y-3 text-sm text-parchment-muted leading-relaxed">
            <h3 className="font-display text-lg text-gold">{state.world.name} — {state.world.era}</h3>
            <p>{state.world.description}</p>
            <p className="text-xs">Уровень магии: <span className="text-gold">{state.world.magicLevel}</span></p>
            {state.world.factions.length > 0 && (
              <>
                <h4 className="text-parchment font-semibold">Фракции</h4>
                {state.world.factions.map((f, i) => (
                  <div key={i} className="event-item">
                    <div className="event-title">{f.name}</div>
                    <div className="event-desc">{f.goal}</div>
                    <div className={`text-xs mt-1 ${f.relation > 0 ? "text-emerald" : f.relation < 0 ? "text-crimson" : "text-gold"}`}>
                      Отношение: {f.relation > 0 ? `+${f.relation}` : f.relation}
                    </div>
                  </div>
                ))}
              </>
            )}
            {state.world.locations.length > 0 && (
              <>
                <h4 className="text-parchment font-semibold mt-2">Известные места</h4>
                {state.world.locations.map((l, i) => (
                  <div key={i} className="event-item">
                    <div className="event-title">{l.name} <span className="text-xs text-parchment-muted">({l.type})</span></div>
                    <div className="event-desc">{l.description}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {section === "events" && (
          <div className="space-y-3">
            {state.chronicle.length === 0 && <p className="text-parchment-muted text-sm italic text-center py-8">Хроника пуста...</p>}
            {state.chronicle.map((e) => (
              <div key={e.id} className="event-item">
                <div className="event-date">{e.date}</div>
                <div className="event-title">{e.title}</div>
                <div className="event-desc">{e.description}</div>
                {e.location && <div className="text-xs text-parchment-muted mt-1">📍 {e.location}</div>}
                {e.flags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {e.flags.map((f) => <span key={f} className="attitude-badge attitude-neutral text-xs">{f}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {section === "npcs" && (
          <div className="space-y-3">
            {state.npcs.map((npc) => (
              <div key={npc.id} className="npc-item">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-parchment font-semibold">{npc.name}</div>
                    <div className="text-parchment-muted text-xs">{npc.race} · {npc.role}</div>
                    {npc.location && <div className="text-xs text-parchment-muted mt-0.5">📍 {npc.location}</div>}
                    {npc.traits.length > 0 && (
                      <div className="text-xs text-parchment-muted mt-1">{npc.traits.join(", ")}</div>
                    )}
                  </div>
                  <span className={`attitude-badge ${npc.relation > 3 ? "attitude-friendly" : npc.relation < -3 ? "attitude-hostile" : "attitude-neutral"}`}>
                    {npc.relation > 3 ? "Дружелюбен" : npc.relation < -3 ? "Враждебен" : "Нейтрален"} ({npc.relation > 0 ? "+" : ""}{npc.relation})
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === "plots" && (
          <div className="space-y-3">
            {state.plotThreads.map((p) => (
              <div key={p.id} className={`event-item ${p.status === "completed" ? "opacity-50" : ""}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="event-title">{p.name}</div>
                  <span className={`attitude-badge ${p.status === "active" ? "attitude-friendly" : p.status === "paused" ? "attitude-neutral" : "attitude-hostile"}`}>
                    {p.status === "active" ? "Активна" : p.status === "paused" ? "Пауза" : "Завершена"}
                  </span>
                </div>
                <div className="event-desc">{p.description}</div>
                {p.timer && <div className="text-xs text-crimson mt-1">⏰ {p.timer}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings Tab ──────────────────────────────────────────────────
function SettingsTab({ state, setState }: { state: GameState; setState: (s: GameState) => void }) {
  const s = state.settings;
  const update = (patch: Partial<typeof s>) => setState({ ...state, settings: { ...s, ...patch } });
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5 overflow-y-auto scroll-fantasy" style={{ maxHeight: "calc(100vh - 220px)" }}>
      <div>
        <h3 className="section-title">Провайдер</h3>
        <div className="grid grid-cols-2 gap-2">
          {(["google", "openrouter", "openai", "anthropic"] as const).map((p) => (
            <button key={p}
              onClick={() => update({ provider: p })}
              className={`provider-btn ${s.provider === p ? "provider-btn-active" : ""}`}>
              {p === "google" ? "🟢 Google AI" : p === "openrouter" ? "OpenRouter" : p === "openai" ? "OpenAI" : "Anthropic"}
            </button>
          ))}
        </div>
        {s.provider === "google" && (
          <p className="text-xs text-emerald-400/80 mt-2">✦ Бесплатно, стабильно. Получи ключ на <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a></p>
        )}
        {s.provider === "openrouter" && (
          <p className="text-xs text-parchment-muted mt-2">✦ Поддерживает все модели, но бесплатные нестабильны</p>
        )}
      </div>

      <div>
        <h3 className="section-title">API Ключ</h3>
        <input
          type="password"
          value={s.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder={s.provider === "google" ? "AIza..." : s.provider === "openrouter" ? "sk-or-v1-..." : "sk-..."}
          className="fantasy-input w-full font-mono text-sm"
        />
        {s.provider === "google" && !s.apiKey && (
          <p className="text-xs text-amber-400/80 mt-1">⚠ Без ключа — нестабильные бесплатные модели через OpenRouter</p>
        )}
        {s.apiKey && (
          <p className="text-xs text-emerald-400/80 mt-1">✦ Ключ сохранён в браузере</p>
        )}
      </div>

      <div>
        <h3 className="section-title">Модель</h3>
        {s.provider === "google" ? (
          <select value={s.model} onChange={(e) => update({ model: e.target.value })} className="fantasy-select w-full">
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (рекомендуется)</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
        ) : (
          <select value={s.model} onChange={(e) => update({ model: e.target.value })} className="fantasy-select w-full">
            <optgroup label="── Бесплатные (OpenRouter) ──">
              <option value="gemini-flash">Gemini 1.5 Flash (бесплатно)</option>
              <option value="llama-free">Llama 3.3 70B (бесплатно)</option>
              <option value="deepseek-free">DeepSeek R1 (бесплатно)</option>
            </optgroup>
            <optgroup label="── Платные ──">
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              <option value="claude-sonnet-4">Claude Sonnet 4.5</option>
              <option value="claude-haiku-3">Claude Haiku 3.5</option>
            </optgroup>
          </select>
        )}
      </div>

      <div>
        <div className="flex justify-between mb-1">
          <h3 className="section-title mb-0">Температура</h3>
          <span className="text-gold font-bold">{s.temperature}</span>
        </div>
        <input type="range" min={0} max={2} step={0.1}
          value={s.temperature}
          onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
          className="fantasy-range w-full" />
        <div className="flex justify-between text-xs text-parchment-muted mt-1">
          <span>Точный</span><span>Творческий</span>
        </div>
      </div>

      <div>
        <h3 className="section-title">Параметры игры</h3>
        {[
          { label: "Система правил", value: "D&D 5e" },
          { label: "Сложность", value: s.difficulty },
          { label: "Язык", value: s.language },
          { label: "Стиль мастера", value: s.narrativeStyle },
        ].map((r) => (
          <div key={r.label} className="setting-row">
            <span className="text-parchment-muted text-sm">{r.label}</span>
            <span className="text-parchment text-sm font-medium">{r.value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h3 className="section-title">Кампания</h3>
        <button onClick={() => exportState(state)} className="btn-primary w-full flex items-center justify-center gap-2">
          <Icon name="Download" size={16} /> Экспортировать кампанию
        </button>
        <button onClick={() => fileRef.current?.click()} className="provider-btn w-full flex items-center justify-center gap-2 py-2">
          <Icon name="Upload" size={16} /> Импортировать кампанию
        </button>
        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) { const s = await importState(file); setState(s); }
          }} />
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────
export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [state, setStateRaw] = useState<GameState>(loadState);

  const setState = useCallback((newState: GameState) => {
    setStateRaw(newState);
    saveState(newState);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case "chat": return <ChatTab state={state} setState={setState} />;
      case "character": return <CharacterTab state={state} />;
      case "inventory": return <InventoryTab state={state} setState={setState} />;
      case "dice": return <DiceTab />;
      case "world": return <WorldTab state={state} />;
      case "settings": return <SettingsTab state={state} setState={setState} />;
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
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`nav-item ${activeTab === tab.id ? "nav-item-active" : ""}`}>
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