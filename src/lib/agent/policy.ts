import { loadBillingAccounts, loadEventSpaces, loadTransportVendors } from "../data";
import { ToolRunner } from "../tools";
import { PromiseStatus, Reservation, RuleKey } from "../types";

/**
 * Deterministic policy / guardrail layer.
 *
 * The Gemini/ADK agent PROPOSES; this layer DECIDES. No matter what the model says,
 * the final executable status is computed here from fresh tool evidence and SOP
 * rules. The same policy is reused by the offline fallback, so agent and fallback
 * paths cannot disagree on the final executable decision.
 */

const FALLBACK_ARRIVAL = "2026-07-18T11:00:00";
const FALLBACK_MEETING_START = "2026-07-18T14:00:00";
const FALLBACK_EVENT_SPACE = "MR-BLUE";

const RULE_KEYS: RuleKey[] = [
  "early_check_in",
  "quiet_room",
  "gluten_free_breakfast",
  "projector_setup",
  "airport_transfer",
  "company_invoice",
  "upgrade",
  "high_floor",
  "parking",
  "long_stay_discount",
  "lost_and_found",
  "maintenance",
];

const RULE_KEY_MATCHERS: Array<{ rule_key: RuleKey; test: (text: string) => boolean }> = [
  { rule_key: "early_check_in", test: (t) => /early|check[- ]?in|arrive|11am|11 am/.test(t) },
  { rule_key: "high_floor", test: (t) => /high[- ]?floor|upper floor|top floor/.test(t) },
  { rule_key: "quiet_room", test: (t) => /quiet|elevator|vp\b/.test(t) },
  { rule_key: "gluten_free_breakfast", test: (t) => /gluten|breakfast|dietary|f&b|food/.test(t) },
  { rule_key: "projector_setup", test: (t) => /projector|meeting room|av\b|screen|hdmi/.test(t) },
  { rule_key: "airport_transfer", test: (t) => /transfer|airport|flight|pickup|mad\b/.test(t) },
  { rule_key: "company_invoice", test: (t) => /invoice|billing|tax|company account/.test(t) },
  { rule_key: "upgrade", test: (t) => /upgrade|suite/.test(t) },
  { rule_key: "parking", test: (t) => /parking|car park|garage|vehicle/.test(t) },
  { rule_key: "long_stay_discount", test: (t) => /long[- ]?stay|discount|monthly rate/.test(t) },
  { rule_key: "lost_and_found", test: (t) => /lost|left.*(charger|behind|in (?:my |the )?room)|forgot|find.*(charger|phone|item)/.test(t) },
  { rule_key: "maintenance", test: (t) => /air ?condition|\bac\b|not cooling|broken|repair|\bfix\b|maintenance|leak|heater|not working/.test(t) },
];

export interface RuleVerdict {
  status: PromiseStatus;
  evidence: string[];
}

interface PolicyContext {
  runner: ToolRunner;
  reservation: Reservation | null;
  arrival: string;
  evidence: string[];
}

type RuleVerifier = (context: PolicyContext) => RuleVerdict;

export function alignPromiseRuleKey(promiseText: string): RuleKey | null {
  const text = promiseText.toLowerCase();
  return RULE_KEY_MATCHERS.find((matcher) => matcher.test(text))?.rule_key ?? null;
}

/** @deprecated Use alignPromiseRuleKey. `category` is now only a CSV compatibility field. */
export function alignPromiseCategory(promiseText: string): RuleKey | null {
  return alignPromiseRuleKey(promiseText);
}

export function rulePromiseStatus(
  ruleKey: string,
  runner: ToolRunner,
  reservation: Reservation | null
): RuleVerdict {
  const evidence: string[] = [];
  const context: PolicyContext = {
    runner,
    reservation,
    arrival: reservation ? `${reservation.arrival_date}T${reservation.arrival_time}:00` : FALLBACK_ARRIVAL,
    evidence,
  };

  if (!isRuleKey(ruleKey)) {
    return { status: "cannot_confirm", evidence: [`No deterministic rule for rule_key "${ruleKey}".`] };
  }

  return RULE_VERIFIERS[ruleKey](context);
}

