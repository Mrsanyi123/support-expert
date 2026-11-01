# Getting started with Relay

Relay is a managed webhooks and event delivery platform. You send events to Relay through the API and Relay delivers them reliably to your customers' HTTP endpoints, with retries, signatures, logs and replay.

## Base URL and versions

All API requests go to `https://api.relay.dev/v2`. The `v1` API was retired on 2024-06-30 and returns `410 Gone`. Every request must use HTTPS; plain HTTP requests are rejected.

## Test mode and live mode

Every account has two environments. Test mode keys start with `rk_test_` and live mode keys start with `rk_live_`. Events sent with a test key are only delivered to endpoints created in test mode, and they do not count toward your plan's event quota. Data never crosses between modes.

## Sending your first event

```bash
curl https://api.relay.dev/v2/events \
  -H "Authorization: Bearer rk_test_..." \
  -H "Content-Type: application/json" \
  -d '{"type": "invoice.paid", "payload": {"id": "inv_123"}}'
```

A successful request returns `202 Accepted` with the event `id`. Delivery to endpoints happens asynchronously, usually within one second.

## Where to look next

- Authentication and API keys
- Creating webhook endpoints
- Verifying webhook signatures
- Rate limits
