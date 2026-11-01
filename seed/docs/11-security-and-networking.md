# Security and networking

## Delivery IP addresses

Relay delivers webhooks from a fixed set of IP ranges. If your endpoint sits behind a firewall, allow inbound HTTPS from:

- `34.120.15.0/28`
- `35.201.88.0/28`

The current list is also available as JSON at `https://api.relay.dev/v2/ips`. We announce changes to this list at least 30 days in advance on the status page.

## Request headers

Every delivery includes:

- `User-Agent: Relay-Webhooks/2.0`
- `Relay-Signature`, see Verifying webhook signatures
- `Relay-Event-Id` and `Relay-Event-Type`
- `Relay-Delivery-Attempt`, starting at 1

## TLS

Relay connects to endpoints over TLS 1.2 or 1.3 and validates certificates against public certificate authorities. Endpoints with expired, self-signed, or hostname-mismatched certificates fail with `tls_error` in the attempt log.

## Mutual TLS

On the Scale plan you can enable mTLS per endpoint. Relay then presents a client certificate issued by the Relay CA, which you can download from **Dashboard > Settings > Security**.

## Data security

Event payloads are encrypted at rest with AES-256. Relay is SOC 2 Type II certified; request the report from your account manager.
