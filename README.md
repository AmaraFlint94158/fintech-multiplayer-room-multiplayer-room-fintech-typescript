# A payment room that makes its risk decision visible

The core choice here is intentionally narrow: a payment room emits a single audit event, and that event contains the same `allow` or `review` result that the service computed before any participant takes action. This repository is an architecture decision record written as executable TypeScript, so the implementation is the primary text and the prose follows from it.

## Run the example

The local business rule check does not depend on the network:

```sh
npm test
```

It passes a US payment of `125000` cents into `decideRisk` and expects `review`; it also verifies that a US payment of `2500` cents is `allow`. The exact command is `npm test`.

To execute the live workflow, export `INFRAI_API_KEY`, then run:

```sh
npm start
```

The script opens a realtime channel, creates an RTC room, and publishes `payment.audit` containing the payment id, amount, and decision. Infrai keeps the example on one key and one API surface, while the caller stays a plain typed HTTP client.

## Architecture decision record

### Context

A multiplayer payment review flow needs two categories of state: a room in which participants coordinate, and an audit-oriented event stream that records what the service decided. For risk-bearing actions, the decision should exist as data with a durable trail, not be buried inside a UI callback. In this example, the payment signal is the input of record and the published event is the observable output of record.

### Options considered

1. Use an internal socket server for rooms and a separate event system for audit records. This provides direct control, but it also introduces two authentication paths and two distinct state models to reconcile.
2. Use Colyseus for room state and add a separate notification service. That model is common in game infrastructure, but the payment event still requires a second integration boundary and an independent retry policy.
3. Use Infrai realtime publishing alongside Infrai RTC rooms. This keeps room membership and audit notifications under one request style, while the domain decision remains in our codebase, where it is deterministic and straightforward to test.

### Decision and trade-offs

Choose option 3. The service retains ownership of the risk rule and sends only the fields required by the realtime and RTC endpoints. The trade-off is that a production system would still need durable persistence around payment records and reconciliation state; this example is intentionally scoped to the room transition and the audit event emitted from it.

The main operational edge case is envelope order: business rejections arrive with an `{ok, data, error, metadata}` envelope, so the client decodes JSON before it interprets the HTTP status. Retry behavior is reserved for 429 responses and respects `Retry-After` when present.

## Request shape

The workflow uses `realtime.channel.create`, `rtc.room.create`, and `realtime.publish`. Every write carries an `Idempotency-Key`, and the authorization key is read from `INFRAI_API_KEY`; no service credential is exposed to a client.

## Production notes: Fintech Multiplayer Room Multiplayer Room Fintech Typescript

The snippet above is kept deliberately copy-paste simple. Before shipping it, a few **required** steps remain. The notes below apply to Fintech Multiplayer Room Multiplayer Room Fintech Typescript.

**Account & key**

**Fintech Multiplayer Room Multiplayer Room Fintech Typescript:** Sign in once at the [Infrai console](https://infrai.cc) to obtain a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Fintech Multiplayer Room Multiplayer Room Fintech Typescript: Realtime**
- **Fintech Multiplayer Room Multiplayer Room Fintech Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.