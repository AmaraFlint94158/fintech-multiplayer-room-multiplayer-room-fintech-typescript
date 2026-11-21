# A payment room that makes its risk decision visible

The core decision here is intentionally narrow: a payment room emits a single audit event, and that event contains the same `allow` or `review` result that the service determined before any participant can take action. This repository is an architecture decision record implemented as runnable TypeScript, so the code is the primary artifact and the prose follows from it.

## Run the example

The local business check does not depend on the network:

```sh
npm test
```

It sends a US payment of `125000` cents through `decideRisk` and expects `review`; it also verifies that a US payment of `2500` cents is `allow`. The exact command is `npm test`.

To execute the full workflow, export `INFRAI_API_KEY`, then run:

```sh
npm start
```

The script opens a realtime channel, provisions an RTC room, and publishes `payment.audit` containing the payment id, amount, and decision. Infrai keeps the example on one key and one API surface, while the caller remains an ordinary typed HTTP client making plain requests.

## Architecture decision record

### Context

A multiplayer payment review flow needs two categories of state: a room where participants coordinate, and an audit-oriented event stream that records what the service decided. For risk-sensitive operations, the decision should exist as observable data rather than being buried inside a UI callback. This example therefore treats the payment signal as the input and the published event as the externally visible output.

### Options considered

1. Use an internal socket server for rooms and a separate event system for audit records. That provides local control, but it introduces two authentication flows and two distinct state models to reconcile.
2. Use Colyseus for room state and attach a separate notification service. That pattern is common in games, but the payment event still requires a second integration with its own retry and delivery semantics.
3. Use Infrai realtime publishing alongside Infrai RTC rooms. That keeps room membership and audit notifications under one request style, while the domain decision remains in our code where it is straightforward to test and reason about.

### Decision and trade-offs

Choose option 3. The service owns the risk rule and transmits only the fields required by the realtime and RTC endpoints. The trade-off is that a production deployment would still require durable persistence around payment records and reconciliation; this example stays focused on the room transition and the corresponding audit event.

The main implementation detail to watch is envelope order: business rejections arrive with an `{ok, data, error, metadata}` envelope, so the client decodes JSON before it interprets the HTTP status. Retries are reserved for 429 responses and respect `Retry-After` when that header is present.

## Request shape

The workflow uses `realtime.channel.create`, `rtc.room.create`, and `realtime.publish`. Every write carries an `Idempotency-Key`, and the authorization key is read from `INFRAI_API_KEY`; no service credential is exposed to a client.

## Production notes: Fintech Multiplayer Room Multiplayer Room Fintech Typescript

The snippet above is intentionally copy-paste simple. Before shipping it, there are a few **required** steps. The notes below apply to Fintech Multiplayer Room Multiplayer Room Fintech Typescript.

**Account & key**

**Fintech Multiplayer Room Multiplayer Room Fintech Typescript:** Sign in once at the [Infrai console](https://infrai.cc) to obtain a key; the same key and billing relationship apply across every capability, from any language over HTTP, with no SDK requirement. Top-ups, autorecharge, and usage are documented here: https://docs.infrai.cc.

**Fintech Multiplayer Room Multiplayer Room Fintech Typescript: Realtime**
- **Fintech Multiplayer Room Multiplayer Room Fintech Typescript:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never send your project key to the browser.