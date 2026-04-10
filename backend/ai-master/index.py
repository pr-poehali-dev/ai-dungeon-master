"""
AI-мастер подземелий для D&D 5e. v3
Принимает полный контекст кампании: персонаж, инвентарь, NPC, хроника, сюжетные линии.
"""
import json
import os
from openai import OpenAI

BASE_SYSTEM = """Ты — опытный Мастер Подземелий (Dungeon Master) для настольной ролевой игры D&D 5e.
Ты ведёшь игру на русском языке в эпическом, атмосферном стиле.

## Правила ведения игры
- Строго следуй правилам D&D 5e (SRD) без модификаций
- Описывай мир живо и детально, создавай напряжение и атмосферу
- Когда требуется бросок — указывай тип (навык/атака/спасбросок), DC и результат
- Учитывай характеристики персонажа при описании действий
- При атаке используй экипированное оружие персонажа
- При проверке навыка — применяй модификатор персонажа автоматически
- При получении урона — вычитай из текущего HP
- При покупке — проверяй достаточность средств
- Веди последовательный нарратив, не противоречь ранее установленным фактам
- Реагируй на NPC согласно их отношению и характеру
- Описания: 2-4 абзаца, ёмко и атмосферно
- Заканчивай ответ открытым вопросом или моментом действия

## Формат ответа
Отвечай только нарративом. Если требуется бросок — укажи в конце:
[Бросок: Навык (Характеристика), DC X]"""


def build_context(body: dict) -> str:
    """Строит полный системный контекст из данных кампании."""
    parts = [BASE_SYSTEM]

    character = body.get("character", {})
    if character:
        attr = character.get("attributes", {})
        skills = character.get("skills", {})

        def mod(v):
            m = (v - 10) // 2
            return f"+{m}" if m >= 0 else str(m)

        skills_str = ", ".join(
            f"{k} {'+' if v >= 0 else ''}{v}"
            for k, v in skills.items()
        ) if skills else "нет данных"

        hp_raw = character.get("hp", {})
        if isinstance(hp_raw, dict):
            hp_current = hp_raw.get("current", "?")
            hp_max = hp_raw.get("max", "?")
            hp_temp = hp_raw.get("temp", 0)
        else:
            hp_current = hp_raw
            hp_max = character.get("maxHp", "?")
            hp_temp = 0
        parts.append(f"""
## Персонаж игрока
- Имя: {character.get('name', '?')} | {character.get('race', '?')} {character.get('cls', '?')} {character.get('level', '?')} ур.
- Предпосылка: {character.get('background', '?')} | Мировоззрение: {character.get('alignment', '?')}
- HP: {hp_current}/{hp_max} (Временные: {hp_temp})
- КД: {character.get('ac', '?')} | Инициатива: +{character.get('initiative', 0)} | Скорость: {character.get('speed', 30)} фт.
- Бонус мастерства: +{character.get('profBonus', 2)} | Кости хитов: {character.get('hitDice', '?')}
- Характеристики: СИЛ {attr.get('str', 10)}({mod(attr.get('str', 10))}), ЛОВ {attr.get('dex', 10)}({mod(attr.get('dex', 10))}), ТЕЛ {attr.get('con', 10)}({mod(attr.get('con', 10))}), ИНТ {attr.get('int', 10)}({mod(attr.get('int', 10))}), МДР {attr.get('wis', 10)}({mod(attr.get('wis', 10))}), ХАР {attr.get('cha', 10)}({mod(attr.get('cha', 10))})
- Навыки с владением: {skills_str}""")

    inventory = body.get("inventory", {})
    if inventory:
        items = inventory.get("items", [])
        equipped = [i for i in items if i.get("equipped")]
        equipped_str = ", ".join(f"{i['name']} ({i.get('mechanics', '')})" for i in equipped) if equipped else "ничего"
        currency = inventory.get("currency", {})
        total_weight = sum(i.get("weight", 0) * i.get("qty", 1) for i in items)
        parts.append(f"""
## Инвентарь
- Экипировано: {equipped_str}
- Всего предметов: {len(items)}, суммарный вес: {total_weight:.1f} фунт.
- Кошелёк: {currency.get('pp', 0)} ПМ, {currency.get('gp', 0)} ЗМ, {currency.get('ep', 0)} ЭМ, {currency.get('sp', 0)} СМ, {currency.get('cp', 0)} ММ""")

    location = body.get("currentLocation", "")
    if location:
        parts.append(f"\n## Текущая локация\n{location}")

    npcs = body.get("npcs", [])
    if npcs:
        npc_lines = []
        for npc in npcs[:6]:
            rel = npc.get("relation", 0)
            rel_str = "дружелюбен" if rel > 3 else "враждебен" if rel < -3 else "нейтрален"
            speech = f" Речь: {npc['speechStyle']}." if npc.get("speechStyle") else ""
            npc_lines.append(
                f"- {npc['name']} ({npc.get('race', '?')}, {npc.get('role', '?')}) — отношение: {rel_str} ({rel:+d}).{speech}"
            )
        parts.append("\n## Известные NPC\n" + "\n".join(npc_lines))

    world = body.get("world", {})
    if world:
        factions = world.get("factions", [])
        fac_str = ", ".join(f"{f['name']} (отношение {f.get('relation', 0):+d})" for f in factions) if factions else "нет"
        parts.append(f"""
## Мир: {world.get('name', '?')} ({world.get('era', '?')})
{world.get('description', '')}
Уровень магии: {world.get('magicLevel', '?')}
Фракции: {fac_str}""")

    chronicle = body.get("chronicle", [])
    if chronicle:
        recent = chronicle[-5:]
        chron_lines = [f"- [{e.get('date', '?')}] {e.get('title', '?')}: {e.get('description', '')[:120]}..." for e in recent]
        parts.append("\n## Последние события (хроника)\n" + "\n".join(chron_lines))

    plot_threads = body.get("plotThreads", [])
    active_plots = [p for p in plot_threads if p.get("status") == "active"]
    if active_plots:
        plot_lines = [f"- «{p['name']}»: {p.get('description', '')[:100]}" + (f" ⏰ {p['timer']}" if p.get("timer") else "") for p in active_plots]
        parts.append("\n## Активные сюжетные линии\n" + "\n".join(plot_lines))

    return "\n".join(parts)


