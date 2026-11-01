# Python SDK

The official Python library is `relay-python`. It supports Python 3.9 and later.

## Installation

```bash
pip install relay-python
```

## Synchronous client

```python
import relay

client = relay.Client(api_key="rk_live_...")
client.events.create(type="invoice.paid", payload={"id": "inv_123"})
```

## Async client

`relay.AsyncClient` exposes the same methods as coroutines and uses `httpx` under the hood.

```python
client = relay.AsyncClient(api_key="rk_live_...")
await client.events.create(type="invoice.paid", payload={"id": "inv_123"})
```

## Verifying webhooks

```python
event = relay.Webhook.verify(payload=request.body, header=request.headers["Relay-Signature"], secret=WEBHOOK_SECRET)
```

Pass the raw request bytes. In Django use `request.body`; in Flask use `request.get_data()`; in FastAPI use `await request.body()`.

## Configuration

Set `timeout` (default 30 seconds) and `max_retries` (default 3) on the client. Enable debug logging with `RELAY_LOG=debug`.
