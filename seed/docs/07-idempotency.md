# Idempotent requests

Network errors can leave you unsure whether a request reached Relay. Idempotency keys let you retry `POST` requests safely without creating duplicate events.

## Using idempotency keys

Send a unique value in the `Idempotency-Key` header, for example a UUID or your own internal record ID:

```bash
curl https://api.relay.dev/v2/events \
  -H "Authorization: Bearer rk_live_..." \
  -H "Idempotency-Key: order-8812-paid" \
  -d '{"type": "order.paid", "payload": {"id": "8812"}}'
```

If Relay already processed a request with the same key, it returns the original response instead of creating a new event. The response includes `Idempotent-Replayed: true`.

## Retention

Idempotency keys are stored for **24 hours**. After that, a request with the same key is treated as new.

## Conflicts

Reusing a key with a **different request body or path** returns `409 idempotency_key_reused`. Generate a new key whenever the request content changes. Keys are scoped to the account and mode, so the same key can be used in test and live mode independently.

## SDK support

The Node and Python SDKs generate an idempotency key automatically for every `POST` and reuse it across their built-in retries.
