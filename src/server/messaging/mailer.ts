// Adaptador Mailer (D39). Brevo con texto simple, sin píxel ni rastreo de enlaces. Plan B: Gmail API.

export interface OutgoingEmail {
  attemptId: string;
  to: string;
  subject: string;
  text: string;
  /** Enlace de baja en un clic (List-Unsubscribe). */
  unsubscribeUrl: string;
}

export interface SendResult {
  accepted: boolean;
  providerRef: string | null;
  raw: unknown;
}

export interface Mailer {
  send(email: OutgoingEmail): Promise<SendResult>;
}

export class BrevoMailer implements Mailer {
  constructor(private cfg: { apiKey: string; senderEmail: string; senderName: string; replyTo: string }) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.cfg.apiKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: this.cfg.senderEmail, name: this.cfg.senderName },
        to: [{ email: email.to }],
        replyTo: { email: this.cfg.replyTo },
        subject: email.subject,
        textContent: email.text,
        headers: {
          "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "X-Faro-Attempt": email.attemptId,
        },
        tags: ["faro"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = (await res.json().catch(() => null)) as { messageId?: string } | null;
    return { accepted: res.ok, providerRef: raw?.messageId ?? null, raw };
  }
}

/** Solo para tests. */
export class FakeMailer implements Mailer {
  sent: OutgoingEmail[] = [];
  constructor(private accept = true) {}
  async send(email: OutgoingEmail): Promise<SendResult> {
    this.sent.push(email);
    return { accepted: this.accept, providerRef: this.accept ? `fake-${this.sent.length}` : null, raw: null };
  }
}
