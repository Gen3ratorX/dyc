"use client";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CalendarDays,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
} from "lucide-react";
import {
  CAMP,
  blankRegistration,
  campAge,
  regions,
  registrationInput,
  type RegistrationInput,
} from "../../lib/registration";
const steps = ["About you", "Care needs", "Contacts & camp", "Permissions"];
export default function RegistrationForm({
  walkin = false,
  onDone,
}: {
  walkin?: boolean;
  onDone?: (reference: string) => void;
}) {
  const [data, setData] = useState<RegistrationInput>({ ...blankRegistration }),
    [step, setStep] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState(""),
    [open, setOpen] = useState(true),
    [checking, setChecking] = useState(!walkin);
  const id = useRef(""),
    heading = useRef<HTMLHeadingElement>(null),
    trap = useRef<HTMLInputElement>(null),
    submitting = useRef(false);
  const age = campAge(data.dob),
    minor = age >= 0 && age < 18;
  useEffect(() => {
    id.current = crypto.randomUUID();
    if (!walkin)
      void fetch("/api/registration", { cache: "no-store" })
        .then(async (r) => {
          const d = (await r.json()) as { open: boolean; error?: string };
          if (!r.ok)
            throw Error(d.error || "Registration is temporarily unavailable.");
          setOpen(d.open);
        })
        .catch((e) => setError(e.message))
        .finally(() => setChecking(false));
  }, [walkin]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, receipt]);
  const update = (key: keyof RegistrationInput, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));
  const field = (
    key: keyof RegistrationInput,
    title: string,
    type = "text",
    hint?: string,
    required = true,
  ) => (
    <label className="reg-field" key={key}>
      <span>
        {title}
        {!required && <small>Optional</small>}
      </span>
      <input
        type={type}
        value={String(data[key])}
        maxLength={
          ["name", "guardian", "emergencyName"].includes(key) ? 150 : 2000
        }
        required={required}
        autoComplete={
          key === "name"
            ? "name"
            : key === "phone"
              ? "tel"
              : key === "dob"
                ? "bday"
                : "off"
        }
        onChange={(e) => update(key, e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
  const area = (key: keyof RegistrationInput, title: string, hint?: string) => (
    <label className="reg-field" key={key}>
      <span>{title}</span>
      <textarea
        required
        rows={3}
        maxLength={2000}
        value={String(data[key])}
        onChange={(e) => update(key, e.target.value)}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
  const select = (
    key: keyof RegistrationInput,
    title: string,
    options: string[],
  ) => (
    <label className="reg-field" key={key}>
      <span>{title}</span>
      <select
        required
        value={String(data[key])}
        onChange={(e) => update(key, e.target.value)}
      >
        <option value="">Choose an option</option>
        {options.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
    </label>
  );
  const consent = (key: keyof RegistrationInput, content: ReactNode) => (
    <label className="reg-consent" key={key}>
      <input
        type="checkbox"
        checked={data[key] === true}
        onChange={(e) => update(key, e.target.checked)}
      />
      <span>{content}</span>
    </label>
  );
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      registrationInput(data, step);
      if (step < 3) {
        setStep(step + 1);
        return;
      }
      if (submitting.current) return;
      submitting.current = true;
      setBusy(true);
      const response = await fetch(
        walkin ? "/api/operations" : "/api/registration",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: walkin ? "walkin" : undefined,
            details: data,
            requestId: id.current,
            website: trap.current?.value || "",
          }),
        },
      );
      const result = (await response.json()) as {
        reference: string;
        error?: string;
      };
      if (!response.ok)
        throw Error(
          result.error ||
            "Unable to submit. Your answers are still here; try again.",
        );
      setReceipt(result.reference);
      onDone?.(result.reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }
  if (receipt)
    return (
      <section className="reg-receipt">
        <span className="reg-success">
          <CheckCircle2 size={36} />
        </span>
        <p className="eyebrow">YOU’RE REGISTERED</p>
        <h1 ref={heading} tabIndex={-1}>
          See you at camp, {data.name.split(" ")[0]}.
        </h1>
        <p>
          Save this confirmation or take a screenshot. Bring it to the arrival
          desk on 19 November.
        </p>
        <div className="reg-ticket">
          <div>
            <span>YOUR REGISTRATION REFERENCE</span>
            <strong>{receipt}</strong>
            <p>
              {data.name}
              <br />
              {CAMP.dates}
              <br />
              {CAMP.venue}
            </p>
          </div>
        </div>
        {minor && (
          <div className="reg-notice">
            <strong>One more thing for your guardian</strong>
            <p>
              Bring a signed parent or guardian permission form to the arrival
              desk. The printable copy below includes the signature section.
            </p>
          </div>
        )}
        <p>
          Registration is recorded. Room, team and care-group assignments are
          confirmed by staff. If anything changes, contact the camp team on{" "}
          <a href={"tel:" + CAMP.contact}>+233 50 397 9411</a>.
        </p>
        <button className="primary reg-no-print" onClick={() => window.print()}>
          <Printer size={18} />
          Print confirmation{minor ? " & guardian form" : ""}
        </button>
        {walkin && (
          <button
            className="reg-no-print"
            onClick={() => {
              setReceipt("");
              setData({ ...blankRegistration });
              setStep(0);
              id.current = crypto.randomUUID();
            }}
          >
            Register another participant
          </button>
        )}
        {minor && (
          <div className="reg-guardian-print">
            <h2>Parent or guardian permission</h2>
            <p>
              Camp Victory · 19–22 November 2026 · Pentecost Convention Center,
              Kasoa
            </p>
            <p>
              Participant: {data.name} · Born: {data.dob}
              <br />
              Parent or guardian: {data.guardian}
              <br />
              Reference: {receipt}
            </p>
            <p>
              I give permission for supervised camp activities and routine
              diabetes monitoring. In an emergency, I authorise first aid,
              diabetes support and referral to a health facility. I agree that
              the information supplied may be used for camp planning,
              supervision, travel, rooming and emergency support.
            </p>
            <p>Photo/video permission: {data.photoConsent ? "Yes" : "No"}.</p>
            <p>
              Guardian signature: ____________________ Date:
              ____________________
            </p>
            <p>
              Guardian phone: ____________________ Staff verification:
              ____________________
            </p>
          </div>
        )}
      </section>
    );
  return (
    <div className="registration-shell">
      <aside className="reg-story">
        <img
          src="/dyc-logo-light.png"
          alt="Diabetes Youth Care"
          width={240}
          height={119}
        />
        <span className="reg-camp-label">2026 T1D WARRIOR CAMP</span>
        <h1>
          A few days.
          <br />A whole community.
        </h1>
        <p>
          A place to learn, make friends and share life with Type 1 diabetes.
        </p>
        <div className="reg-event">
          <span>
            <CalendarDays size={19} />
            {CAMP.dates}
          </span>
          <span>
            <MapPin size={19} />
            {CAMP.venue}
          </span>
          <a href={"tel:" + CAMP.contact}>
            <Phone size={19} />
            +233 50 397 9411
          </a>
        </div>
        <div className="reg-trust">
          <ShieldCheck size={21} />
          <p>
            Your answers help the camp team plan your stay and support your
            care.
          </p>
        </div>
        <a className="reg-staff-link" href="/">
          Staff sign in <ArrowRight size={15} />
        </a>
      </aside>
      <section className="reg-main">
        <div className="reg-mobile-brand">
          <img
            src="/dyc-logo-light.png"
            alt="Diabetes Youth Care"
            width={180}
            height={89}
          />
          <small>{CAMP.dates} · Kasoa</small>
        </div>
        {checking ? (
          <p role="status">Checking registration availability…</p>
        ) : !open ? (
          <div className="reg-closed">
            <h1>Registration is closed</h1>
            <p>
              For help with attendance or an existing registration, call{" "}
              <a href={"tel:" + CAMP.contact}>+233 50 397 9411</a>.
            </p>
          </div>
        ) : (
          <>
            <div className="reg-progress" aria-label="Registration progress">
              {steps.map((s, i) => (
                <div
                  key={s}
                  aria-current={i === step ? "step" : undefined}
                  className={i <= step ? "reached" : ""}
                >
                  <span>{i < step ? <Check size={16} /> : i + 1}</span>
                  <small>{s}</small>
                </div>
              ))}
            </div>
            <form onSubmit={submit} className="reg-form">
              <div className="reg-step-heading">
                <span className="eyebrow">
                  STEP {step + 1} OF 4{walkin ? " · ARRIVAL DESK" : ""}
                </span>
                <h2 ref={heading} tabIndex={-1}>
                  {
                    [
                      "Let’s get to know you.",
                      "Help us plan your care.",
                      "Who can we call?",
                      "A few permissions before camp.",
                    ][step]
                  }
                </h2>
                <p>
                  {
                    [
                      "For young people under 25 living with Type 1 diabetes. A parent or guardian can complete this form.",
                      "Share your current care details. The medical team will review them at camp.",
                      "Give us two emergency contact numbers and a few details for your stay.",
                      "Please read each statement. Photo and video permission is your choice.",
                    ][step]
                  }
                </p>
              </div>
              <div className="reg-fields">
                {step === 0 && (
                  <>
                    {consent(
                      "type1",
                      "I am registering a young person living with Type 1 diabetes.",
                    )}
                    {field("name", "Full name")}
                    <div className="reg-two">
                      <fieldset className="reg-birthday">
                        <legend>Date of birth</legend>
                        <div>
                          {(["Day", "Month", "Year"] as const).map(
                            (title, i) => {
                              const index = 2 - i;
                              const parts = data.dob.split("-");
                              return (
                                <label key={title}>
                                  <span>{title}</span>
                                  <select
                                    aria-label={"Birth " + title.toLowerCase()}
                                    required
                                    value={parts[index] || ""}
                                    onChange={(e) => {
                                      const next = [
                                        parts[0] || "",
                                        parts[1] || "",
                                        parts[2] || "",
                                      ];
                                      next[index] = e.target.value;
                                      update("dob", next.join("-"));
                                    }}
                                  >
                                    <option value="">{title}</option>
                                    {Array.from(
                                      {
                                        length:
                                          i === 0 ? 31 : i === 1 ? 12 : 27,
                                      },
                                      (_, n) => {
                                        const number =
                                          i === 2 ? 2026 - n : n + 1;
                                        return (
                                          <option
                                            key={number}
                                            value={
                                              i === 2
                                                ? String(number)
                                                : String(number).padStart(
                                                    2,
                                                    "0",
                                                  )
                                            }
                                          >
                                            {i === 1
                                              ? new Date(
                                                  Date.UTC(2026, n, 1),
                                                ).toLocaleString("en-GB", {
                                                  month: "short",
                                                  timeZone: "UTC",
                                                })
                                              : number}
                                          </option>
                                        );
                                      },
                                    )}
                                  </select>
                                </label>
                              );
                            },
                          )}
                        </div>
                      </fieldset>
                      {select("gender", "Gender", [
                        "Female",
                        "Male",
                        "Prefer not to say",
                      ])}
                    </div>
                    {/^\d{4}-\d{2}-\d{2}$/.test(data.dob) && (
                      <p className="reg-age">
                        {age >= 0
                          ? `${age} years old at the start of camp`
                          : "Check your date of birth"}
                        {minor ? " · Guardian permission required" : ""}
                      </p>
                    )}
                    <div className="reg-two">
                      {select("region", "Region", regions)}
                      {field("town", "Town or village")}
                    </div>
                    {field(
                      "phone",
                      "Participant or guardian phone",
                      "tel",
                      "Use a number we can reach before camp.",
                    )}
                    {select(
                      "availability",
                      "Can you attend the full camp, 19–22 November?",
                      ["Yes", "No", "Maybe"],
                    )}
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="reg-notice">
                      <ShieldCheck size={19} />
                      <p>
                        These are reported care details. A clinician will
                        confirm your camp care plan; this form does not create a
                        prescription.
                      </p>
                    </div>
                    <div className="reg-two">
                      {field("diagnosisYear", "Year diagnosed", "number")}
                      {field("clinic", "Hospital or clinic")}
                    </div>
                    {area(
                      "insulin",
                      "Insulin name(s)",
                      "Write the name on the pen, vial or packaging. Enter “Not sure” if needed.",
                    )}
                    {area("insulinDoses", "Current insulin doses and timing")}
                    {area(
                      "otherMedicines",
                      "Other medicines and doses",
                      "Enter “None” if you do not take other medicines.",
                    )}
                    {area(
                      "support",
                      "Allergies, medical conditions or support needs",
                      "Include food allergies, accessibility or disability support. Enter “None” if there are none.",
                    )}
                  </>
                )}
                {step === 2 && (
                  <>
                    {field(
                      "guardian",
                      "Parent or guardian name",
                      "text",
                      minor ? "Required for participants under 18." : undefined,
                      minor,
                    )}
                    {field("emergencyName", "Primary emergency contact name")}
                    <div className="reg-two">
                      {field(
                        "emergencyPhone",
                        "Primary emergency phone",
                        "tel",
                      )}
                      {field(
                        "emergencyPhone2",
                        "Second emergency phone",
                        "tel",
                      )}
                    </div>
                    {field(
                      "diet",
                      "Dietary requirements",
                      "text",
                      "For example: None, vegetarian, vegan, gluten-free, or details of other requirements.",
                    )}
                    {select("shirt", "T-shirt size", [
                      "XS",
                      "S",
                      "M",
                      "L",
                      "XL",
                      "XXL",
                      "XXXL",
                    ])}
                    {minor && (
                      <div className="reg-notice">
                        <p>
                          A signed guardian permission form must also be brought
                          to camp. You can print it after registration.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {step === 3 && (
                  <>
                    {minor &&
                      consent(
                        "guardianPermission",
                        <>
                          I am the parent or guardian, or I am completing this
                          form with their permission. I will bring a signed
                          guardian permission form.
                        </>,
                      )}
                    {consent(
                      "dataConsent",
                      "I agree that the organisers may use these details for safe camp participation, diabetes support, travel, rooming and emergency care.",
                    )}
                    {consent(
                      "activitiesConsent",
                      "I give permission for supervised activities, education, recreation, group discussions and routine diabetes monitoring.",
                    )}
                    {consent(
                      "emergencyConsent",
                      "In an emergency, I authorise camp staff and medical personnel to provide first aid, diabetes support and referral to a health facility.",
                    )}
                    <fieldset className="reg-photo">
                      <legend>Photo and video permission</legend>
                      <p>
                        May the organisers use camp photos or videos in approved
                        reports and communications? Saying No will not affect
                        participation.
                      </p>
                      {[true, false].map((v) => (
                        <label key={String(v)}>
                          <input
                            type="radio"
                            name="photos"
                            checked={data.photoConsent === v}
                            onChange={() => update("photoConsent", v)}
                          />
                          {v
                            ? "Yes, I give permission"
                            : "No, I do not give permission"}
                        </label>
                      ))}
                    </fieldset>
                    {consent(
                      "rulesConsent",
                      "I agree to follow camp rules, respect others and cooperate with staff to keep everyone safe.",
                    )}
                    {consent(
                      "truthConsent",
                      "I confirm that these details are true and complete to the best of my knowledge.",
                    )}
                    <div className="reg-review">
                      <strong>{data.name}</strong>
                      <span>
                        Born {data.dob} · {data.region}
                      </span>
                      <span>
                        {data.phone} · {data.shirt} T-shirt
                      </span>
                      <small>
                        You can go back to review your answers before
                        submitting.
                      </small>
                    </div>
                  </>
                )}
              </div>
              <input
                className="reg-trap"
                type="text"
                name="website"
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
                ref={trap}
              />
              {error && (
                <div className="reg-error" role="alert">
                  {error}
                </div>
              )}
              <div className="reg-form-footer">
                {step > 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep(step - 1);
                      setError("");
                    }}
                  >
                    <ArrowLeft size={17} />
                    Back
                  </button>
                ) : (
                  <small>All fields required unless marked optional.</small>
                )}
                <button
                  className="primary"
                  disabled={busy || checking}
                  type="submit"
                >
                  {busy
                    ? "Submitting…"
                    : step === 3
                      ? "Submit registration"
                      : "Continue"}
                  {!busy && <ArrowRight size={17} />}
                </button>
              </div>
            </form>
          </>
        )}
        <p className="reg-help">
          Need help? <a href={"tel:" + CAMP.contact}>Call the camp team</a>.
          Your answers stay on this page until you submit. Public registration
          needs an internet connection.
        </p>
      </section>
    </div>
  );
}
