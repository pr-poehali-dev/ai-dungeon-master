"""
AI-мастер подземелий для D&D 5e.
Принимает историю диалога и состояние персонажа, возвращает ответ мастера. v2
"""
import json
import os
from openai import OpenAI

SYSTEM_PROMPT = """Ты — опытный Мастер Подземелий (Dungeon Master) для настольной ролевой игры D&D 5e. 
Ты ведёшь игру на русском языке в эпическом стиле.

Правила:
- Используй строгие правила D&D 5e без модификаций
- Описывай мир живо и атмосферно, используй богатый язык
- Когда игрок совершает действие, требующее броска — укажи какой бросок нужен и его DC
- Если игрок сообщает результат броска — используй его в нарративе
- Реагируй на действия логично, учитывай характеристики персонажа
- Создавай напряжение, интригу и запоминающихся NPC
- Описания держи от 2 до 4 абзацев — ёмко, но атмосферно
- Заканчивай реплику вопросом или открытым моментом для следующего действия игрока"""


def handler(event: dict, context) -> dict:
    """Обрабатывает запрос к AI-мастеру D&D"""
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
        messages = body.get("messages", [])
        character = body.get("character", {})
        provider = body.get("provider", "openai")
        model = body.get("model", "gpt-4o")

        if not messages:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "messages обязательны"}),
            }

        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            return {
                "statusCode": 500,
                "headers": cors_headers,
                "body": json.dumps({"error": "API ключ не настроен"}),
            }

        # Формируем системный промпт с учётом персонажа
        system = SYSTEM_PROMPT
        if character:
            char_info = (
                f"\n\nТекущий персонаж:\n"
                f"- Имя: {character.get('name', 'Неизвестен')}\n"
                f"- Раса/Класс/Уровень: {character.get('race', '?')} {character.get('cls', '?')} {character.get('level', '?')} ур.\n"
                f"- HP: {character.get('hp', '?')}/{character.get('maxHp', '?')}\n"
                f"- Характеристики: СИЛ {character.get('str', 10)}, ЛОВ {character.get('dex', 10)}, "
                f"ТЕЛ {character.get('con', 10)}, ИНТ {character.get('int', 10)}, "
                f"МДР {character.get('wis', 10)}, ХАР {character.get('cha', 10)}\n"
                f"- Бонус мастерства: +{character.get('profBonus', 2)}"
            )
            system += char_info

        # Конвертируем историю в формат OpenAI
        openai_messages = [{"role": "system", "content": system}]
        for msg in messages:
            role = "assistant" if msg.get("role") == "master" else "user"
            openai_messages.append({"role": role, "content": msg.get("text", "")})

        # Выбираем базовый URL в зависимости от провайдера
        base_url = None
        if provider == "anthropic":
            # Используем OpenAI-совместимый прокси Anthropic
            base_url = "https://api.anthropic.com/v1"

        client = OpenAI(api_key=api_key, base_url=base_url)

        response = client.chat.completions.create(
            model=model,
            messages=openai_messages,
            max_tokens=800,
            temperature=float(body.get("temperature", 0.8)),
        )

        reply = response.choices[0].message.content

        return {
            "statusCode": 200,
            "headers": {**cors_headers, "Content-Type": "application/json"},
            "body": json.dumps({"reply": reply, "model": model}, ensure_ascii=False),
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": str(e)}, ensure_ascii=False),
        }