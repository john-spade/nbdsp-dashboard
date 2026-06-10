# FHIR Transformation Guide

## Why a transformation layer

Raw FHIR resources are deeply nested, heavily optional, and verbose. The UI and
Firestore should never see that shape. The transformation layer is the **single
boundary** that knows FHIR; everything else speaks flat, normalized models. This
isolation lets us swap the upstream FHIR source without touching the UI.

```
FHIR R4 resource  ──validate(zod)──►  valid resource  ──map──►  normalized model
(types.ts)          (validate.ts)                      (transform.ts)  (models.ts)
```

## The three resources

| FHIR | Normalized | Key mappings |
|---|---|---|
| `Patient` | `PatientRecord` | name[] → `fullName`; address.state → `region`; birthDate → `ageDays` |
| `Observation` | `ObservationRecord` | code.coding → `defectCode`/`defectLabel`; subject.reference → `patientId`; category → birth-defect group |
| `Encounter` | `EncounterRecord` | type → `type`; serviceProvider.display → `facility`; period → `start`/`end` |

## Design rules

1. **Never throw on missing/optional fields.** Surveillance feeds are partial;
   degrade to `null` + sensible defaults (e.g. `gender → "unknown"`,
   `name → "Unknown"`).
2. **Validate shape at the boundary, then map.** `validate.ts` uses Zod
   `.passthrough()` schemas that enforce only the required anchors
   (`resourceType`, `id`, key references) and **collect** per-item errors
   instead of aborting the batch.
3. **Pure, testable functions.** Every mapper is a pure function — no I/O, no
   globals — so it can be unit-tested in isolation.

## Mapping examples

```ts
// Name resolution: prefer official → text → given+family → "Unknown"
nameToString([{ use: "official", family: "Patient3", given: ["Baby"] }])
// → "Baby Patient3"

// Reference id extraction: "Patient/P1003" → "P1003"
refId("Patient/P1003")  // "P1003"

// Age in days from birthDate (null-safe)
ageInDays("2025-12-01")  // e.g. 191
ageInDays(undefined)     // null
```

## Handling validation failures

`runIngestion()` returns a summary per resource:

```json
{ "patients": { "fetched": 120, "stored": 120, "invalid": 0 }, ... }
```

Invalid items are skipped (not stored) and surfaced in the **Admin Panel** so
data-quality issues are visible rather than silent.

## Swapping in a real FHIR server

Replace `src/lib/fhir/mock-source.ts` `fhirSearch()` with an HTTP client that
GETs `${FHIR_BASE}/Patient?_count=...` and returns the Bundle. The validate →
transform → store stages are unchanged.
