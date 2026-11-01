# Fine-tuning on approved expert examples

The app produces the dataset; this folder turns it into a LoRA adapter you can serve with vLLM and evaluate on the same locked held-out set as every other version.

## 1. Export

From the Improvements page, click **Export approved examples (JSONL)**, or run:

```bash
npm run export:jsonl   # writes exports/approved-examples.jsonl
```

Each line is one approved review of a train case:

```json
{"messages": [{"role": "system", ...}, {"role": "user", "content": "<sources>...</sources>\n<ticket>...</ticket>"}, {"role": "assistant", "content": "<expert-approved answer>"}],
 "metadata": {"ticket_id": "T-1001", "review_status": "EDITED_APPROVED", "prompt_version": "support-v1", ...}}
```

The user turn is rebuilt with the same prompt version and retrieved sources the app uses at inference time, without few-shot examples. A model trained on it should be run in the app with **Retrieve approved expert examples** turned off, so training and inference see the same prompt.

## 2. Train (one GPU)

An 8B model with LoRA needs a single 24 GB GPU in 4-bit (QLoRA), or a 40–80 GB GPU in bf16. RunPod, Lambda, or Modal all work.

```bash
python -m venv ml/.venv && source ml/.venv/bin/activate
pip install -r ml/requirements.txt
huggingface-cli login   # Llama 3.1 is a gated model

python ml/finetune.py \
  --data exports/approved-examples.jsonl \
  --base-model meta-llama/Llama-3.1-8B-Instruct \
  --output ml/outputs/relay-lora-v1 \
  --load-in-4bit
```

The script refuses to train on anything that is not an approved review, trains only on the expert's answer tokens (the prompt is masked), and writes `training-manifest.json` with the data hash and ticket IDs, so every adapter can be traced back to the exact reviews it learned from.

With the 15 seeded examples this proves the pipeline, not the quality. Retrieval of approved examples (version B) is what moves the score at small volume; fine-tuning starts to pay off at a few hundred approved reviews, when it also lets you drop examples from the prompt and cut latency and cost.

## 3. Serve with vLLM

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-8B-Instruct \
  --enable-lora \
  --lora-modules relay-lora-v1=ml/outputs/relay-lora-v1 \
  --max-lora-rank 16 \
  --api-key "$VLLM_API_KEY"
```

This exposes an OpenAI-compatible API at `http://<host>:8000/v1` where the model name is `relay-lora-v1`.

## 4. Add it as version C and evaluate

1. Add `VLLM_API_KEY=...` to the app's `.env` and restart it.
2. Improvements, then **Add version**: model `relay-lora-v1`, base URL `http://<host>:8000/v1`, API key env var `VLLM_API_KEY`, examples off.
3. Evaluation: run version C on **Held-out v1**, then rate the answers blind.
4. Improvements: compare A to C (fine-tune alone) and B to C (fine-tune vs. retrieved examples), case by case.
