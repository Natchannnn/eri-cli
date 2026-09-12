---
title: "Auditing Token Overhead and Cache Inefficiencies in Vision Pipelines"
date: 2026-07-25
category: Projects
summary: "Measuring cost breakdown in a document transcription pipeline revealed that agent scaffolding and cache write churn represented 97% of total token usage."
---
Auditing the operational cost of an automated document transcription pipeline revealed significant inefficiencies in how image inputs were being processed. The service, which monitors incoming handwritten work order photos to extract tabular records into CSV format, was averaging approximately $0.23 per invocation. Over 97% of that expense came from execution scaffolding rather than image analysis.

## Measuring Invocation Cost

The original extraction script invoked `claude -p` (one-shot CLI mode) via a subprocess and parsed the final output string. Because the script ignored the returned `usage` and `total_cost_usd` fields, cost had never been logged.

Benchmarking three sequential runs against a sample 1248×1760 work order image produced consistent transcriptions (confidence scores 0.85 to 1.0) with costs measuring $0.2499, $0.2189, and $0.2277 per document.

## Token Breakdown and Cache Write Churn

Analyzing the token billing logs revealed the source of the cost:

- **Actual payload**: The task prompt consumed approximately 300 tokens, and the document image consumed ~2,900 tokens (roughly 3,200 tokens of substantive data).
- **Harness overhead**: Total input tokens per call reached ~117,000. Around 114,000 tokens consisted of system prompt definitions, MCP tool declarations, and CLI session scaffolding transmitted across multiple agent turns.
- **Cache write penalty**: Prompt caching accounted for the majority of the invoice. Each call incurred 36,312 tokens at the 2× cache write rate ($0.218, or 87% of the total bill). Because each CLI subprocess operated in a fresh ephemeral session with a distinct prefix, cached data was never reused on subsequent runs, incurring continuous write fees for zero read discount.
- **Unvalidated image processing**: Blurry or corrupted images failing downstream validation incurred the full token fee before rejection.

## Architecture Refactor

The pipeline was redesigned to interface directly with the model:

1. **Direct API calls**: Replaced the CLI wrapper with direct calls to the Anthropic Messages API, passing images as base64 content blocks and reducing input scaffolding from 114,000 tokens to baseline system instructions.
2. **Structured JSON output**: Replaced prompt-based extraction instructions with JSON schema enforcement, eliminating regex parsing routines and malformed response retries.
3. **Image downscaling**: Added automated resizing to constrain input photos to 2,000 pixels along the longest edge. This reduced image token volume from ~16,000 tokens (for full 4032×3024 smartphone captures) to ~4,000 tokens while preserving handwriting legibility.
4. **Disabled extended thinking**: Removed reasoning token overhead unnecessary for direct transcription.

The refactored module passed all 17 unit tests using mocked endpoints. Estimated per-document cost drops to approximately $0.017—an estimated 14× reduction in per-photo processing expense.
