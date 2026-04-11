"""
AI-мастер подземелий для D&D 5e. v9
Принимает полный контекст кампании: персонаж, инвентарь, NPC, хроника, сюжетные линии.
"""
import json
import os
from openai import OpenAI

BASE_SYSTEM = """Ты — Мастер Подземелий, ведущий игру строго по правилам D&D 5e на русском языке в эпическом, атмосферном стиле.

## ГЛАВНОЕ ПРАВИЛО: НИКОГДА НЕ РЕШАЙ ЗА КУБИКИ
Твоя задача — описывать мир и назначать сложность. Исход неопределённых действий решают ТОЛЬКО кубики игрока.

## ПРАВИЛО ОБЯЗАТЕЛЬНОЙ ПРОВЕРКИ НАВЫКОВ
Если игрок заявляет действие с неопределённым исходом (подкрасться, убедить, перепрыгнуть, взломать, атаковать, вспомнить факт) — ты ОБЯЗАН:
1. Описать обстановку (1-2 предложения)
2. ОСТАНОВИТЬСЯ и запросить бросок в строгом формате
3. НЕ ПИСАТЬ чем закончилось действие — это решают кубики

## ФОРМАТ ЗАПРОСА БРОСКА (строго обязательный)
[Требуется проверка: Название навыка (Характеристика) СЛ X]
Режим броска: ⚪ Нормальный / 🟢 Преимущество / 🔴 Помеха
Причина: Краткое объяснение обстоятельств.
→ Открой вкладку «Кости», выбери к20, установи переключатель режима и нажми «Бросить». Напиши результат в чат.

## КОГДА НАЗНАЧАТЬ ПРЕИМУЩЕСТВО / ПОМЕХУ
🟢 Преимущество: атака лежачего врага вплотную, помощь союзника, скрытая атака плута, враг не видит атакующего
🔴 Помеха: атака невидимого врага, яд/болезнь/страх, дальняя атака лежачим, враг под защитой укрытия
Если несколько источников — Помеха и Преимущество взаимно отменяются → Нормальный бросок

## ЗАПРЕЩЕНО
❌ «Ты наступил на ветку и гоблин убежал» — когда игрок только заявил намерение
❌ Завершать сцену боя, скрытности, убеждения без броска игрока
❌ Принимать решения за персонажа

## РАЗРЕШЕНО только после того, как игрок написал результат броска
✅ Описывать исход в зависимости от числа
✅ Применять успех/провал к нарративу

## КАК ИНТЕРПРЕТИРОВАТЬ РЕЗУЛЬТАТ БРОСКА
Когда игрок пишет число (например «14») — это результат его броска. Сравни с СЛ и опиши исход:
- Равно или выше СЛ → успех (опиши ярко)
- Ниже СЛ на 1-4 → частичный провал (что-то пошло не так)
- Ниже СЛ на 5+ → полный провал (последствия)
- Натуральная 20 → критический успех
- Натуральная 1 → критический провал

## ИСПОЛЬЗОВАНИЕ ДАННЫХ ПЕРСОНАЖА
Ты видишь лист персонажа. Всегда используй актуальные модификаторы навыков игрока при назначении проверок. Подсказывай: «Твой бонус к Скрытности: +2. Нажми на навык «Скрытность» в разделе «Персонаж» чтобы бросить прямо оттуда.»

## ОСТАЛЬНЫЕ ПРАВИЛА
- Учитывай характеристики, инвентарь, HP персонажа
- Реагируй на NPC согласно их отношению и характеру
- Описания: 2-4 абзаца, ёмко и атмосферно
- Не противоречь ранее установленным фактам мира"""


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

        # Только навыки с владением — сокращаем размер
        prof_skills = {k: v for k, v in skills.items() if isinstance(v, (int, float)) and abs(v) > abs((skills.get(k, 0)))}
        skills_str = ", ".join(f"{k} {'+' if v >= 0 else ''}{v}" for k, v in list(skills.items())[:8]) if skills else "нет"

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
        equipped_str = ", ".join(f"{i['name']}" for i in equipped) if equipped else "ничего"
        currency = inventory.get("currency", {})
        gp = currency.get('gp', 0)
        sp = currency.get('sp', 0)
        parts.append(f"## Инвентарь\nЭкипировано: {equipped_str} | Предметов: {len(items)} | Золото: {gp}зм {sp}см")

    location = body.get("currentLocation", "")
    if location:
        parts.append(f"## Локация: {location}")

    npcs = body.get("npcs", [])
    if npcs:
        npc_lines = []
        for npc in npcs[:4]:
            rel = npc.get("relation", 0)
            rel_str = "друг" if rel > 3 else "враг" if rel < -3 else "нейтрал"
            npc_lines.append(f"- {npc['name']} ({npc.get('role', '?')}, {rel_str})")
        parts.append("## NPC\n" + "\n".join(npc_lines))

    world = body.get("world", {})
    if world:
        parts.append(f"## Мир: {world.get('name', '?')}, {world.get('era', '?')}. {world.get('description', '')[:150]}")

    chronicle = body.get("chronicle", [])
    if chronicle:
        recent = chronicle[-3:]
        chron_lines = [f"- {e.get('title', '?')}: {e.get('description', '')[:80]}" for e in recent]
        parts.append("## Последние события\n" + "\n".join(chron_lines))

    plot_threads = body.get("plotThreads", [])
    active_plots = [p for p in plot_threads if p.get("status") == "active"]
    if active_plots:
        plot_lines = [f"- «{p['name']}»" + (f" ⏰ {p['timer']}" if p.get("timer") else "") for p in active_plots[:2]]
        parts.append("## Активные квесты\n" + "\n".join(plot_lines))

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

    # Диагностика секретов — возвращаем при GET запросе
    if event.get("httpMethod") == "GET":
        all_env = {k: v[:6] + "..." if v else "EMPTY" for k, v in os.environ.items() if not k.startswith("_")}
        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": {"env_keys": all_env},
        }

    messages = body.get("messages", [])
    model = body.get("model", "gpt-4o")
    temperature = float(body.get("temperature", 0.8))

    if not messages:
        return {
            "statusCode": 400,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": {"error": "messages обязательны"},
        }

    # Читаем все доступные ключи
    or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    oa_key = os.environ.get("OPENAI_API_KEY", "").strip()

    # Диагностика — вернём если нет ни одного ключа
    if not or_key and not oa_key:
        return {
            "statusCode": 500,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": {"error": "КЛЮЧИ ПУСТЫ. Env vars with KEY/SECRET: " + str({k: (v[:4]+"...") for k, v in os.environ.items() if "KEY" in k or "SECRET" in k or "TOKEN" in k})},
        }

    api_key = or_key or oa_key

    # Если ключ OpenRouter (sk-or-v1-...) — используем их прокси
    # Если обычный ключ OpenAI (sk-...) — идём напрямую в OpenAI
    if or_key and or_key.startswith("sk-or"):
        base_url = "https://openrouter.ai/api/v1"
        model_map = {
            "gpt-4o": "openai/gpt-4o",
            "gpt-4-turbo": "openai/gpt-4-turbo",
            "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
            "claude-opus-4": "anthropic/claude-opus-4",
            "claude-sonnet-4": "anthropic/claude-sonnet-4-5",
            "claude-haiku-3": "anthropic/claude-haiku-3-5",
            "gemini-flash": "google/gemini-flash-1.5:free",
            "gemini-flash-8b": "google/gemini-flash-1.5-8b:free",
            "llama-free": "nousresearch/hermes-3-llama-3.1-405b:free",
            "deepseek-free": "deepseek/deepseek-r1-0528:free",
        }
        mapped_model = model_map.get(model, f"openai/{model}")
    else:
        # Прямой OpenAI
        base_url = None
        mapped_model = model

    system_prompt = build_context(body)

    openai_messages = [{"role": "system", "content": system_prompt}]
    for msg in messages:
        role = "assistant" if msg.get("role") == "master" else "user"
        openai_messages.append({"role": role, "content": msg.get("text", "")})

    try:
        client = OpenAI(api_key=api_key, **( {"base_url": base_url} if base_url else {}))
        response = client.chat.completions.create(
            model=mapped_model,
            messages=openai_messages,
            max_tokens=1000,
            temperature=temperature,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": {"error": f"Ошибка API ({type(e).__name__}): {str(e)}"},
        }

    return {
        "statusCode": 200,
        "headers": {**cors_headers, "Content-Type": "application/json"},
        "body": {"reply": reply, "model": model},
    }