def handler(event: dict, context) -> dict:
    """Обрабатывает запрос к AI-мастеру D&D с полным контекстом кампании."""
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    messages = body.get("messages", [])
    model = body.get("model", "gpt-4o")
    temperature = float(body.get("temperature", 0.8))

    if not messages:
        return {
            "statusCode": 400,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": {"error": "messages обязательны"},
        }

    provider = body.get("provider", "openrouter")

    # Выбираем ключ и endpoint по провайдеру
    # OpenRouter обходит региональные ограничения и поддерживает OpenAI + Anthropic
    if provider == "anthropic":
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        base_url = "https://api.anthropic.com/v1"
        mapped_model = model
    else:
        # openai и openrouter — оба через OpenRouter
        api_key = os.environ.get("OPENROUTER_API_KEY", "") or os.environ.get("OPENAI_API_KEY", "")
        base_url = "https://openrouter.ai/api/v1"
        model_map = {
            "gpt-4o": "openai/gpt-4o",
            "gpt-4-turbo": "openai/gpt-4-turbo",
            "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
            "claude-opus-4": "anthropic/claude-opus-4",
            "claude-sonnet-4": "anthropic/claude-sonnet-4-5",
            "claude-haiku-3": "anthropic/claude-haiku-3-5",
        }
        mapped_model = model_map.get(model, f"openai/{model}")

    if not api_key:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": "API ключ не настроен. Добавьте OPENROUTER_API_KEY в секреты на openrouter.ai"}),
        }

    system_prompt = build_context(body)

    openai_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role = "assistant" if msg.get("role") == "master" else "user"
        openai_messages.append({"role": role, "content": msg.get("text", "")})

    client = OpenAI(api_key=api_key, base_url=base_url)
    response = client.chat.completions.create(
        model=mapped_model,
        messages=openai_messages,
        max_tokens=1000,
        temperature=temperature,
    )

    reply = response.choices[0].message.content

    return {
        "statusCode": 200,
        "headers": {**cors_headers, "Content-Type": "application/json"},
        "body": json.dumps({"reply": reply, "model": model}, ensure_ascii=False),
    }