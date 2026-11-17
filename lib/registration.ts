import { validDay, ValidationError } from "./domain";
export const CAMP = {
  name: "Camp Victory 2026",
  start: "2026-11-19",
  end: "2026-11-22",
  dates: "19–22 November 2026",
  venue: "Pentecost Convention Center, Kasoa, Central Region",
  contact: "+233503979411",
};
export const regions = [
  "Ahafo",
  "Ashanti",
  "Bono",
  "Bono East",
  "Central",
  "Eastern",
  "Greater Accra",
  "North East",
  "Northern",
  "Oti",
  "Savannah",
  "Upper East",
  "Upper West",
  "Volta",
  "Western",
  "Western North",
];
export type RegistrationInput = {
  name: string;
  dob: string;
  gender: string;
  region: string;
  town: string;
  phone: string;
  guardian: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyPhone2: string;
  availability: string;
  diagnosisYear: string;
  clinic: string;
  insulin: string;
  insulinDoses: string;
  otherMedicines: string;
  support: string;
  diet: string;
  shirt: string;
  type1: boolean;
  guardianPermission: boolean;
  dataConsent: boolean;
  activitiesConsent: boolean;
  emergencyConsent: boolean;
  photoConsent: boolean | null;
  rulesConsent: boolean;
  truthConsent: boolean;
};
export const blankRegistration: RegistrationInput = {
  name: "",
  dob: "",
  gender: "",
  region: "",
  town: "",
  phone: "",
  guardian: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyPhone2: "",
  availability: "",
  diagnosisYear: "",
  clinic: "",
  insulin: "",
  insulinDoses: "",
  otherMedicines: "",
  support: "",
  diet: "None",
  shirt: "",
  type1: false,
  guardianPermission: false,
  dataConsent: false,
  activitiesConsent: false,
  emergencyConsent: false,
  photoConsent: null,
  rulesConsent: false,
  truthConsent: false,
};
export function campAge(dob: string) {
  if (!validDay(dob)) return -1;
  return 2026 - Number(dob.slice(0, 4)) - (dob.slice(5) > "11-19" ? 1 : 0);
}
const fail = (message: string): never => {
  throw new ValidationError(message);
};
export function registrationInput(raw: unknown, step = 3): RegistrationInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    fail("Enter the registration details.");
  const source = raw as Record<string, unknown>,
    p = { ...blankRegistration };
  for (const key of Object.keys(p) as (keyof RegistrationInput)[]) {
    const value = source[key];
    if (typeof blankRegistration[key] === "string") {
      if (typeof value !== "string" || value.length > 2000)
        fail("Check the " + key + " field.");
      (p as any)[key] = (value as string).trim();
    } else if (key === "photoConsent") {
      if (value !== null && typeof value !== "boolean")
        fail("Choose a photo permission option.");
      p.photoConsent = value as boolean | null;
    } else {
      if (typeof value !== "boolean") fail("Check the permission answers.");
      (p as any)[key] = value;
    }
  }
  if (!p.type1)
    fail(
      "This camp is for young people living with Type 1 diabetes. Contact the camp team for other enquiries.",
    );
  if (!p.name || p.name.length > 150)
    fail("Enter a full name of up to 150 characters.");
  const age = campAge(p.dob);
  if (age < 0 || age >= 25)
    fail(
      "Participants must be under 25 on 19 November 2026. Check the date of birth.",
    );
  if (!["Female", "Male", "Prefer not to say"].includes(p.gender))
    fail("Choose a gender option.");
  if (!p.region || !p.town) fail("Enter a region and town or village.");
  if (!["Yes", "No", "Maybe"].includes(p.availability))
    fail("Tell us whether you can attend the full camp.");
  const phone = (s: string) => /^\+?[\d\s()-]{9,24}$/.test(s);
  if (!phone(p.phone))
    fail("Enter a valid participant or guardian phone number.");
  if (step < 1) return p;
  if (
    !/^\d{4}$/.test(p.diagnosisYear) ||
    Number(p.diagnosisYear) < Number(p.dob.slice(0, 4)) ||
    Number(p.diagnosisYear) > 2026
  )
    fail("Check the diagnosis year.");
  if (
    !p.clinic ||
    !p.insulin ||
    !p.insulinDoses ||
    !p.otherMedicines ||
    !p.support ||
    !p.diet
  )
    fail(
      "Complete the care details. You can enter “None” or “Not sure” where appropriate.",
    );
  if (step < 2) return p;
  if (!p.emergencyName || !phone(p.emergencyPhone) || !phone(p.emergencyPhone2))
    fail("Enter an emergency contact name and two valid contact numbers.");
  if (age < 18 && !p.guardian) fail("Enter the parent or guardian’s name.");
  if (!["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(p.shirt))
    fail("Choose a T-shirt size.");
  if (step < 3) return p;
  if (age < 18 && !p.guardianPermission)
    fail(
      "A parent or guardian must give permission for a participant under 18.",
    );
  if (
    !p.dataConsent ||
    !p.activitiesConsent ||
    !p.emergencyConsent ||
    !p.rulesConsent ||
    !p.truthConsent
  )
    fail("Review and complete the required permissions.");
  if (p.photoConsent === null)
    fail(
      "Choose Yes or No for photo and video permission. Both options are welcome.",
    );
  return p;
}
export function registrationParts(p: RegistrationInput) {
  const {
    diagnosisYear,
    clinic,
    insulin,
    insulinDoses,
    otherMedicines,
    support,
    ...details
  } = p;
  return {
    details,
    care: {
      diagnosisYear,
      clinic,
      insulin,
      insulinDoses,
      otherMedicines,
      support,
    },
  };
}
export type OpsRoom = {
  id: string;
  building: string;
  name: string;
  capacity: number;
  active: number;
  version: number;
};
export type OpsTeam = {
  id: string;
  name: string;
  leader: string;
  active: number;
  version: number;
};
export type OpsPerson = {
  id: string;
  name: string;
  age: number;
  group_name: string;
  room: string;
  reference: string;
  details: Partial<RegistrationInput>;
  care?: Record<string, string>;
  arrival: string;
  arrived_at: string;
  documents: number;
  medical: string;
  room_id: string | null;
  bed: number | null;
  team_id: string | null;
  version: number;
};
export type Operations = {
  scope: string;
  people: OpsPerson[];
  rooms: OpsRoom[];
  teams: OpsTeam[];
  canDesk: boolean;
  canConfigure: boolean;
  canMedical: boolean;
  canAssign: boolean;
  open: boolean;
  offlineExpiresAt: string;
  actor: string;
};

export function registrationMatches(
  p: Pick<OpsPerson, "name" | "reference" | "id" | "details">,
  search: string,
) {
  const q = search.trim().toLowerCase();
  if (
    [p.name, p.reference, p.id, p.details.phone || ""].some((v) =>
      v.toLowerCase().includes(q),
    )
  )
    return true;
  const reference = q.replace(/[^a-z0-9]/g, "");
  if (
    reference.length >= 4 &&
    p.reference
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .includes(reference)
  )
    return true;
  const digits = q.replace(/\D/g, "");
  return (
    /^[+0-9\s()-]+$/.test(q) &&
    digits.length >= 3 &&
    (p.details.phone || "").replace(/\D/g, "").includes(digits)
  );
}
