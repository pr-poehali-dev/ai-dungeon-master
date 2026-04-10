import { useState, useRef, useEffect } from "react";
import { InventoryItem } from "@/lib/gameStore";
import Icon from "@/components/ui/icon";

const RARITY_LABEL: Record<string, string> = {
  common: "Обычный", uncommon: "Необычный", rare: "Редкий",
  very_rare: "Очень редкий", legendary: "Легендарный", artifact: "Артефакт",
};
const RARITY_COLOR: Record<string, string> = {
  common: "#c0c8d4", uncommon: "#2ecc71", rare: "#3498db",
  very_rare: "#9b59b6", legendary: "#e67e22", artifact: "#e74c3c",
};
const TYPE_LABEL: Record<string, string> = {
  weapon: "Оружие", armor: "Броня", potion: "Зелье",
  gear: "Снаряжение", food: "Провизия", magic: "Магический предмет", tool: "Инструмент",
};
const TYPE_ICON: Record<string, string> = {
  weapon: "Sword", armor: "Shield", potion: "FlaskConical",
  gear: "Backpack", food: "Utensils", magic: "Sparkles", tool: "Wrench",
};

interface Props {
  item: InventoryItem;
  onEquip?: (id: string) => void;
  onUse?: (id: string) => void;
  onDrop?: (id: string) => void;
  children: React.ReactNode;
}

export default function ItemTooltip({ item, onEquip, onUse, onDrop, children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rarityColor = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={() => setOpen(!open)}>
      {children}
      {open && (
        <div className="item-card" onClick={(e) => e.stopPropagation()}>
          {/* Декоративная линия цвета редкости */}
          <div className="item-card-rarity-bar" style={{ background: rarityColor }} />

          {/* Заголовок */}
          <div className="item-card-header">
            <div className="item-card-icon">
              <Icon name={TYPE_ICON[item.type] || "Package"} size={20} fallback="Package" />
            </div>
            <div>
              <h4 className="item-card-name">{item.name}</h4>
              <div className="flex gap-2 items-center">
                <span className="item-card-type">{TYPE_LABEL[item.type]}</span>
                <span style={{ color: rarityColor }} className="item-card-rarity">
                  · {RARITY_LABEL[item.rarity]}
                </span>
              </div>
            </div>
            {item.equipped && <span className="item-equipped-badge">⚔️ Экипирован</span>}
          </div>

          {/* Блок 1: Параметры */}
          <div className="item-card-block">
            <div className="item-param-grid">
              <div className="item-param">
                <span className="item-param-label">Вес</span>
                <span className="item-param-value">{item.weight} фунт.</span>
              </div>
              <div className="item-param">
                <span className="item-param-label">Стоимость</span>
                <span className="item-param-value text-gold">{item.value}</span>
              </div>
              {item.qty > 1 && (
                <div className="item-param">
                  <span className="item-param-label">Кол-во</span>
                  <span className="item-param-value">×{item.qty}</span>
                </div>
              )}
              {item.requiresAttunement !== undefined && (
                <div className="item-param">
                  <span className="item-param-label">Аттунмент</span>
                  <span className="item-param-value">{item.requiresAttunement ? "✓ Требуется" : "✗ Нет"}</span>
                </div>
              )}
            </div>
          </div>

          {/* Блок 2: Механика */}
          {(item.damage || item.acBonus || item.effect || item.properties?.length) && (
            <div className="item-card-block">
              <div className="item-card-block-title">Механика</div>
              {item.damage && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">Урон:</span>
                  <span className="text-crimson font-semibold">{item.damage} {item.damageType}</span>
                </div>
              )}
              {item.acBonus && item.type === "armor" && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">КД:</span>
                  <span className="text-silver font-semibold">{item.acBonus > 5 ? item.acBonus : `+${item.acBonus}`}</span>
                </div>
              )}
              {item.acBonus && item.type !== "armor" && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">Бонус КД:</span>
                  <span className="text-silver font-semibold">+{item.acBonus}</span>
                </div>
              )}
              {item.stealthDisadvantage && (
                <div className="item-mechanic-row">
                  <span className="text-crimson text-xs">⚠ Помеха скрытности</span>
                </div>
              )}
              {item.properties?.map((p) => (
                <div key={p} className="item-mechanic-row">
                  <span className="text-gold text-xs">◆ {p}</span>
                </div>
              ))}
              {item.effect && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">Эффект:</span>
                  <span className="text-emerald text-xs">{item.effect}</span>
                </div>
              )}
              {item.duration && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">Длительность:</span>
                  <span className="text-parchment text-xs">{item.duration}</span>
                </div>
              )}
              {item.charges !== undefined && (
                <div className="item-mechanic-row">
                  <span className="text-parchment-muted text-xs">Заряды:</span>
                  <span className="text-violet-300 font-semibold">{item.charges}</span>
                </div>
              )}
            </div>
          )}

          {/* Блок 3: Описание и лор */}
          {(item.desc || item.lore) && (
            <div className="item-card-block">
              {item.desc && <p className="text-parchment-muted text-xs leading-relaxed italic">{item.desc}</p>}
              {item.lore && <p className="text-parchment-muted text-xs leading-relaxed mt-1 opacity-75">{item.lore}</p>}
            </div>
          )}

          {/* Кнопки действий */}
          <div className="item-card-actions">
            {(item.type === "weapon" || item.type === "armor") && (
              <button className={`item-action-btn ${item.equipped ? "item-action-unequip" : "item-action-equip"}`}
                onClick={() => { onEquip?.(item.id); setOpen(false); }}>
                {item.equipped ? "Снять" : "Экипировать"}
              </button>
            )}
            {(item.type === "potion" || item.type === "food") && (
              <button className="item-action-btn item-action-use"
                onClick={() => { onUse?.(item.id); setOpen(false); }}>
                Использовать
              </button>
            )}
            <button className="item-action-btn item-action-drop"
              onClick={() => { onDrop?.(item.id); setOpen(false); }}>
              Выбросить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
