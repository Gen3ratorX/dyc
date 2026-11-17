import type { Metadata } from "next";
import RegistrationForm from "./registration-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Register for Camp Victory 2026 | Diabetes Youth Care",
  description:
    "Register for the 2026 T1D Warrior Camp, 19–22 November at Pentecost Convention Center, Kasoa.",
};
export default function Register() {
  return (
    <main className="public-registration">
      <RegistrationForm />
    </main>
  );
}
