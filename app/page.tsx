import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, MapPin, Phone, ShieldCheck, UserRoundPlus } from "lucide-react";
import { CAMP } from "../lib/registration";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Camp Victory 2026 | Diabetes Youth Care", description: "Register a camper or sign in to your Camp Victory staff workspace." };
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  if (query.password === "changed") redirect("/login?password=changed" + (query.sessions === "check" ? "&sessions=check" : ""));
  return <div className="welcome-page">
    <a className="skip-link" href="#welcome-content">Skip to camp options</a>
    <div className="welcome-wrap">
      <header className="welcome-header">
        <a href="/" aria-label="Camp Victory home" className="welcome-brand"><img src="/dyc-logo-light.png" width={768} height={398} alt="Diabetes Youth Care" /></a>
        <span className="welcome-header-label">CAMP VICTORY <span>2026</span></span>
      </header>
      <main id="welcome-content">
        <section className="welcome-intro" aria-labelledby="welcome-title">
          <h1 id="welcome-title">Welcome to <em>Camp Victory.</em></h1>
          <p>One place for registration and your camp workspace.</p>
          <div className="welcome-details" aria-label="Camp details">
            <span><CalendarDays size={16} />19–22 November 2026</span>
            <span><MapPin size={16} />Pentecost Convention Center, Kasoa</span>
          </div>
        </section>
        <section className="welcome-options" aria-label="Choose how to continue">
          <article className="welcome-option welcome-register">
            <div className="welcome-option-top"><span className="welcome-option-icon"><UserRoundPlus size={23} /></span><span>REGISTRATION TEAM</span></div>
            <h2>Register a camper</h2>
            <p>Complete a camper’s details, save their confirmation, then start the next registration.</p>
            <a className="welcome-action" href="/register">Start registration<ArrowRight size={19} /></a>
          </article>
          <article className="welcome-option welcome-staff">
            <div className="welcome-option-top"><span className="welcome-option-icon"><ShieldCheck size={23} /></span><span>CAMP STAFF</span></div>
            <h2>Open your workspace</h2>
            <p>Sign in for check-in, rooms, teams and care tools assigned to your role.</p>
            <a className="welcome-action" href="/login">Staff sign in<ArrowRight size={19} /></a>
          </article>
        </section>
      </main>
      <footer className="welcome-footer"><span>Diabetes Youth Care · Camp Victory 2026</span><a href={"tel:" + CAMP.contact}><Phone size={14} />+233 50 397 9411</a></footer>
    </div>
  </div>;
}
