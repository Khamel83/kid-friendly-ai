import sys
from types import ModuleType, SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from macmini import parental_review


app = FastAPI()
app.include_router(parental_review.router)
client = TestClient(app)


def extraction(*, quote: str, start: int, end: int, **attributes):
    return SimpleNamespace(
        extraction_class="finding",
        extraction_text=quote,
        attributes=attributes,
        char_interval=SimpleNamespace(start_pos=start, end_pos=end),
    )


def test_valid_extraction_returns_schema_validated_source_span(monkeypatch):
    monkeypatch.setattr(
        parental_review,
        "_invoke_langextract",
        lambda text, locale, speakers: [
            extraction(
                quote="dinosaurs",
                start=14,
                end=23,
                category="educational_interest",
                severity="none",
                speaker="child",
                explanation="The child asks an educational question.",
            )
        ],
    )

    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": "Tell me about dinosaurs"}]},
    )

    assert response.status_code == 200
    assert response.json() == {
        "findings": [
            {
                "category": "educational_interest",
                "severity": "none",
                "speaker": "child",
                "explanation": "The child asks an educational question.",
                "source": {
                    "message_index": 0,
                    "start": 14,
                    "end": 23,
                    "quote": "dinosaurs",
                },
            }
        ]
    }


def test_invalid_source_offsets_are_not_returned(monkeypatch):
    monkeypatch.setattr(
        parental_review,
        "_invoke_langextract",
        lambda text, locale, speakers: [
            extraction(
                quote="hello",
                start=99,
                end=104,
                category="review_flag",
                severity="high",
                speaker="child",
                explanation="A review is needed.",
            )
        ],
    )

    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": "hello"}]},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "local extraction returned invalid output"}


def test_invalid_model_enum_is_not_returned(monkeypatch):
    monkeypatch.setattr(
        parental_review,
        "_invoke_langextract",
        lambda text, locale, speakers: [
            extraction(
                quote="hello",
                start=0,
                end=5,
                category="untrusted_category",
                severity="high",
                speaker="child",
                explanation="A review is needed.",
            )
        ],
    )

    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": "hello"}]},
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "local extraction returned invalid output"}


def test_malformed_request_is_rejected_without_model_call(monkeypatch):
    called = False

    def fail_if_called(text, locale, speakers):
        nonlocal called
        called = True
        raise AssertionError("model should not be called")

    monkeypatch.setattr(parental_review, "_invoke_langextract", fail_if_called)
    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": "hello", "extra": True}]},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "request body is malformed"}
    assert called is False


def test_empty_messages_are_rejected_without_model_call(monkeypatch):
    called = False

    def fail_if_called(text, locale, speakers):
        nonlocal called
        called = True
        raise AssertionError("model should not be called")

    monkeypatch.setattr(parental_review, "_invoke_langextract", fail_if_called)
    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": []},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "messages must not be empty"}
    assert called is False


def test_repeated_phrase_uses_model_selected_occurrence(monkeypatch):
    text = "hello volcano hello volcano"
    monkeypatch.setattr(
        parental_review,
        "_invoke_langextract",
        lambda text, locale, speakers: [
            extraction(
                quote="volcano",
                start=20,
                end=27,
                category="educational_interest",
                severity="none",
                speaker="child",
                explanation="The child mentions volcanoes.",
            )
        ],
    )

    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": text}]},
    )

    assert response.status_code == 200
    assert response.json()["findings"][0]["source"] == {
        "message_index": 0,
        "start": 20,
        "end": 27,
        "quote": "volcano",
    }


def test_request_size_limits_reject_without_model_call(monkeypatch):
    called = False

    def fail_if_called(text, locale, speakers):
        nonlocal called
        called = True
        raise AssertionError("model should not be called")
    monkeypatch.setattr(parental_review, "_invoke_langextract", fail_if_called)
    response = client.post(
        "/v1/parental-review/extract",
        json={
            "messages": [
                {"speaker": "child", "text": "x"}
                for _ in range(parental_review.MAX_MESSAGES + 1)
            ]
        },
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "too many messages"}
    assert called is False

def test_combined_character_limit_rejects_without_model_call(monkeypatch):
    called = False

    def fail_if_called(text, locale, speakers):
        nonlocal called
        called = True
        raise AssertionError("model should not be called")

    monkeypatch.setattr(parental_review, "_invoke_langextract", fail_if_called)
    response = client.post(
        "/v1/parental-review/extract",
        json={
            "messages": [
                {
                    "speaker": "child",
                    "text": "x" * (parental_review.MAX_COMBINED_CHARACTERS + 1),
                }
            ]
        },
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "combined message text is too large"}
    assert called is False

def test_langextract_uses_configured_ollama_with_strict_schema(monkeypatch):
    captured = {}

    class FakeExampleData:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeExtraction:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeProvider:
        def __init__(self, **kwargs):
            captured["provider"] = kwargs

    langextract = ModuleType("langextract")
    langextract.__path__ = []
    langextract.extract = lambda **kwargs: (
        captured.update(extract=kwargs) or SimpleNamespace(extractions=[])
    )
    data = ModuleType("langextract.data")
    data.ExampleData = FakeExampleData
    data.Extraction = FakeExtraction
    providers = ModuleType("langextract.providers")
    providers.__path__ = []
    ollama = ModuleType("langextract.providers.ollama")
    ollama.OllamaLanguageModel = FakeProvider
    monkeypatch.setitem(sys.modules, "langextract", langextract)
    monkeypatch.setitem(sys.modules, "langextract.data", data)
    monkeypatch.setitem(sys.modules, "langextract.providers", providers)
    monkeypatch.setitem(sys.modules, "langextract.providers.ollama", ollama)
    monkeypatch.setenv("PARENTAL_REVIEW_OLLAMA_URL", "http://ollama:11434")
    monkeypatch.setenv("PARENTAL_REVIEW_OLLAMA_MODEL", "local-model")

    assert parental_review._invoke_langextract("hello", None, ["child"]) == []
    assert captured["provider"]["model_url"] == "http://ollama:11434"
    assert captured["provider"]["model_id"] == "local-model"
    assert captured["provider"]["format"] == parental_review._OLLAMA_OUTPUT_SCHEMA
    assert captured["extract"]["text_or_documents"] == "hello"
    assert captured["extract"]["model"].__class__ is FakeProvider


def test_missing_ollama_configuration_fails_closed(monkeypatch):
    monkeypatch.delenv("PARENTAL_REVIEW_OLLAMA_URL", raising=False)
    monkeypatch.delenv("OLLAMA_BASE_URL", raising=False)
    monkeypatch.delenv("OLLAMA_URL", raising=False)
    monkeypatch.delenv("PARENTAL_REVIEW_OLLAMA_MODEL", raising=False)
    monkeypatch.delenv("OLLAMA_MODEL", raising=False)

    response = client.post(
        "/v1/parental-review/extract",
        json={"messages": [{"speaker": "child", "text": "hello"}]},
    )

    assert response.status_code == 503
    assert response.json() == {"detail": "local extraction is unavailable"}
