import { describe, expect, it } from "vitest";
import { validateObservations, validatePatients } from "./validate";

describe("validatePatients", () => {
  it("accepts valid resources and collects errors for invalid ones", () => {
    const result = validatePatients([
      { resourceType: "Patient", id: "P1", gender: "male" },
      { resourceType: "Patient", id: "" }, // invalid: empty id
      { resourceType: "Observation", id: "X" }, // invalid: wrong type
      { not: "a resource" }, // invalid
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].id).toBe("P1");
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].index).toBe(1);
  });

  it("passes through unknown extra fields", () => {
    const result = validatePatients([
      { resourceType: "Patient", id: "P1", extraField: { deeply: "nested" } },
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

describe("validateObservations", () => {
  it("requires code and subject", () => {
    const result = validateObservations([
      {
        resourceType: "Observation",
        id: "O1",
        status: "final",
        code: { text: "x" },
        subject: { reference: "Patient/P1" },
      },
      { resourceType: "Observation", id: "O2", status: "final" }, // missing code/subject
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });
});
