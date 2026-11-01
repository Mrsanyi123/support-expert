"""LoRA fine-tune on approved expert examples exported by the app.

Input is the JSONL from /api/export/jsonl (or `npm run export:jsonl`): one chat
record per approved TRAIN review, {"messages": [system, user, assistant], "metadata": {...}}.
Held-out evaluation cases are never in this file; the app enforces that at export time
and this script re-checks the metadata before training.

Example:
    python ml/finetune.py --data exports/approved-examples.jsonl --output ml/outputs/relay-lora-v1
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from trl import SFTConfig, SFTTrainer

APPROVED = {"APPROVED", "EDITED_APPROVED"}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--data", default="exports/approved-examples.jsonl")
    p.add_argument("--base-model", default="meta-llama/Llama-3.1-8B-Instruct")
    p.add_argument("--output", default="ml/outputs/relay-lora-v1")
    p.add_argument("--epochs", type=float, default=3)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--rank", type=int, default=16)
    p.add_argument("--alpha", type=int, default=32)
    p.add_argument("--batch-size", type=int, default=2)
    p.add_argument("--grad-accum", type=int, default=4)
    p.add_argument("--max-length", type=int, default=4096)
    p.add_argument("--load-in-4bit", action="store_true", help="QLoRA: load the base model in 4-bit (needs bitsandbytes)")
    p.add_argument("--min-examples", type=int, default=10)
    return p.parse_args()


def load_records(path: Path, min_examples: int) -> list[dict]:
    records = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        rec = json.loads(line)
        meta = rec.get("metadata", {})
        roles = [m["role"] for m in rec["messages"]]
        if meta.get("review_status") not in APPROVED:
            sys.exit(f"line {line_no}: review_status {meta.get('review_status')!r} is not approved; refusing to train")
        if roles[-1] != "assistant" or "user" not in roles:
            sys.exit(f"line {line_no}: expected messages ending in an assistant turn, got {roles}")
        records.append(rec)

    ids = [r["metadata"].get("ticket_id") for r in records]
    if len(set(ids)) != len(ids):
        sys.exit("duplicate ticket_id values in export; re-export from the app")
    if len(records) < min_examples:
        sys.exit(f"only {len(records)} approved examples (need {min_examples}); review more cases or lower --min-examples")
    return records


def main() -> None:
    args = parse_args()
    data_path = Path(args.data)
    records = load_records(data_path, args.min_examples)
    print(f"{len(records)} approved examples from {data_path}")

    # Prompt/completion form so loss is computed only on the expert's answer.
    dataset = Dataset.from_list([{"prompt": r["messages"][:-1], "completion": r["messages"][-1:]} for r in records])

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    quant = (
        BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True)
        if args.load_in_4bit
        else None
    )
    model = AutoModelForCausalLM.from_pretrained(args.base_model, dtype=torch.bfloat16, quantization_config=quant, device_map="auto")

    peft_config = LoraConfig(
        r=args.rank,
        lora_alpha=args.alpha,
        lora_dropout=0.05,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        task_type="CAUSAL_LM",
    )

    training_args = SFTConfig(
        output_dir=args.output,
        num_train_epochs=args.epochs,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=args.grad_accum,
        gradient_checkpointing=True,
        max_length=args.max_length,
        bf16=True,
        logging_steps=1,
        save_strategy="no",
        report_to="none",
    )

    trainer = SFTTrainer(model=model, args=training_args, train_dataset=dataset, processing_class=tokenizer, peft_config=peft_config)
    trainer.train()
    trainer.save_model(args.output)
    tokenizer.save_pretrained(args.output)

    manifest = {
        "base_model": args.base_model,
        "data_file": str(data_path),
        "data_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "examples": len(records),
        "ticket_ids": [r["metadata"].get("ticket_id") for r in records],
        "prompt_versions": sorted({r["metadata"].get("prompt_version") for r in records}),
        "lora": {"rank": args.rank, "alpha": args.alpha},
        "epochs": args.epochs,
        "learning_rate": args.lr,
    }
    Path(args.output, "training-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Saved LoRA adapter and training-manifest.json to {args.output}")


if __name__ == "__main__":
    main()
