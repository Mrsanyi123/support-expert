# Node.js SDK

The official Node.js library is `@relay/node`. It supports Node.js 18 and later.

## Installation

```bash
npm install @relay/node
```

## Usage

```js
import Relay from '@relay/node';

const relay = new Relay(process.env.RELAY_API_KEY);

await relay.events.create({ type: 'invoice.paid', payload: { id: 'inv_123' } });
```

## Verifying webhooks

```js
app.post('/webhooks/relay', express.raw({ type: 'application/json' }), (req, res) => {
  const event = relay.webhooks.verify(req.body, req.headers['relay-signature'], process.env.RELAY_WEBHOOK_SECRET);
  // handle event
  res.sendStatus(200);
});
```

`verify` throws `RelaySignatureError` if the signature or timestamp is invalid. Pass the raw body as a `Buffer` or string.

## Versions

- **v3** is the current major version and receives new features.
- **v2** receives security fixes only until 2025-12-31. See the migration guide: `relay.events.send()` became `relay.events.create()`, and `verifyWebhook()` moved to `relay.webhooks.verify()`.

## Retries and timeouts

The client retries network errors and `429`/`5xx` responses up to 3 times. The default request timeout is 30 seconds and can be changed with `new Relay(key, { timeout: 10000 })`.
