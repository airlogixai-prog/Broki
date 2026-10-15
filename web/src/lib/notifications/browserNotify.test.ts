import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectNotifiable, throttleNotifications } from "./browserNotify.ts";
import type { CriticalAlert } from "../alerts/buildCriticalAlerts.ts";

const alert = (over: Partial<CriticalAlert>): CriticalAlert => ({ id: "x", type: "fuel", priority: "high", title: "t", message: "m", ...over });

describe("browser notifications", () => {
  it("notifies frost, incidents and fuel under 10 % only", () => {
    const out = selectNotifiable([
      alert({ id: "weather-freeze", type: "weather" }),
      alert({ id: "incident-A", type: "incident", itemId: "A" }),
      alert({ id: "fuel-B", type: "fuel", message: "Van · 8% restante", itemId: "B" }),
      alert({ id: "fuel-C", type: "fuel", message: "Van · 20% restante", itemId: "C" }),
      alert({ id: "inoperative-D", type: "inoperative" }),
    ]);
    assert.deepEqual(out.map((c) => c.key), ["weather-freeze", "incident-A", "fuel-B"]);
  });

  it("throttles each key to once per minute", () => {
    const c = [{ key: "a", title: "", body: "" }, { key: "b", title: "", body: "" }];
    const first = throttleNotifications(c, {}, 1000);
    assert.equal(first.fire.length, 2);
    const second = throttleNotifications(c, first.lastFired, 30_000);
    assert.equal(second.fire.length, 0);
    const third = throttleNotifications(c, second.lastFired, 61_001);
    assert.equal(third.fire.length, 2);
  });
});
