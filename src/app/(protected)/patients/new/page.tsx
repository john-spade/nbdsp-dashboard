import { PatientForm } from "@/components/patients/patient-form";

/** Add Patient — admin + encoder (guarded by the protected layout + API). */
export default function NewPatientPage() {
  return <PatientForm mode="create" />;
}
