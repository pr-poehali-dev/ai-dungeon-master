import { useState, useRef, useEffect } from "react";
import { SkillData, CharacterState, getSkillBonus, attrMod } from "@/lib/gameStore";

const SKILL_DESCRIPTIONS: Record<string, string> = {
  "Акробатика": "Трюки, удержание равновесия, кувырки, движение в сложных условиях.",
  "Атлетика": "Лазание, прыжки, плавание, борьба и другие физические усилия.",
  "Аркана": "Знание заклинаний, магических предметов, плоскостей и мистических теорий.",
  "Восприятие": "Замечать детали окружения с помощью органов чувств.",
  "Выживание": "Выслеживание, добыча пищи, навигация в дикой местности.",
  "Запугивание": "Влияние через угрозы, враждебность или физическое превосходство.",
  "История": "Знание исторических событий, легенд, войн, культур и цивилизаций.",
  "Магия": "Знание магических традиций, заклинаний и сверхъестественных существ.",
  "Медицина": "Стабилизация умирающих, диагностика болезней, оказание первой помощи.",
  "Обман": "Введение в заблуждение, ложь, маскировка и жульничество.",
  "Природа": "Знание о растениях, животных, погоде и природных явлениях.",
  "Проницательность": "Чувствовать истинные намерения существ: ложь, настроение, мотивы.",
  "Религия": "Знание о богах, ритуалах, священных символах и теологии.",
  "Скрытность": "Двигаться бесшумно, скрываться от противников.",
  "Убеждение": "Влиять на других через вежливость, логику или харизму.",
  "Уход за животными": "Успокоить животное, не допустить нападения, приручить.",
};

interface Props {
  skill: SkillData;
  character: CharacterState;
  onRoll?: (skillName: string, bonus: number) => void;
  children: React.ReactNode;
}

export default function SkillTooltip({ skill, character, onRoll, children }: Props) {
  const [open, setOpen] = useState(false);
  const [rollState, setRollState] = useState<{ advantage: -1 | 0 | 1; situational: number }>({ advantage: 0, situational: 0 });
  const [lastRoll, setLastRoll] = useState<{ d20: number; total: number; label: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const profData = character.skills[skill.name];
  const isProficient = profData?.proficient ?? false;
  const isExpertise = profData?.expertise ?? false;
  const bonus = getSkillBonus(character, { ...skill, proficient: isProficient });
  const attrVal = character.attributes[skill.attr];
  const attrModVal = attrMod(attrVal);
  const isPerception = skill.name === "Восприятие";
  const passive = 10 + bonus;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setLastRoll(null);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function rollCheck() {
    const roll1 = Math.floor(Math.random() * 20) + 1;
    let d20 = roll1;
    let label = "";
    if (rollState.advantage !== 0) {
      const roll2 = Math.floor(Math.random() * 20) + 1;
      if (rollState.advantage === 1) {
        d20 = Math.max(roll1, roll2);
        label = `Преимущество (${roll1}, ${roll2})`;
      } else {
        d20 = Math.min(roll1, roll2);
        label = `Помеха (${roll1}, ${roll2})`;
      }
    } else {
      label = `к20: ${roll1}`;
    }
    const total = d20 + bonus + rollState.situational;
    setLastRoll({ d20, total, label });
    onRoll?.(skill.name, total);
  }

  return (
    <div ref={ref} className="relative inline-flex items-center w-full" onClick={() => setOpen(!open)}>
      {children}
      {open && (
        <div className="skill-card" onClick={(e) => e.stopPropagation()}>
          {/* Заголовок */}
          <div className="skill-card-header">
            <h4 className="skill-card-name">{skill.name}</h4>
            <span className="skill-card-attr">{skill.attrLabel}</span>
          </div>

          {/* Значения */}
          <div className="skill-card-stats">
            <div className="skill-stat-block">
              <span className="skill-stat-label">Модификатор</span>
              <span className={`skill-stat-value ${bonus >= 0 ? "text-gold" : "text-crimson"}`}>
                {bonus >= 0 ? `+${bonus}` : bonus}
              </span>
            </div>
            <div className="skill-stat-block">
              <span className="skill-stat-label">Хар-ка ({skill.attrLabel.slice(0, 3)})</span>
              <span className="skill-stat-value text-silver">
                {attrVal} ({attrModVal >= 0 ? `+${attrModVal}` : attrModVal})
              </span>
            </div>
            <div className="skill-stat-block">
              <span className="skill-stat-label">Мастерство</span>
              <span className={`skill-stat-value ${isExpertise ? "text-gold" : isProficient ? "text-emerald" : "text-parchment-muted"}`}>
                {isExpertise ? `✦ ×2 (+${character.profBonus * 2})` : isProficient ? `✓ +${character.profBonus}` : "✗ —"}
              </span>
            </div>
            {isPerception && (
              <div className="skill-stat-block">
                <span className="skill-stat-label">Пассивное</span>
                <span className="skill-stat-value text-parchment">{passive}</span>
              </div>
            )}
          </div>

          {/* Описание */}
          <p className="skill-card-desc">{SKILL_DESCRIPTIONS[skill.name] || "Описание отсутствует."}</p>

          {/* Бросок */}
          <div className="skill-roll-section">
            <div className="skill-roll-header">Бросок проверки</div>
            <div className="flex gap-2 mb-2">
              {([[-1, "Помеха"], [0, "Обычный"], [1, "Преимущ."]] as const).map(([v, label]) => (
                <button key={v}
                  onClick={() => setRollState(s => ({ ...s, advantage: v }))}
                  className={`skill-adv-btn ${rollState.advantage === v ? "skill-adv-btn-active" : ""}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-parchment-muted">Ситуативный:</span>
              <button className="btn-icon text-xs" style={{ width: 22, height: 22 }}
                onClick={() => setRollState(s => ({ ...s, situational: s.situational - 1 }))}>−</button>
              <span className="text-gold font-bold text-sm w-8 text-center">
                {rollState.situational >= 0 ? `+${rollState.situational}` : rollState.situational}
              </span>
              <button className="btn-icon text-xs" style={{ width: 22, height: 22 }}
                onClick={() => setRollState(s => ({ ...s, situational: s.situational + 1 }))}>+</button>
            </div>
            <button className="skill-roll-btn" onClick={rollCheck}>
              🎲 Бросить к20
            </button>
            {lastRoll && (
              <div className={`skill-roll-result ${lastRoll.d20 === 20 ? "roll-nat20" : lastRoll.d20 === 1 ? "roll-nat1" : ""}`}>
                <span className="roll-total">{lastRoll.total}</span>
                <span className="roll-detail">{lastRoll.label}</span>
                {lastRoll.d20 === 20 && <span className="roll-crit-label">✦ Натуральная 20!</span>}
                {lastRoll.d20 === 1 && <span className="roll-fumble-label">✦ Провал!</span>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
