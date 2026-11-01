# Webhook endpoints and delivery

A webhook endpoint is an HTTPS URL owned by you or your customer that receives events from Relay.

## Creating endpoints

Create endpoints in **Dashboard > Webhooks > Add endpoint** or with `POST /v2/endpoints`. Each endpoint subscribes to a list of event types, or `*` for all events. Endpoint URLs must use HTTPS with a valid public certificate; self-signed certificates are rejected.

## Delivery and timeouts

Relay sends each event as an HTTP `POST` with a JSON body. Your endpoint must respond with any `2xx` status within **10 seconds**. Any other status code, a timeout, or a connection error counts as a failed attempt. Redirects (`3xx`) are not followed and count as failures.

Respond quickly and do heavy processing asynchronously, for example by putting the event on a queue before returning `200`.

## Retries

Failed deliveries are retried with exponential backoff: after 1 minute, 5 minutes, 30 minutes, 2 hours, 5 hours, then every 10 hours, for up to **15 attempts over roughly 3 days**. You can see every attempt, its status code, and the response body in **Dashboard > Webhooks > Endpoint > Attempts**.

## Ordering and duplicates

Relay does not guarantee delivery order. Retries mean the same event can arrive more than once. Every event has a unique `id`; store processed IDs and ignore duplicates.

## Payload size

Event payloads are limited to 256 KB. Larger requests to `POST /v2/events` return `413 payload_too_large`.
