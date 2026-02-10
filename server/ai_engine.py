import json
import httpx

OLLAMA_BASE_URL = "http://host.docker.internal:11434"
MODEL = "deepseek-r1:14b"

SYSTEM_PROMPT = (
    "너는 'Dongin Portal'의 AI 어시스턴트야. "
    "사용자의 질문에 한국어로 친절하고 간결하게 답변해. "
    "모르는 내용은 솔직히 모른다고 말해."
)


async def chat_stream(message: str, history: list[dict] | None = None):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": message})

    async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=None) as client:
        async with client.stream(
            "POST",
            "/api/chat",
            json={"model": MODEL, "messages": messages, "stream": True},
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                content = chunk.get("message", {}).get("content", "")
                done = chunk.get("done", False)
                if content:
                    yield {"content": content, "done": False}
                if done:
                    yield {"content": "", "done": True}
                    return


async def check_status() -> dict:
    try:
        async with httpx.AsyncClient(base_url=OLLAMA_BASE_URL, timeout=5) as client:
            resp = await client.get("/api/tags")
            resp.raise_for_status()
            models = [m["name"] for m in resp.json().get("models", [])]
            model_loaded = any(MODEL in m for m in models)
            return {"ollama": True, "model_loaded": model_loaded, "model": MODEL}
    except Exception:
        return {"ollama": False, "model_loaded": False, "model": MODEL}
