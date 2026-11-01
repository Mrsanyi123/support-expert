# Authentication and API keys

Relay authenticates API requests with secret API keys sent in the `Authorization: Bearer <key>` header.

## Key types

- **Standard keys** have full access to the account in their mode (test or live).
- **Restricted keys** only have the scopes you select when creating them, for example `events:read`, `events:write`, `webhooks:read`, `webhooks:write`, `billing:read`. Use restricted keys for services that only need part of the API.

Create and manage keys in **Dashboard > Developers > API keys**.

## Rotating keys

Click **Roll key** to generate a replacement. You can keep the old key active for up to 7 days so you can deploy the new one without downtime. After the overlap period the old key stops working.

## Authentication errors

- `401 invalid_api_key`: the key is missing, malformed, revoked, or expired.
- `403 scope_insufficient`: the key is valid but a restricted key is missing a scope required by the endpoint. The error body lists the `required_scope`.
- `403 mode_mismatch`: you used a test key on a live-mode object or the reverse.

## Best practices

Never embed secret keys in client-side code or mobile apps. Store keys in a secrets manager and rotate them at least once a year or immediately if exposed.
