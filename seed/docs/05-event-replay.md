# Replaying events

Replay re-sends events that already exist in Relay to one of your endpoints, for example after an outage on your side.

## Replay window

Events can be replayed for **30 days** after they were created. After 30 days the event is no longer available for replay through the dashboard or the API.

## Replay a single event

In **Dashboard > Events**, open an event and click **Replay**, or call:

```bash
curl -X POST https://api.relay.dev/v2/events/evt_123/replay \
  -H "Authorization: Bearer rk_live_..." \
  -d '{"endpoint_id": "ep_456"}'
```

## Bulk replay

Use `POST /v2/events/replay` with `endpoint_id`, `from` and `to` timestamps, and an optional list of `types`. Bulk replays are processed in the background and you can follow progress under **Dashboard > Webhooks > Replays**. A single bulk replay can include up to 100,000 events.

Replayed deliveries use the same event `id` as the original, so idempotent consumers will safely skip events they already processed.

## Permissions

Replaying requires an API key with write access to events.
