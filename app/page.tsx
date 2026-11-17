import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Phone,
  ShieldCheck,
  UserRoundPlus,
  Users,
  ClipboardCheck,
  House,
  HeartPulse,
  ArrowUpRight,
} from "lucide-react";
import { CAMP } from "../lib/registration";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Camp Victory 2026 | Diabetes Youth Care",
  description:
    "Your starting point for Camp Victory: register for camp or sign in to the staff workspace.",
};
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Keep existing password-change bookmarks and return links working.
  if (query.password === "changed")
    redirect(
      "/login?password=changed" +
        (query.sessions === "check" ? "&sessions=check" : ""),
    );
  return (
    <div className="welcome-page">
      <a className="skip-link" href="#welcome-content">
        Skip to camp options
      </a>
      <div className="welcome-wrap">
        <header className="welcome-header">
          <a href="/" aria-label="Camp Victory home" className="welcome-brand">
            <img
              src="/dyc-logo-light.png"
              width={768}
              height={398}
              alt="Diabetes Youth Care"
            />
          </a>
          <span className="welcome-header-label">
            CAMP VICTORY <span>2026</span>
          </span>
          <a className="welcome-staff-link" href="/login">
            Staff sign in
            <ArrowUpRight size={16} />
          </a>
        </header>
        <main id="welcome-content">
          <section className="welcome-hero" aria-labelledby="welcome-title">
            <div className="welcome-intro">
              <span className="welcome-eyebrow">
                <span />
                2026 T1D WARRIOR CAMP
              </span>
              <h1 id="welcome-title">
                Welcome to
                <br />
                <em>Camp Victory.</em>
              </h1>
              <p>
                A few days of learning, friendship and shared experiences. A
                community that understands life with Type 1 diabetes.
              </p>
              <a className="welcome-mobile-register welcome-action" href="/register">
                Register for camp <ArrowRight size={19} />
              </a>
              <span className="welcome-host">
                Brought together by Diabetes Youth Care
              </span>
            </div>
            <aside className="welcome-event" aria-label="Camp details">
              <span className="welcome-event-top">
                <CalendarDays size={19} />
                SAVE THE DATES
              </span>
              <strong>
                19–22<span>November 2026</span>
              </strong>
              <div className="welcome-event-location">
                <MapPin size={20} />
                <p>
                  Pentecost Convention Center<span>Kasoa, Central Region</span>
                </p>
              </div>
              <span className="welcome-event-note">
                Four days. One warrior community.
              </span>
            </aside>
          </section>
          <section
            className="welcome-start"
            aria-labelledby="welcome-start-title"
          >
            <div className="welcome-section-heading">
              <h2 id="welcome-start-title">How can we help you today?</h2>
              <p>Choose where you’d like to begin.</p>
            </div>
            <div className="welcome-options">
              <article className="welcome-option welcome-register">
                <div className="welcome-option-top">
                  <span className="welcome-option-icon">
                    <UserRoundPlus size={25} />
                  </span>
                  <span className="welcome-option-audience">
                    WARRIORS & FAMILIES
                  </span>
                </div>
                <h3>Register for camp</h3>
                <p>
                  Tell us about yourself and the support you need for your stay.
                  A parent or guardian can help you register.
                </p>
                <div className="welcome-option-detail">
                  <Users size={16} />
                  <span>For warriors under 25 · No account needed</span>
                </div>
                <a className="welcome-action" href="/register">
                  Start registration
                  <ArrowRight size={19} />
                </a>
              </article>
              <article className="welcome-option welcome-staff">
                <div className="welcome-option-top">
                  <span className="welcome-option-icon">
                    <ShieldCheck size={25} />
                  </span>
                  <span className="welcome-option-audience">
                    STAFF & VOLUNTEERS
                  </span>
                </div>
                <h3>Your camp workspace</h3>
                <p>
                  Sign in with the staff account your administrator created.
                  Your dashboard brings together the tools for your role.
                </p>
                <ul
                  className="welcome-tools"
                  aria-label="Staff workspace tools"
                >
                  <li>
                    <ClipboardCheck size={15} />
                    Check-in
                  </li>
                  <li>
                    <House size={15} />
                    Rooms & teams
                  </li>
                  <li>
                    <HeartPulse size={15} />
                    Clinical care
                  </li>
                </ul>
                <a className="welcome-action" href="/login">
                  Staff sign in
                  <ArrowRight size={19} />
                </a>
              </article>
            </div>
          </section>
          <aside className="welcome-registered">
            <ClipboardCheck size={22} />
            <div>
              <h2>Already registered?</h2>
              <p>
                You’re all set for the next step. Bring your registration
                reference to the arrival desk. Staff can also find you by name.
              </p>
            </div>
          </aside>
        </main>
        <footer className="welcome-footer">
          <span>Diabetes Youth Care · Camp Victory 2026</span>
          <a href={"tel:" + CAMP.contact}>
            <Phone size={15} />
            Questions? +233 50 397 9411
          </a>
        </footer>
      </div>
    </div>
  );
}
