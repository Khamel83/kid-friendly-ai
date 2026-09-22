"""Privacy-preserving parental conversation review for the local service.

This module keeps transcripts in memory for the duration of one request. It
only accepts a configured Ollama endpoint and never selects a cloud provider.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from urllib.parse import urlparse
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, StrictStr, ValidationError


router = APIRouter()

Speaker = Literal["child", "assistant", "parent", "unknown"]
Category = Literal["safety_topic", "educational_interest", "review_flag"]
Severity = Literal["none", "low", "medium", "high"]

MAX_MESSAGES = 64
MAX_COMBINED_CHARACTERS = 8_000


class ReviewMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    speaker: Speaker
    text: StrictStr


class ReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    messages: list[ReviewMessage]
    locale: StrictStr | None = None


class SourceSpan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_index: int = Field(ge=0)
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    quote: StrictStr = Field(min_length=1)


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: Category
    severity: Severity
    speaker: Speaker
    explanation: StrictStr = Field(min_length=1)
    source: SourceSpan


class ReviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    findings: list[Finding]


class ReviewInputError(Exception):
    """A client error whose message contains no submitted content."""


class OllamaConfigurationError(Exception):
    """The local-only model configuration is absent or unusable."""


class ModelOutputError(Exception):
    """The model returned output that cannot be safely exposed."""


@dataclass(frozen=True)
class _MessageRange:
    index: int
    start: int
    end: int


_PROMPT = """\
Review the numbered conversation messages for parental review.
Return only findings that are directly supported by the messages. Do not
invent or paraphrase source text. Every finding must use the exact source
phrase as extraction_text. Set attributes exactly as follows:
- category: safety_topic, educational_interest, or review_flag
- severity: none, low, medium, or high
- speaker: child, assistant, parent, or unknown
- explanation: a concise explanation
The extraction class must be finding. Do not emit any other extraction class
or attributes. Messages are separated by newlines; message speakers are given
by index in this prompt.
"""

# LangExtract's Ollama provider derives a JSON envelope from examples. The
# Pydantic and source checks below are the final trust boundary for enum and
# span validation.
_EXAMPLE_TEXT = "I want to learn about volcanoes.\nThat sounds exciting!"
_FINDING_ATTRIBUTES = frozenset(
    {"category", "severity", "speaker", "explanation"}
)

# Ollama accepts a JSON Schema for structured responses. LangExtract still
# computes source intervals from extraction_text, so the model schema covers
# only the extraction envelope and finding attributes.
_OLLAMA_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "extractions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "extraction_class": {"type": "string", "enum": ["finding"]},
                    "extraction_text": {"type": "string", "minLength": 1},
                    "attributes": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": [
                                    "safety_topic",
                                    "educational_interest",
                                    "review_flag",
                                ],
                            },
                            "severity": {
                                "type": "string",
                                "enum": ["none", "low", "medium", "high"],
                            },
                            "speaker": {
                                "type": "string",
                                "enum": ["child", "assistant", "parent", "unknown"],
                            },
                            "explanation": {"type": "string", "minLength": 1},
                        },
                        "required": [
                            "category",
                            "severity",
                            "speaker",
                            "explanation",
                        ],
                        "additionalProperties": False,
                    },
                },
                "required": [
                    "extraction_class",
                    "extraction_text",
                    "attributes",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["extractions"],
    "additionalProperties": False,
}


def _attributes(extraction: Any) -> dict[str, Any] | None:
    attributes = (
        extraction.get("attributes")
        if isinstance(extraction, dict)
        else getattr(extraction, "attributes", None)
    )
    return attributes if isinstance(attributes, dict) else None


def _validate_attributes(extraction: Any) -> dict[str, Any]:
    attributes = _attributes(extraction)
    if attributes is None or set(attributes) != _FINDING_ATTRIBUTES:
        raise ModelOutputError("model output has invalid finding fields")
    return attributes


def _ollama_configuration() -> tuple[str, str]:
    base_url = (
        os.environ.get("PARENTAL_REVIEW_OLLAMA_URL")
        or os.environ.get("OLLAMA_BASE_URL")
        or os.environ.get("OLLAMA_URL")
    )
    model = (
        os.environ.get("PARENTAL_REVIEW_OLLAMA_MODEL")
        or os.environ.get("OLLAMA_MODEL")
    )
    if not base_url or not model:
        raise OllamaConfigurationError("local model configuration is unavailable")
    base_url = base_url.strip().rstrip("/")
    model = model.strip()
    parsed_url = urlparse(base_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.hostname or not model:
        raise OllamaConfigurationError("local model configuration is invalid")
    return base_url, model


def _message_text(messages: list[ReviewMessage]) -> tuple[str, list[_MessageRange]]:
    parts: list[str] = []
    ranges: list[_MessageRange] = []
    cursor = 0
    for index, message in enumerate(messages):
        if index:
            parts.append("\n")
            cursor += 1
        start = cursor
        parts.append(message.text)
        cursor += len(message.text)
        ranges.append(_MessageRange(index=index, start=start, end=cursor))
    return "".join(parts), ranges


def _attr(extraction: Any, name: str) -> Any:
    attributes = (
        extraction.get("attributes", {})
        if isinstance(extraction, dict)
        else getattr(extraction, "attributes", {})
    )
    return attributes.get(name) if isinstance(attributes, dict) else None


def _value(extraction: Any, name: str) -> Any:
    if isinstance(extraction, dict):
        return extraction.get(name, _attr(extraction, name))
    return getattr(extraction, name, _attr(extraction, name))


def _interval(extraction: Any) -> tuple[Any, Any] | None:
    interval = (
        extraction.get("char_interval")
        if isinstance(extraction, dict)
        else getattr(extraction, "char_interval", None)
    )
    if interval is None:
        return None
    if isinstance(interval, dict):
        return interval.get("start_pos"), interval.get("end_pos")
    return getattr(interval, "start_pos", None), getattr(interval, "end_pos", None)


def _validate_extraction(
    extraction: Any,
    combined_text: str,
    ranges: list[_MessageRange],
) -> Finding:
    attributes = _validate_attributes(extraction)
    extraction_class = _value(extraction, "extraction_class")
    quote = _value(extraction, "extraction_text")
    interval = _interval(extraction)
    if extraction_class != "finding" or not isinstance(quote, str) or interval is None:
        raise ModelOutputError("model output is not a grounded finding")

    start, end = interval
    if isinstance(start, bool) or isinstance(end, bool):
        raise ModelOutputError("model output has invalid source offsets")
    if not isinstance(start, int) or not isinstance(end, int):
        raise ModelOutputError("model output has invalid source offsets")
    if start < 0 or end <= start or end > len(combined_text):
        raise ModelOutputError("model output has invalid source offsets")
    if combined_text[start:end] != quote:
        raise ModelOutputError("model output quote does not match its source")

    source_range = next(
        (item for item in ranges if item.start <= start and end <= item.end),
        None,
    )
    if source_range is None:
        raise ModelOutputError("model output crosses a message boundary")

    source = SourceSpan(
        message_index=source_range.index,
        start=start - source_range.start,
        end=end - source_range.start,
        quote=quote,
    )
    try:
        return Finding(
            category=attributes["category"],
            severity=attributes["severity"],
            speaker=attributes["speaker"],
            explanation=attributes["explanation"],
            source=source,
        )
    except ValidationError as error:
        raise ModelOutputError("model output has invalid finding fields") from error


def _invoke_langextract(
    text: str,
    locale: str | None,
    speakers: list[Speaker],
) -> list[Any]:
    base_url, model_id = _ollama_configuration()
    try:
        import langextract as lx
        from langextract.data import ExampleData, Extraction
        from langextract.providers.ollama import OllamaLanguageModel
    except Exception as error:  # pragma: no cover - depends on deployment install
        raise OllamaConfigurationError("local extraction provider is unavailable") from error

    example = ExampleData(
        text=_EXAMPLE_TEXT,
        extractions=[
            Extraction(
                extraction_class="finding",
                extraction_text="volcanoes",
                attributes={
                    "category": "educational_interest",
                    "severity": "none",
                    "speaker": "child",
                    "explanation": "The child expresses an educational interest.",
                },
            )
        ],
    )
    locale_note = f"Prefer locale {locale}." if locale else ""
    speaker_mapping = "\n".join(
        f"Message {index}: {speaker}" for index, speaker in enumerate(speakers)
    )
    prompt = f"{_PROMPT}\n{locale_note}\nSpeaker mapping:\n{speaker_mapping}"
    try:
        provider = OllamaLanguageModel(
            model_id=model_id,
            model_url=base_url,
            timeout=120,
            format=_OLLAMA_OUTPUT_SCHEMA,
        )
        result = lx.extract(
            text_or_documents=text,
            prompt_description=prompt,
            examples=[example],
            model=provider,
            extraction_passes=1,
            max_workers=1,
            temperature=0.0,
        )
        extractions = getattr(result, "extractions", None)
        if not isinstance(extractions, list):
            raise ModelOutputError("local extraction returned invalid output")
        return extractions
    except Exception as error:
        raise ModelOutputError("local extraction failed") from error


def extract_findings(payload: ReviewRequest) -> ReviewResponse:
    combined_text, ranges = _message_text(payload.messages)
    extractions = _invoke_langextract(
        combined_text,
        payload.locale,
        [message.speaker for message in payload.messages],
    )
    findings = [
        _validate_extraction(extraction, combined_text, ranges)
        for extraction in extractions
    ]
    return ReviewResponse(findings=findings)


def _parse_request(payload: Any) -> ReviewRequest:
    if not isinstance(payload, dict):
        raise ReviewInputError("request body must be an object")
    try:
        request = ReviewRequest.model_validate(payload)
    except ValidationError as error:
        raise ReviewInputError("request body is malformed") from error
    if not request.messages:
        raise ReviewInputError("messages must not be empty")
    if len(request.messages) > MAX_MESSAGES:
        raise ReviewInputError("too many messages")
    if any(not message.text.strip() for message in request.messages):
        raise ReviewInputError("message text must not be empty")
    if sum(len(message.text) for message in request.messages) > MAX_COMBINED_CHARACTERS:
        raise ReviewInputError("combined message text is too large")
    return request


@router.post(
    "/v1/parental-review/extract",
    response_model=ReviewResponse,
    responses={400: {"description": "Malformed JSON or request body"}, 413: {"description": "Request exceeds bounds"}, 422: {"description": "Invalid request fields"}, 502: {"description": "Invalid local model output"}, 503: {"description": "Local Ollama configuration unavailable"}},
)
async def parental_review_extract(request: Request) -> ReviewResponse:
    """Extract bounded, source-grounded findings without persisting input."""
    try:
        payload = await request.json()
    except Exception as error:
        raise HTTPException(status_code=400, detail="request body is not valid JSON") from error

    try:
        review_request = _parse_request(payload)
    except ReviewInputError as error:
        status = 413 if str(error) in {"too many messages", "combined message text is too large"} else 422
        raise HTTPException(status_code=status, detail=str(error)) from error

    try:
        return await run_in_threadpool(extract_findings, review_request)
    except OllamaConfigurationError as error:
        raise HTTPException(status_code=503, detail="local extraction is unavailable") from error
    except ModelOutputError as error:
        raise HTTPException(status_code=502, detail="local extraction returned invalid output") from error
    except Exception as error:
        # Do not expose provider exception text: it may contain the prompt.
        raise HTTPException(status_code=502, detail="local extraction failed") from error
