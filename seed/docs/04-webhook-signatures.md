# Verifying webhook signatures

Every delivery includes a `Relay-Signature` header so you can confirm the request came from Relay and was not modified.

## Header format

```
Relay-Signature: t=1717000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

`t` is the Unix timestamp when Relay signed the request. `v1` is an HMAC-SHA256 signature, hex encoded.

## How to verify

1. Read the **raw request body** exactly as received, before any JSON parsing.
2. Build the signed string: `{t}.{raw_body}`.
3. Compute HMAC-SHA256 of that string using your endpoint's signing secret (`whsec_...`).
4. Compare it to `v1` with a constant-time comparison.
5. Reject the request if `t` is more than **300 seconds** from your server's current time, to prevent replay attacks.

## Common mistakes

- Verifying a re-serialized body. Frameworks such as Express with `express.json()` parse and re-serialize the body, which changes whitespace and breaks the signature. Use the raw body, for example `express.raw({ type: 'application/json' })`.
- Using the wrong secret. Each endpoint has its own signing secret, and test and live endpoints have different secrets.
- Server clock drift. If your server clock is off by more than 5 minutes, valid signatures are rejected because of the timestamp check. Keep your clock synced with NTP.

## Rotating the signing secret

Rolling an endpoint secret keeps the previous secret valid for 24 hours. During that window Relay sends two `v1` values in the header, one per secret.
