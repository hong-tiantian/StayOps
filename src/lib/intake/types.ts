export type IntakeSource = "seed_csv" | "gmail" | "manual_paste";

export interface IntakeMessage {
  source: IntakeSource;
  external_id?: string;
  thread_id?: string;
  sender?: string;
  recipients?: string[];
  subject?: string;
  received_at?: string;
  body_text: string;
}

export interface GmailThreadSummary {
  thread_id: string;
  subject?: string;
  sender?: string;
  received_at?: string;
  snippet?: string;
}

export type GmailAdapterResult<T> =
  | { ok: true; source: "gmail"; data: T }
  | {
      ok: false;
      source: "gmail";
      status: "not_configured" | "not_implemented";
      reason: string;
      required_env: string[];
    };
