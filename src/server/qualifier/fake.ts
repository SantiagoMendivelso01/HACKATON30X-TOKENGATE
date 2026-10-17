// FakeQualifier: SOLO para tests automatizados (D43). Nunca se importa desde código de producción.
import { parseDaptaWebhook } from "./dapta";
import type { CallRequest, Qualifier } from "./qualifier";

export class FakeQualifier implements Qualifier {
  calls: { kind: "callNow" | "enqueue"; input: CallRequest }[] = [];
  constructor(private accept = true) {}

  async callNow(input: CallRequest) {
    this.calls.push({ kind: "callNow", input });
    return { accepted: this.accept, raw: { fake: true } };
  }

  async enqueue(input: CallRequest) {
    this.calls.push({ kind: "enqueue", input });
    return { accepted: this.accept, raw: { fake: true } };
  }

  parseResult(raw: unknown) {
    return parseDaptaWebhook(raw);
  }
}