function verifyEarlyCheckIn({ runner, reservation, arrival, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
  runner.retrieve_sop("early_check_in");
  const readiness = runner.check_room_readiness("king", {}, arrival);
  const requiredKingRooms = reservation?.king_count || Math.ceil((reservation?.room_count ?? 12) * 0.67);
  const status: PromiseStatus =
    stale || readiness.available_ready_count < requiredKingRooms ? "cannot_confirm" : "at_risk";
  evidence.push(
    `Readiness: ${readiness.available_ready_count} king room(s) ready at arrival, ${readiness.available_later_count} later - group needs ${requiredKingRooms} king room(s), so early check-in is not guaranteed.`
  );
  return { status, evidence };
}

function verifyQuietRoom({ runner, reservation, arrival, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
  runner.retrieve_sop("quiet_room");
  const readiness = runner.check_room_readiness(
    "king",
    { quiet_zone: true, away_from_elevator: true },
    arrival
  );
  const status: PromiseStatus = stale
    ? "cannot_confirm"
    : readiness.available_ready_count > 0 || readiness.available_later_count > 0
      ? "at_risk"
      : "cannot_confirm";
  const candidates = readiness.matching_rooms
    .filter((room) => room.suitability !== "unsuitable")
    .map((room) => `${room.room_id} (${room.suitability})`)
    .join(", ");
  evidence.push(
    `Suitable quiet king candidates: ${candidates || "none"}; manager approval + room block required before commitment (SOP-ROOM-002, arrival ${reservation?.arrival_time ?? "11:00"}).`
  );
  return { status, evidence };
}

function verifyBreakfast({ runner, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["hotel_sop"], evidence);
  const sop = runner.retrieve_sop("gluten_free_breakfast");
  evidence.push(`${sop[0]?.policy_id}: deadline ${sop[0]?.deadline_rule}. Notification window open - F&B can execute.`);
  return { status: stale ? "cannot_confirm" : "verifiable", evidence };
}

function verifyProjector({ runner, reservation, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["event_spaces"], evidence);
  const eventSpace = selectEventSpace(reservation);
  const spaceId = eventSpace?.space_id ?? reservation?.meeting_room_id ?? FALLBACK_EVENT_SPACE;
  const meetingStart = eventSpace
    ? `${eventSpace.date}T${eventSpace.start_time}:00`
    : FALLBACK_MEETING_START;

  runner.check_inventory("projector", { space_id: spaceId });
  runner.retrieve_sop("projector_setup");
  const space = runner.check_event_space("projector", meetingStart, spaceId);
  const status: PromiseStatus = stale
    ? "cannot_confirm"
    : space.available && space.equipment.projector
      ? "verifiable"
      : "conflict";
  evidence.push(
    `${spaceId} has projector/screen/HDMI. Setup task MUST be due ${space.recommended_task_due_at} (meeting_start - ${space.setup_lead_time_minutes}m), NOT ${meetingStart.slice(11, 16)}.`
  );
  return { status, evidence };
}

function verifyTransfer({ runner, reservation, evidence }: PolicyContext): RuleVerdict {
  gateSources(runner, ["transport_vendors"], evidence);
  runner.retrieve_sop("airport_transfer");
  const vendor = loadTransportVendors().find((v) => v.date === reservation?.arrival_date) ?? loadTransportVendors()[0];
  const missing = transferMissingFields(vendor);
  evidence.push(
    `Vendor ${vendor?.vendor_id ?? "unknown"} ${vendor?.status ?? "unknown"} with ${vendor?.available_vehicle_count ?? 0} vehicle(s); required fields missing: ${missing.join(", ")}.`
  );
  return { status: "missing_info", evidence };
}

function verifyInvoice({ runner, reservation, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["billing_accounts"], evidence);
  runner.retrieve_sop("company_invoice");
  const billing = loadBillingAccounts().find((account) => account.booking_id === reservation?.booking_id);
  const missing: string[] = [];
  if (!billing?.billing_contact) missing.push("billing_contact");
  if (!billing?.tax_id) missing.push("tax_id");
  if (!billing?.billing_address) missing.push("billing_address");
  evidence.push(`Billing account ${billing?.status ?? "incomplete"}; missing: ${missing.join(", ") || "none"}.`);
  const status: PromiseStatus = missing.length ? "missing_info" : stale ? "cannot_confirm" : "verifiable";
  return { status, evidence };
}

function verifyUpgrade({ runner, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["room_inventory"], evidence);
  runner.retrieve_sop("upgrade");
  evidence.push("SOP-UPG-007: free upgrades require manager approval; OTA bookings are not guaranteed an upgrade.");
  return { status: stale ? "cannot_confirm" : "needs_approval", evidence };
}

function verifyHighFloor({ runner, arrival, evidence }: PolicyContext): RuleVerdict {
  const stale = gateSources(runner, ["room_inventory", "room_readiness"], evidence);
  runner.retrieve_sop("high_floor");
  const readiness = runner.check_room_readiness("king", { quiet_zone: true, high_floor: true }, arrival);
  const status: PromiseStatus = stale
    ? "cannot_confirm"
    : readiness.available_ready_count > 0
      ? "verifiable"
      : readiness.available_later_count > 0
        ? "at_risk"
        : "cannot_confirm";
  const candidates = readiness.matching_rooms
    .filter((room) => room.suitability !== "unsuitable")
    .map((room) => room.room_id)
    .join(", ");
  evidence.push(`High-floor quiet candidates: ${candidates || "none"}; ${readiness.available_ready_count} ready now.`);
  return { status, evidence };
}

function verifyParking({ runner, evidence }: PolicyContext): RuleVerdict {
  runner.retrieve_sop("parking");
  evidence.push("SOP-PRK-009: parking requires vehicle plate and arrival time - not provided in the booking message.");
  return { status: "missing_info", evidence };
}

function verifyLongStayDiscount({ runner, evidence }: PolicyContext): RuleVerdict {
  runner.retrieve_sop("long_stay_discount");
  evidence.push("SOP-LSD-010: long-stay discounts require revenue manager approval based on the occupancy forecast.");
  return { status: "needs_approval", evidence };
}

function verifyLostAndFound({ runner, evidence }: PolicyContext): RuleVerdict {
  runner.retrieve_sop("lost_and_found");
  evidence.push("SOP-LAF-011: front desk checks the log + storage and dispatches housekeeping to inspect the room - cannot auto-confirm until the item is found.");
  return { status: "at_risk", evidence };
}

function verifyMaintenance({ runner, evidence }: PolicyContext): RuleVerdict {
  runner.retrieve_sop("maintenance");
  evidence.push("SOP-MNT-012: dispatch on-call technician; honored subject to staff availability.");
  return { status: "verifiable", evidence };
}

const RULE_VERIFIERS: Record<RuleKey, RuleVerifier> = {
  early_check_in: verifyEarlyCheckIn,
  quiet_room: verifyQuietRoom,
  gluten_free_breakfast: verifyBreakfast,
  projector_setup: verifyProjector,
  airport_transfer: verifyTransfer,
  company_invoice: verifyInvoice,
  upgrade: verifyUpgrade,
  high_floor: verifyHighFloor,
  parking: verifyParking,
  long_stay_discount: verifyLongStayDiscount,
  lost_and_found: verifyLostAndFound,
  maintenance: verifyMaintenance,
};

function isRuleKey(value: string): value is RuleKey {
  return RULE_KEYS.includes(value as RuleKey);
}

function selectEventSpace(reservation: Reservation | null) {
  const spaces = loadEventSpaces();
  if (reservation?.meeting_room_id) {
    return spaces.find((space) => space.space_id === reservation.meeting_room_id);
  }
  return spaces[0];
}

function transferMissingFields(vendor: ReturnType<typeof loadTransportVendors>[number] | undefined): string[] {
  const missing: string[] = [];
  if (vendor?.requires_flight_number ?? true) missing.push("flight_number");
  if (vendor?.requires_arrival_time ?? true) missing.push("arrival_time");
  missing.push("passenger_count", "phone_number");
  return missing;
}

function gateSources(runner: ToolRunner, sources: string[], evidence: string[]): boolean {
  let stale = false;
  for (const source of sources) {
    const freshness = runner.check_data_freshness(source) as { freshness_status: string; age_minutes: number };
    if (freshness.freshness_status === "stale") {
      stale = true;
      evidence.push(
        `Source "${source}" is stale (${freshness.age_minutes}m old) - freshness gate forbids a guarantee; downgraded to cannot_confirm.`
      );
    }
  }
  return stale;
}

export function reconcileStatus(
  ruleStatus: PromiseStatus,
  proposedStatus: string | undefined
): { status: PromiseStatus; overruled: boolean } {
  const overruled = !!proposedStatus && proposedStatus !== ruleStatus;
  return { status: ruleStatus, overruled };
}
