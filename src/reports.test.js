import { describe, expect, it } from "vitest";
import { filterBySchedule, issuesCsv, istDay, reportRange } from "./reports";
import { defaultSchedule, parseSchedule, toScheduleInput } from "./schedule";

describe("Scheduled issue reports in IST", () => {
  const now = new Date("2026-11-19T18:45:00Z");
  const today = reportRange({ preset: "today" }, now);
  it("uses IST calendar dates and seven inclusive calendar days", () => {
    expect(istDay(now)).toBe("2026-11-20");
    expect(today).toEqual({ from: "2026-11-20", to: "2026-11-20" });
    expect(reportRange({ preset: "week" }, now)).toEqual({
      from: "2026-11-14",
      to: "2026-11-20",
    });
  });
  it("includes overnight work but excludes unscheduled tasks and tasks ending exactly at midnight", () => {
    const tasks = [
      {
        id: "overnight",
        starts_at: "2026-11-19T22:00:00+05:30",
        ends_at: "2026-11-20T02:00:00+05:30",
        created_at: "2026-11-01T00:00:00Z",
      },
      {
        id: "ends-at-midnight",
        starts_at: "2026-11-19T22:00:00+05:30",
        ends_at: "2026-11-20T00:00:00+05:30",
      },
      {
        id: "tomorrow",
        starts_at: "2026-11-21T00:00:00+05:30",
        ends_at: "2026-11-21T01:00:00+05:30",
      },
      { id: "unscheduled", created_at: now.toISOString() },
    ];
    expect(filterBySchedule(tasks, today).map((task) => task.id)).toEqual([
      "overnight",
    ]);
    expect(filterBySchedule(tasks, null)).toHaveLength(4);
  });
  it("includes any schedule overlapping a custom range and rejects an invalid range", () => {
    const task = {
      starts_at: "2026-11-10T10:00:00+05:30",
      ends_at: "2026-11-12T10:00:00+05:30",
    };
    expect(
      filterBySchedule([task], { from: "2026-11-11", to: "2026-11-11" }),
    ).toHaveLength(1);
    expect(
      filterBySchedule([task], { from: "2026-11-12", to: "2026-11-10" }),
    ).toEqual([]);
    expect(filterBySchedule([task], { from: "", to: "" })).toEqual([]);
  });
  it("exports exact issue values, schedule and safely quotes notes and formulas", () => {
    const csv = issuesCsv(
      [
        {
          id: "one",
          title: "=SUM(A1)",
          scope: "UI",
          starts_at: "2026-11-20T08:00:00+05:30",
          ends_at: "2026-11-20T09:00:00+05:30",
          description: 'Line one, "quoted"\nline two',
        },
      ],
      [],
    );
    expect(csv).toContain("Starts (IST)");
    expect(csv).toContain('"\'=SUM(A1)"');
    expect(csv).toContain('"Line one, ""quoted""\nline two"');
    expect(csv).toContain("20 Nov 2026");
  });
});

describe("Schedule form values", () => {
  it("round trips IST input independently of the browser time zone", () => {
    expect(toScheduleInput("2026-11-19T18:45:00Z")).toBe("2026-11-20T00:15");
    expect(parseSchedule("2026-11-20T00:15", "2026-11-20T01:15")).toEqual({
      starts_at: "2026-11-19T18:45:00.000Z",
      ends_at: "2026-11-19T19:45:00.000Z",
    });
  });
  it("requires both times and a later end, while allowing an unscheduled issue", () => {
    expect(parseSchedule("", "")).toEqual({ starts_at: null, ends_at: null });
    expect(() => parseSchedule("2026-11-20T00:15", "")).toThrow("both");
    expect(() => parseSchedule("2026-11-20T00:15", "2026-11-20T00:15")).toThrow(
      "after",
    );
    expect(() => parseSchedule("2026-11-20T01:15", "2026-11-20T00:15")).toThrow(
      "after",
    );
  });
  it("defaults a new issue to the current day even near midnight", () => {
    expect(defaultSchedule("2026-11-20T23:59:59+05:30")).toEqual({
      starts_at: "2026-11-20T23:59",
      ends_at: "2026-11-21T00:59",
    });
  });
});
