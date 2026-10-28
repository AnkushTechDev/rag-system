# Fine-tuning lab: from demonstrations to a real adapter

The app now includes dataset validation/export, a real MLX LoRA training launcher, and an optional comparison of actual base/adapter model responses. **No model has been trained merely by adding this feature.** Python training dependencies and model weights are not installed automatically.

The Node.js/JavaScript backend and Next.js UI remain unchanged in language. Python/MLX is an optional external ML training runtime. The default runner targets Apple Silicon macOS, which matches this machine; it is not a cross-platform GPU trainer.

## What the example teaches

The synthetic task is support-issue triage: given a problem with a RAG app, return JSON with `category` and `next_step`. Categories are chunking, retrieval, generation and operations. There are 32 demonstrations across 16 independent scenarios, each with two paraphrases.

This teaches a response behavior, not a private-document knowledge base. It does not automatically replace the existing RAG answer generator. To combine fine-tuning with RAG, train on representative grounded-answer examples compatible with that generator's schema, then evaluate citation accuracy, groundedness and retrieval jointly.

### RAG, SFT, LoRA and QLoRA

- RAG adds retrieved evidence to the prompt at inference time without changing model weights.
- Supervised fine-tuning (SFT) optimizes model parameters using prompts and desired target outputs.
- Full fine-tuning updates the selected model weights directly. LoRA keeps base matrices frozen and learns a low-rank update: `W_effective = W_base + B × A`.
- The example uses a quantized base model with trainable adapters, making this a quantized-LoRA workflow. A small model and low memory use do not guarantee useful quality.
- The trainer computes prediction loss on examples; `--mask-prompt` restricts the learning target to the assistant completion. Gradients and the optimizer update adapter parameters. This is actual optimization, not prompt engineering.

## 1. Prepare and inspect data

Open **Fine-tuning lab** in the running app. Click **Validate & split**. The sample creates 24 training, four validation and four test examples. Files can be downloaded independently. Editing the input invalidates the old report so you cannot accidentally export a split from an earlier version.

Each input line follows this deliberately restricted single-turn format:

```json
{
  "group": "citation-scenario",
  "messages": [
    { "role": "system", "content": "Define the task and response format." },
    { "role": "user", "content": "An input example." },
    { "role": "assistant", "content": "The desired target output." }
  ]
}
```

`group` is preparation metadata and is removed from exported training files. Put paraphrases and examples derived from one source/scenario in the same group. The splitter never divides a group across partitions. Identical normalized prompts link overlapping groups; identical full examples are deduplicated; conflicting targets for the same normalized prompt are rejected.

The seed is reproducible and group ordering is hashed, so reordering input lines does not change a valid split. Approximately 15% of groups go to validation and 15% to test, with minimum nonempty held-out partitions. Group sizes can make row percentages uneven. This is not stratified class balancing and does not detect all semantic near-duplicates. Review class coverage and leakage manually.

The app limits datasets to 200 examples / 180,000 characters, with three nonempty text messages per row. At least 12 unique examples and five groups are required; the resulting training set must have at least ten rows. These are learning-workspace rules, not universal MLX/provider minimums. Check tokenizer lengths separately; characters are not tokens.

For training on the included dataset, run from the repository root:

```sh
npm run finetune:prepare
```

For your edited JSONL file downloaded from the UI:

```sh
npm run finetune:prepare -- --input /absolute/path/to/dataset.jsonl
```

This command writes a fresh UUID directory under `data/fine-tuning/` with `train.jsonl`, `valid.jsonl`, `test.jsonl` and `manifest.json`. It prints the directory. The manifest records the seed, split counts, dataset fingerprint and SHA-256 digests. This stage is offline and never downloads or trains a model.

## 2. Install the optional training runtime

Use Python 3.11+ on Apple Silicon. Replace `python3.11` with another installed compatible Python if needed:

```sh
python3.11 -m venv .venv-finetune
.venv-finetune/bin/python -m pip install -r training/requirements-mlx.txt
```

The top-level `mlx-lm[train]` version is pinned to 0.32.2. Dependencies are not fully locked; record `pip freeze` with real experiments. First use can download the selected Hugging Face model. Model downloads consume disk, and training uses compute and unified memory. Check the model card/license and your machine's capacity. Training does not call OpenAI or upload the dataset to a hosted training API.

## 3. Review the plan, then train

Set RUN to the prepared directory that the CLI printed:

```sh
RUN="/absolute/path/to/rag-system/data/fine-tuning/your-run-uuid"
npm run finetune:train -- --run "$RUN"
```

By default this verifies all three dataset digests and prints a plan. It does **not** require MLX/Python to be installed, spawn a trainer, or create weights.

To actually start optimization:

```sh
npm run finetune:train -- --run "$RUN" --execute
```

Defaults: `mlx-community/Qwen2.5-0.5B-Instruct-4bit`, 60 iterations, batch size 1, four adapted layers, maximum sequence length 512, learning rate 0.0001, prompt masking and seed 42. Change iteration count with `--iters`; configure `FINETUNE_MODEL` and optionally `FINETUNE_PYTHON` in the root `.env`.

