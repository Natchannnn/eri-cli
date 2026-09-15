---
title: "Twenty-Three Cents to Read a Photo and Almost None of It Was the Photo"
date: 2026-07-25
category: Projects
summary: "A single photo cost about $0.23 to transcribe because 97% of the tokens belonged to scaffolding and cache churn, not the image."
---
My work-order transcription pipeline — watch for handwritten photos, extract tables to CSV — was costing ~$0.23 a pop. Felt wrong for one photo. It was wrong.

Original design shelled to `claude -p` and scraped the output string. Never even logged the returned `usage` / `total_cost_usd`. Once I did: three runs on the same 1248×1760 sample, confidences 0.85–1.0, costs $0.2499, $0.2189, $0.2277. Consistent transcriptions, consistently expensive.

Breakdown hurt. Task prompt ~300 tokens. Image ~2,900. Real data ~3,200 tokens total. Total input per call: ~117,000. The other ~114,000 was system prompts, MCP tool declarations, CLI scaffolding across turns.

Worse: prompt caching was 87% of the bill. 36,312 tokens at the 2× write rate = $0.218 per call. Every CLI subprocess is a fresh ephemeral session with a fresh prefix, so cache never hits. Paying write fees forever for zero read discount. And blurry images that fail validation downstream still pay full fare before rejection.

Rebuilt it to hit the Anthropic Messages API direct — base64 image blocks, baseline system instructions instead of 114k of harness. JSON schema enforcement instead of regex scraping. Downscale inputs to 2000px longest edge (full 4032×3024 phone shots were ~16k image tokens, now ~4k, handwriting still legible). Killed extended thinking — transcription doesn't need it.

17 unit tests pass on mocked endpoints. New estimate: ~$0.017 per doc. 14× cheaper.
