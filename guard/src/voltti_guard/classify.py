"""The Prompt Guard classifier: cap, window to <=512 tokens, score, max-pool.

Prompt Guard's context is 512 tokens, so a long message is split into overlapping
512-token windows (the tokenizer does this in one call via overflowing tokens with
a stride), every window is scored, and we take the MAX malicious probability — a
jailbreak anywhere in the message flags the whole message.
"""

from __future__ import annotations

import torch
from torch.nn.functional import softmax
from transformers import AutoModelForSequenceClassification, AutoTokenizer

WINDOW = 512
OVERLAP = 50  # token overlap between windows, so an attack split across a boundary isn't missed


class Classifier:
    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_id)
        self.model.eval()

    @torch.inference_mode()
    def score(self, text: str) -> dict[str, float | int]:
        """Return the max malicious-class probability across the message's
        windows, and how many windows were scored."""
        enc = self.tokenizer(
            text,
            max_length=WINDOW,
            truncation=True,
            return_overflowing_tokens=True,
            stride=OVERLAP,
            return_tensors="pt",
            padding=True,
        )
        logits = self.model(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"]).logits
        # Class 1 is the malicious/jailbreak class for both Prompt Guard 2 and the
        # ProtectAI injection models.
        malicious = softmax(logits, dim=-1)[:, 1]
        return {"score": float(malicious.max().item()), "windows": int(enc["input_ids"].shape[0])}
