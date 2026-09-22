# Parental-review evaluation

The parental-review extraction path is opt-in. It is disabled unless
`PARENTAL_REVIEW_EXTRACTION_ENABLED=true`; the normal `/api/ask` safety path is
unchanged.

## Local run

1. Start Ollama with the model used by development. The default configuration
   is `http://macmini.local:11434` and `gemma4:e4b`.
2. Start the app with extraction enabled for this local evaluation only:

   ```bash
   PARENTAL_REVIEW_EXTRACTION_ENABLED=true \
   OLLAMA_BASE_URL=http://macmini.local:11434 \
   PARENTAL_REVIEW_MODEL=gemma4:e4b \
   npm run dev
   ```

3. In another terminal, run:

   ```bash
   npm run evaluate:parental-review
   ```

   Use `PARENTAL_REVIEW_URL` when the app is not at the default
   `http://localhost:3000/api/parental-review`.

The evaluator sends five bounded fixtures to the real HTTP route. The route
uses the same OpenAI-compatible `/v1/chat/completions` contract as the local
Ollama client, with non-streaming JSON output for deterministic span checking.
The evaluator reports only fixture counts and aggregate schema, offset, quote,
and repeated-occurrence failures. It does not write or print conversation text,
prompts, excerpts, or findings.

A successful run exits zero and reports five passed fixtures. Any failure exits
non-zero. Review the aggregate output before enabling extraction in a deployed
environment. Keep `PARENTAL_REVIEW_EXTRACTION_ENABLED` unset or `false` in
production until that review is complete.
