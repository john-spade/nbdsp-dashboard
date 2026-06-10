import { describe, expect, it } from "vitest";
import { can, defaultRouteFor, isRole, permissionForPath } from "./rbac";

describe("can()", () => {
  it("grants admin everything checked", () => {
    expect(can("admin", "page:admin")).toBe(true);
    expect(can("admin", "patient:write")).toBe(true);
    expect(can("admin", "patient:edit")).toBe(true);
    expect(can("admin", "audit:read")).toBe(true);
    expect(can("admin", "analytics:export")).toBe(true);
    expect(can("admin", "ingestion:run")).toBe(true);
  });

  it("lets encoder read/write/edit patients but not analytics export or admin", () => {
    expect(can("encoder", "patient:read")).toBe(true);
    expect(can("encoder", "patient:write")).toBe(true);
    expect(can("encoder", "patient:edit")).toBe(true);
    expect(can("encoder", "dashboard:read")).toBe(true);
    expect(can("encoder", "analytics:export")).toBe(false);
    expect(can("encoder", "analytics:read")).toBe(false);
    expect(can("encoder", "user:manage")).toBe(false);
    expect(can("encoder", "ingestion:run")).toBe(false);
    expect(can("encoder", "audit:read")).toBe(false);
  });

  it("limits analyst to read + analytics (incl. export), no writes", () => {
    expect(can("analyst", "patient:read")).toBe(true);
    expect(can("analyst", "analytics:read")).toBe(true);
    expect(can("analyst", "analytics:export")).toBe(true);
    expect(can("analyst", "page:reports")).toBe(true);
    expect(can("analyst", "patient:write")).toBe(false);
    expect(can("analyst", "patient:edit")).toBe(false);
    expect(can("analyst", "user:manage")).toBe(false);
  });

  it("restricts viewer to dashboard + aggregate analytics only", () => {
    expect(can("viewer", "dashboard:read")).toBe(true);
    expect(can("viewer", "analytics:read")).toBe(true);
    expect(can("viewer", "patient:read")).toBe(false);
    expect(can("viewer", "patient:write")).toBe(false);
    expect(can("viewer", "analytics:export")).toBe(false);
    expect(can("viewer", "page:reports")).toBe(false);
  });

  it("denies an undefined role", () => {
    expect(can(undefined, "patient:read")).toBe(false);
  });
});

describe("isRole()", () => {
  it("recognizes valid roles only", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("encoder")).toBe(true);
    expect(isRole("analyst")).toBe(true);
    expect(isRole("viewer")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(123)).toBe(false);
  });
});

describe("defaultRouteFor()", () => {
  it("routes each role to its landing page", () => {
    expect(defaultRouteFor("admin")).toBe("/admin");
    expect(defaultRouteFor("encoder")).toBe("/patients");
    expect(defaultRouteFor("analyst")).toBe("/dashboard");
    expect(defaultRouteFor("viewer")).toBe("/dashboard");
  });
});

describe("permissionForPath()", () => {
  it("maps protected routes to the required permission", () => {
    expect(permissionForPath("/patients/new")).toBe("patient:write");
    expect(permissionForPath("/patients/NBD-2026-00001/edit")).toBe("patient:edit");
    expect(permissionForPath("/patients/NBD-2026-00001")).toBe("patient:read");
    expect(permissionForPath("/patients")).toBe("patient:read");
    expect(permissionForPath("/reports")).toBe("page:reports");
    expect(permissionForPath("/admin/users")).toBe("page:admin");
    expect(permissionForPath("/dashboard")).toBe("dashboard:read");
  });

  it("returns null for unguarded paths", () => {
    expect(permissionForPath("/login")).toBeNull();
  });
});
