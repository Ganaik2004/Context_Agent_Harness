from __future__ import annotations

import json
from typing import AsyncGenerator

from llm_client import LLMClient
from utils import LLMClientConfig, ChatOptions, Message
from Events.events import TextDeltaEvent, MessageEndEvent,StreamEndEvent

PROVIDER_URLS = {
        "openai": "https://api.openai.com/v1",
        "openrouter": "https://openrouter.ai/api/v1",
        "ollama": "http://localhost:11434",
    }

VALID_PROVIDERS = set(PROVIDER_URLS.keys())

def build_client(provider: str, api_key: str | None) -> LLMClient:
        """Construct an LLMClient for a known provider."""
        if provider not in VALID_PROVIDERS:
            raise ValueError(f"Unknown provider: {provider}")
        return LLMClient(LLMClientConfig(
            provider_id=provider,
            api_key=api_key or "not-needed",
            endpoint=PROVIDER_URLS[provider],
        ))

def to_llm_messages(session_messages: list[dict]) -> list[Message]:
        """Convert stored session messages to library Message objects.

        User messages carry multimodal content (ContentPart[] — text + images).
        Assistant messages carry plain strings.
        """
        out: list[Message] = []
        for msg in session_messages:
            if msg["role"] == "user":
                out.append(Message(role="user", content=msg["content"]))
            else:
                out.append(Message(role="assistant", content=msg["content"]))
        return out

async def validate_connection(provider: str, api_key: str | None) -> None:
        """Validate a provider + apiKey combination. Raises on failure."""
        client = build_client(provider, api_key)
        await client.get_model()

async def list_models(provider: str, api_key: str | None) -> list[str]:
        """Return available model IDs for a provider."""
        client = build_client(provider, api_key)
        return await client.get_model()

async def stream_sse(
        messages: list[Message],
        model: str,
        provider: str,
        api_key: str | None,
    ) -> AsyncGenerator[str, None]:
        """Stream a chat completion, yielding SSE-formatted strings."""
        client = build_client(provider, api_key)
        try:
            async for event in client.chat_stream(messages,options=ChatOptions(model=model)):
                if isinstance(event, TextDeltaEvent):
                    payload = {"type": "delta", "content": event.content}
                    yield f"data: {json.dumps(payload)}\n\n"
                elif isinstance(event, MessageEndEvent):
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as exc:
            payload = {"type": "error", "message": str(exc)}
            yield f"data: {json.dumps(payload)}\n\n"