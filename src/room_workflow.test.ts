import { decideRisk } from "./room_workflow.ts";

const decision = decideRisk({ paymentId: "pay_test_001", accountId: "acct_test_001", amountCents: 125000, country: "US" });
if (decision !== "review") throw new Error(`Expected review, received ${decision}`);

const ordinary = decideRisk({ paymentId: "pay_test_002", accountId: "acct_test_001", amountCents: 2500, country: "US" });
if (ordinary !== "allow") throw new Error(`Expected allow, received ${ordinary}`);

console.log("risk decisions pass");