This is an illustrative setup, not a tuned recipe. Watch training and validation loss for overfitting. Long examples may be truncated by the trainer, so inspect tokenizer lengths before a meaningful run. Keep all splits and the base model identical when comparing experiments.

The launcher uses an argument array and `shell:false`; no browser-provided command is executed. `training-run.json` exclusively claims an execution attempt and records the actual model/arguments/fingerprint. MLX writes adapter configuration and `adapters.safetensors` under `RUN/adapters`. The claim records a launch attempt, **not successful completion**. Inspect process exit status, logs and actual weights. A failed/used run should be prepared again under a fresh UUID instead of overwriting artifacts. The web UI does not monitor external training progress.

## 4. Evaluate held-out loss

After training, compare the exact same test set with and without the adapter. In the same terminal:

```sh
MODEL="mlx-community/Qwen2.5-0.5B-Instruct-4bit"
.venv-finetune/bin/python -m mlx_lm lora --model "$MODEL" --data "$RUN" --test --adapter-path "" --batch-size 1 --test-batches -1 --max-seq-length 512
.venv-finetune/bin/python -m mlx_lm lora --model "$MODEL" --data "$RUN" --test --adapter-path "$RUN/adapters" --batch-size 1 --test-batches -1 --max-seq-length 512
```

The empty adapter path explicitly evaluates the base model. Use the actual trained base model from `training-run.json` if you changed it. MLX reports test loss and perplexity. A lower test loss is useful evidence but not a complete task-quality evaluation. Measure classification accuracy, JSON validity and human usefulness on additional unseen cases. Do not tune repeatedly on the test set.

## 5. Compare actual outputs in the web app

With the same base model and actual trained adapter, start two separate local servers in two terminals. Set RUN again in the adapter terminal. Keep both bound to loopback:

```sh
.venv-finetune/bin/python -m mlx_lm server --model mlx-community/Qwen2.5-0.5B-Instruct-4bit --host 127.0.0.1 --port 8081 --max-tokens 200
```

```sh
RUN="/absolute/path/to/your/prepared-run"
.venv-finetune/bin/python -m mlx_lm server --model mlx-community/Qwen2.5-0.5B-Instruct-4bit --adapter-path "$RUN/adapters" --host 127.0.0.1 --port 8082 --max-tokens 200
```

Set in root `.env`, then restart the API:

```dotenv
FINETUNE_COMPARE_ENABLED=true
FINETUNE_BASE_URL=http://127.0.0.1:8081/v1
FINETUNE_TUNED_URL=http://127.0.0.1:8082/v1
```

The comparison endpoint calls both configured servers using the same prompt and decoding settings. It shows their real raw responses and task-schema validity. It never invents a fine-tuned response if servers are absent. It cannot verify that a server was actually launched with the intended adapter: check server commands and artifacts yourself. Running two resident models needs more memory; use the CLI sequentially if your machine is constrained.

The built-in comparison prompt/schema applies to the support-triage sample. If you train a different task, adapt the comparison prompt and evaluator to match. Passing the schema is not proof of correct categories or improvement. No production model registry, job queue, training scheduler, experiment tracker, adapter authentication or GPU orchestration is included.

## Code to study

- `packages/rag-core/src/fine-tuning.js`: validation, duplicate/conflict checks, group union, deterministic splitting and chat-file export.
- `apps/api/src/fine-tuning.js`: dataset endpoints and server-owned local comparison URLs.
- `scripts/fine-tuning/prepare.js`: offline versioned files and manifest checksums.
- `scripts/fine-tuning/train.js`: reviewable plan and explicit MLX execution with no shell interpolation.
- `apps/web/components/fine-tuning.js`: editable examples, invalidation, downloads, explanations and comparison states.
- New core/API/CLI tests exercise these paths without downloading a model or training weights.

## Interview questions

1. How does SFT differ from RAG and pretraining?
2. Why might LoRA use less training memory than updating every base parameter?
3. What are overfitting, catastrophic forgetting and train/test leakage?
4. Why mask prompt tokens, and what exactly is being optimized?
5. Why is valid JSON weaker than a correct prediction?
6. How could you combine a tuned generator with a retrieval pipeline while preserving citations?

## Sources and verification limits

The runner and optional serving commands follow the [MLX LM LoRA documentation](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/LORA.md) and [versioned server source](https://github.com/ml-explore/mlx-lm/blob/v0.32.2/mlx_lm/server.py). The default model is an example from its [model card](https://huggingface.co/mlx-community/Qwen2.5-0.5B-Instruct-4bit), not a quality recommendation.

OpenAI's [official SFT documentation](https://developers.openai.com/api/docs/guides/supervised-fine-tuning) currently says its fine-tuning platform is closed to new users and is winding down. This workflow therefore uses local MLX instead of assuming hosted training eligibility.

Dataset/API/CLI behavior and provider request contracts are testable without ML dependencies. Actual optimization and post-training quality require installing MLX and running training; neither is claimed merely because the feature code exists.
