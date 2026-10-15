import assert from "node:assert/strict";
import { realtimeChannelKey } from "./channelKey.ts";

assert.equal(
  realtimeChannelKey(["broki_planner_tasks", "broki_planner_groups"]),
  "broki_planner_groups|broki_planner_tasks",
);
assert.equal(
  realtimeChannelKey(["broki_assets", "broki_assets"]),
  "broki_assets",
);
console.log("channelKey ok");
