# Errors reference

Relay uses conventional HTTP status codes. Error responses have a JSON body with `code`, `message`, and sometimes `param` or `required_scope`.

## API errors

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | A parameter is missing or invalid. See `param`. |
| 401 | `invalid_api_key` | The API key is missing, malformed, or revoked. |
| 402 | `payment_required` | The account is paused because of an unpaid invoice. |
| 403 | `scope_insufficient` | A restricted key lacks the scope in `required_scope`. |
| 403 | `mode_mismatch` | Test key used on a live object or the reverse. |
| 404 | `resource_missing` | The object does not exist in this mode. |
| 409 | `idempotency_key_reused` | The idempotency key was used with a different request. |
| 410 | `api_version_retired` | The request used the retired v1 API. |
| 413 | `payload_too_large` | The event payload is over 256 KB. |
| 429 | `rate_limited` | Too many requests. Respect `Retry-After`. |
| 5xx | `api_error` | Something went wrong on Relay's side. Retry with backoff. |

## Delivery attempt errors

These appear in the endpoint attempt log, not as API responses:

- `timeout`: the endpoint did not respond within 10 seconds.
- `connection_refused` or `dns_error`: Relay could not reach the endpoint host.
- `tls_error`: the endpoint certificate is invalid.
- `non_2xx`: the endpoint responded with a status outside 200-299. The response body is stored with the attempt.
