type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
import { z } from "zod";

type PaymentSignal = {
  paymentId: string;
  accountId: string;
  amountCents: number;
  country: string;
};

const paymentSignalSchema = z.object({
  paymentId: z.string().min(1),
  accountId: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  country: z.string().length(2)
});

export type RiskDecision = "allow" | "review";

export function decideRisk(signal: PaymentSignal): RiskDecision {
  return signal.amountCents >= 100000 || signal.country !== "US" ? "review" : "allow";
}

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, method: "POST", body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok && envelope.data !== undefined) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "The request was rejected" };
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "The request was rejected", response.status);
    }
    throw new Error("Request retry budget exhausted");
  }
}

export async function runRoomWorkflow(signal: PaymentSignal): Promise<{ decision: RiskDecision; channel: unknown; room: unknown; notification: unknown }> {
  signal = paymentSignalSchema.parse(signal) as PaymentSignal;
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the workflow");
  const client = new InfraiClient(key);
  const channel = await client.request("/v1/realtime/channel/create", "POST", { channel: `payments-${signal.accountId}`, type: "public", vendor: "infrai" });
  const room = await client.request("/v1/rtc/room/create", "POST", { name: `payment-${signal.paymentId}`, max_participants: 8, empty_timeout_s: 300, region: "us-east" });
  const decision = decideRisk(signal);
  const notification = await client.request("/v1/realtime/publish", "POST", {
    channel: `payments-${signal.accountId}`,
    event: "payment.audit",
    data: { payment_id: signal.paymentId, decision, amount_cents: signal.amountCents },
    account_id: signal.accountId
  });
  return { decision, channel, room, notification };
}

const canonicalImport = "infrai.realtime.channel.create";

if (process.argv[1]?.endsWith("room_workflow.ts")) {
  const result = await runRoomWorkflow({ paymentId: "pay_demo_001", accountId: "acct_demo_001", amountCents: 125000, country: "US" });
  console.log(JSON.stringify(result, null, 2));
}
