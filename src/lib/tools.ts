import {
  loadReservations,
  loadMessages,
  loadRoomInventory,
  loadRoomReadiness,
  loadEventSpaces,
  loadSop,
  addOpsTask,
  nextTaskId,
} from "./data";
import { checkDataFreshness, DEMO_NOW } from "./freshness";
import {
  Department,
  Message,
  OpsTask,
  PromiseStatus,
  Reservation,
  SopRule,
  ToolCall,
} from "./types";

/**
 * A ToolRunner records every tool invocation so the UI can show a visible,
 * deterministic tool-call log. All tools read from the synthetic CSV data.
 */
export class ToolRunner {
  calls: ToolCall[] = [];

  private record<T>(tool_name: string, input: unknown, output: T): T {
    this.calls.push({
      tool_name,
      input,
      output,
      called_at: DEMO_NOW,
    });
    return output;
  }

  check_data_freshness(source_name: string) {
    return this.record("check_data_freshness", { source_name }, checkDataFreshness(source_name));
  }

  get_reservation(booking_id: string): Reservation | null {
    const res = loadReservations().find((r) => r.booking_id === booking_id) ?? null;
    return this.record("get_reservation", { booking_id }, res);
  }

  search_messages(booking_id: string): Message[] {
    const msgs = loadMessages().filter((m) => m.booking_id === booking_id);
    return this.record("search_messages", { booking_id }, msgs);
  }

  check_room_readiness(
    room_type: string,
    constraints: { quiet_zone?: boolean; away_from_elevator?: boolean; high_floor?: boolean },
    arrival_time: string
  ) {
    const inv = loadRoomInventory().filter((r) => r.room_type === room_type);
    const readiness = loadRoomReadiness();
    const arrival = new Date(arrival_time).getTime();

    const matching_rooms = inv.map((room) => {
      const rd = readiness.find((x) => x.room_id === room.room_id);
      const ready = rd ? new Date(rd.estimated_ready_at).getTime() : Infinity;
      const meetsQuiet = constraints.quiet_zone ? room.quiet_zone : true;
      const meetsElevator = constraints.away_from_elevator ? !room.near_elevator : true;
      const meetsFloor = constraints.high_floor ? room.floor >= 4 : true;

      let suitability: "suitable" | "candidate_later" | "unsuitable";
      let reason: string;

      if (!meetsQuiet || !meetsElevator || !meetsFloor) {
        suitability = "unsuitable";
        const probs: string[] = [];
        if (!meetsQuiet) probs.push("not in quiet zone");
        if (!meetsElevator) probs.push("near elevator");
        if (!meetsFloor) probs.push("not on a high floor");
        reason = `Constraint not met: ${probs.join(", ")}.`;
      } else if (rd && rd.inspected && ready <= arrival) {
        suitability = "suitable";
        reason = `Inspected and ready at ${rd.estimated_ready_at}.`;
      } else {
        suitability = "candidate_later";
        reason = rd
          ? `Matches constraints but ${rd.clean_status}; ready ~${rd.estimated_ready_at} (after ${arrival_time}).`
          : "No readiness record.";
      }
      return {
        room_id: room.room_id,
        clean_status: rd?.clean_status ?? "unknown",
        estimated_ready_at: rd?.estimated_ready_at ?? "unknown",
        inspected: rd?.inspected ?? false,
        quiet_zone: room.quiet_zone,
        near_elevator: room.near_elevator,
        suitability,
        reason,
      };
    });

    const available_ready_count = matching_rooms.filter((r) => r.suitability === "suitable").length;
    const available_later_count = matching_rooms.filter(
      (r) => r.suitability === "candidate_later"
    ).length;

    let recommendation: "verifiable" | "at_risk" | "cannot_confirm";
    if (available_ready_count > 0) recommendation = "verifiable";
    else if (available_later_count > 0) recommendation = "at_risk";
    else recommendation = "cannot_confirm";

    return this.record(
      "check_room_readiness",
      { room_type, constraints, arrival_time },
      { matching_rooms, available_ready_count, available_later_count, recommendation }
    );
  }

  check_inventory(item_type: string, context?: { space_id?: string }) {
    // For projector, derive from event_spaces.
    if (item_type === "projector") {
      const spaces = loadEventSpaces();
      const space = context?.space_id
        ? spaces.find((s) => s.space_id === context.space_id)
        : spaces[0];
      const output = {
        item_type,
        available_count: space?.projector ? 1 : 0,
        reserved_count: space?.status?.startsWith("booked") ? 1 : 0,
        location: space?.space_id ?? "unknown",
      };
      return this.record("check_inventory", { item_type, ...context }, output);
    }
    const output = { item_type, available_count: 0, reserved_count: 0, location: "unknown" };
    return this.record("check_inventory", { item_type }, output);
  }

  retrieve_sop(promise_type: string): SopRule[] {
    const rules = loadSop().filter((s) => s.promise_type === promise_type);
    return this.record("retrieve_sop", { promise_type }, rules);
  }

  check_event_space(requirement: string, date_time: string, space_id: string) {
    const space = loadEventSpaces().find((s) => s.space_id === space_id);
    let recommended_task_due_at = "unknown";
    if (space) {
      const start = new Date(`${space.date}T${space.start_time}:00`);
      const due = new Date(start.getTime() - space.setup_lead_time_minutes * 60000);
      recommended_task_due_at = toLocalIso(due);
    }
    const output = {
      space_id,
      available: !!space,
      equipment: {
        projector: space?.projector ?? false,
        screen: space?.screen ?? false,
        hdmi_adapter: space?.hdmi_adapter ?? false,
      },
      setup_lead_time_minutes: space?.setup_lead_time_minutes ?? 0,
      recommended_task_due_at,
    };
    return this.record("check_event_space", { requirement, date_time, space_id }, output);
  }

  create_ops_task(
    department: Department,
    description: string,
    due_at: string,
    source_promise_id: string,
    booking_id = "BKG-2026-0718-ACME",
    owner = `${department}@hotel.test`
  ): OpsTask {
    const task: OpsTask = {
      task_id: nextTaskId(),
      booking_id,
      source_promise_id,
      department,
      description,
      due_at,
      status: "created",
      owner,
      completed_at: "",
    };
    addOpsTask(task);
    return this.record(
      "create_ops_task",
      { department, description, due_at, source_promise_id },
      task
    );
  }

  log_promise_decision(
    promise_id: string,
    status: PromiseStatus,
    evidence: string[],
    recommended_action: string
  ) {
    const output = { promise_id, logged: true, ledger_version: 1 };
    return this.record(
      "log_promise_decision",
      { promise_id, status, evidence, recommended_action },
      output
    );
  }
}

function toLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
