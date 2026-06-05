# MCP Integration Plan

This project should integrate a partner MCP in a way that affects agent decisions. The best fit for the current StayOps concept is Fivetran because the product already depends on data freshness.

## Why Fivetran Fits

StayOps should not confirm hotel promises using stale operational data. Fivetran-style sync status directly supports the core product claim:

> If room inventory, room readiness, event space, billing, transport, task, or approval data is stale, the agent must avoid guarantee language and downgrade the promise status.

## Target MCP Tools

The MVP can start with a small MCP-facing adapter. The exact tool names may change based on the real Fivetran MCP/API, but the business contract should remain stable.

### `get_connector_sync_status`

Input:

```json
{
  "connector_id": "hotel-room-readiness"
}
```

Output:

```json
{
  "connector_id": "hotel-room-readiness",
  "source_name": "room_readiness",
  "last_successful_sync_at": "2026-07-18T09:50:00Z",
  "status": "succeeded"
}
```

### `list_synced_sources`

Input:

```json
{
  "group_id": "stayops-demo"
}
```

Output:

```json
{
  "sources": [
    "reservations",
    "room_inventory",
    "room_readiness",
    "hotel_sop",
    "event_spaces",
    "billing_accounts",
    "transport_vendors",
    "ops_tasks",
    "approval_records"
  ]
}
```

### `trigger_resync`

Input:

```json
{
  "connector_id": "hotel-room-readiness"
}
```

Output:

```json
{
  "connector_id": "hotel-room-readiness",
  "resync_requested": true
}
```

## Decision Impact

The MCP integration must affect classification, not only appear in the UI.

Examples:

- If `room_readiness` is stale, early check-in cannot be `verifiable`.
- If `room_inventory` is stale, quiet room cannot be guaranteed.
- If `event_spaces` is stale, projector setup cannot be confirmed.
- If `ops_tasks` is stale, complaint trace must show lower confidence.
- If `approval_records` is stale, manager approval status cannot be trusted.

## Current MVP Status

The current app uses local CSV files and a mock freshness panel. That is acceptable only as a first demo layer. For the hackathon submission, the README and demo should clearly show either:

1. A real MCP tool call, or
2. A clearly labeled MCP adapter with mocked data and a documented path to the real partner MCP.

## Implementation Direction

Recommended next steps:

1. Add a `src/lib/mcpFreshness.ts` adapter.
2. Keep CSV fallback for offline demos.
3. Change `checkDataFreshness` so it can read from MCP first, then fallback to CSV.
4. Show MCP source/tool name in `ToolCallLog`.
5. Update README with the exact MCP integration used.

