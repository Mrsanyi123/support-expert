# Rate limits

Relay limits how many API requests each account can make so the platform stays fast for everyone.

## Limits

| Mode | Limit |
| --- | --- |
| Live mode | 100 requests per second per account |
| Test mode | 25 requests per second per account |

Short bursts up to twice the limit are allowed for a few seconds. Limits are shared across all API keys in the same account and mode.

## When you hit the limit

Requests over the limit return `429 rate_limited` with a `Retry-After` header that tells you how many seconds to wait. The official SDKs retry `429` responses automatically with backoff, up to 3 times.

## Reducing request volume

- Use `POST /v2/events/batch` to send up to 100 events in one request.
- Cache endpoint and event-type lookups instead of fetching them on every event.
- Spread scheduled jobs instead of running them all at the top of the hour.

## Higher limits

Scale plan accounts can request higher live-mode limits by contacting their account manager.
