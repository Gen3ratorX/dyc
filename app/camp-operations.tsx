"use client";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ExternalLink,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Home,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import type { Camp, Command } from "../lib/domain";
import { csv } from "../lib/domain";
import { read, write, vaultActor, queue } from "../lib/offline";
import type {
  Operations,
  OpsPerson,
  OpsRoom,
  OpsTeam,
} from "../lib/registration";
import RegistrationForm from "./register/registration-form";
import { registrationMatches } from "../lib/registration";
function Dialog({
  title,
  onClose,
  children,
  wide = false,
  navigation,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  navigation?: ReactNode;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={"ops-dialog" + (wide ? " ops-dialog-wide" : "")}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </header>
      {navigation && <nav className="ops-dialog-nav" aria-label="Camper record sections">{navigation}</nav>}
      <div className="ops-dialog-body">{children}</div>
    </dialog>
  );
}
type Props = {
  camp: Camp;
  section: string;
  online: boolean;
  offlineEnabled: boolean;
  pending: Command[];
  send: (
    type: string,
    payload: Record<string, any>,
    warrior?: string,
  ) => Promise<void>;
  refresh: () => Promise<unknown>;
};
export default function CampOperations({
  camp,
  section,
  online,
  offlineEnabled,
  pending,
  send,
  refresh,
}: Props) {
  const [data, setData] = useState<Operations | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("All participants"),
    [selected, setSelected] = useState<string | null>(null),
    [modal, setModal] = useState(""),
    [editing, setEditing] = useState<OpsRoom | OpsTeam | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [printMode, setPrintMode] = useState("roster");
  const loadSequence = useRef(0);
  const actor = camp.user.id,
    role = camp.user.role;
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("walkin") === "1") setModal("walkin");
    if (q.get("participant")) setSelected(q.get("participant"));
  }, []);
  const scope = JSON.stringify([
    camp.user.role,
    camp.user.groups,
    camp.user.owner,
  ]);
  const load = async () => {
    const sequence = ++loadSequence.current;
    try {
      if (!navigator.onLine) {
        const cached = offlineEnabled
          ? await read<Operations>("operations")
          : null;
        if (
          !cached ||
          cached.actor !== actor ||
          cached.scope !== scope ||
          Date.parse(cached.offlineExpiresAt) < Date.now()
        )
          throw Error(
            "Connect to load the arrival roster. Enable offline access and load it online before using it without a connection.",
          );
        if (sequence !== loadSequence.current) return;
        setData(cached);
        return;
      }
      const r = await fetch("/api/operations", { cache: "no-store" }),
        d = (await r.json()) as Operations & { error?: string };
      if (!r.ok) {
        if (
          sequence === loadSequence.current &&
          [401, 403].includes(r.status)
        ) {
          setData(null);
          if (vaultActor() === actor) await write("operations", null);
        }
        throw Error(d.error || "Unable to load arrivals.");
      }
      if (sequence !== loadSequence.current) return;
      setData(d);
      if (vaultActor() === actor) await write("operations", d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setData(null);
    setLoading(true);
    void load();
  }, [actor, scope, online, offlineEnabled]);
  useEffect(() => {
    if (online) void load();
  }, [pending.length, section]);
  useEffect(() => {
    if (!online) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && !busy && !modal && !selected)
        void load();
    };
    const timer = setInterval(refreshVisible, 20000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [online, busy, modal, selected, scope]);
  const person = data?.people.find((p) => p.id === selected);
  const [roomChoice, setRoomChoice] = useState(""),
    [bedChoice, setBedChoice] = useState("");
  const freeBeds = (roomId: string) =>
    Array.from(
      { length: data?.rooms.find((r) => r.id === roomId)?.capacity || 0 },
      (_, i) => i + 1,
    ).filter(
      (bed) =>
        !data?.people.some(
          (p) => p.id !== person?.id && p.room_id === roomId && p.bed === bed,
        ),
    );
  useEffect(() => {
    setRoomChoice(person?.room_id || "");
    setBedChoice(String(person?.bed || ""));
  }, [person?.id, person?.version]);

  useEffect(() => {
    setConfirmed(false);
  }, [selected]);
  const mutate = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!navigator.onLine)
        throw Error(
          "Reconnect to save assignments or update camp setup. Only arrivals can be queued offline.",
        );
      const r = await fetch("/api/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = (await r.json()) as { error?: string };
      if (!r.ok) {
        if (r.status === 409) await load();
        throw Error(d.error || "We could not save this change.");
      }
      await load();
      await refresh();
      setNotice("Saved to the camp record.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const update = async (
    action: string,
    extra: Record<string, unknown> = {},
  ) => {
    if (!person) return;
    if (pending.some((c) => c.warrior === person.id && c.type === "arrival")) {
      setError(
        "Sync this participant’s pending arrival before changing other details.",
      );
      return;
    }
    await mutate({
      action,
      warrior: person.id,
      version: person.version,
      ...extra,
    });
  };
  const arrival = async () => {
    if (!person || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      await send(
        "arrival",
        { version: person.version, at: new Date().toISOString() },
        person.id,
      );
      const waiting =
        offlineEnabled &&
        (await queue()).some(
          (c) => c.type === "arrival" && c.warrior === person.id,
        );
      setNotice(
        waiting
          ? "Arrival saved on this device, pending sync. Room and bed allocations require a connection."
          : "Arrival saved. Check documents and assignments next.",
      );
      setConfirmed(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const matches = (p: OpsPerson) => registrationMatches(p, search);
  const filtered = (data?.people || []).filter(
    (p) =>
      matches(p) &&
      (filter === "All participants" ||
        (filter === "Arrived" && p.arrival === "Arrived") ||
        (filter === "Not arrived" && p.arrival === "Expected") ||
        (filter === "Needs room" && !p.room_id) ||
        (filter === "Needs team" && !p.team_id) ||
        (filter === "Documents outstanding" && !p.documents) ||
        (filter === "Medical review pending" && p.medical === "Pending")),
  );
  const roomLabel = (p: OpsPerson) => {
    const r = data?.rooms.find((r) => r.id === p.room_id);
    return r
      ? `${r.building} · ${r.name} · Bed ${p.bed}`
      : p.room || "Unassigned";
  };
  const teamLabel = (p: OpsPerson) =>
    data?.teams.find((t) => t.id === p.team_id)?.name || "Unassigned";
  const queued = (p: OpsPerson) =>
    pending.some((c) => c.type === "arrival" && c.warrior === p.id);
  const print = (mode: string) => {
    setPrintMode(mode);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };
  async function exportRoster() {
    if (!data) return;
    const ok = await mutate({
      action: "export-roster",
      count: filtered.length,
    });
    if (!ok) return;
    const body = csv([
      [
        "Name",
        "Reference",
        "Arrival",
        "Room",
        "Activity team",
        "Clinical group",
      ],
      ...filtered.map((p) => [
        p.name,
        p.reference,
        p.arrival,
        roomLabel(p),
        teamLabel(p),
        p.group_name,
      ]),
    ]);
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + body], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "camp-victory-arrivals.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function configure(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await mutate({
      action: modal === "room" ? "room" : "team",
      id: editing?.id,
      version: editing?.version,
      name: f.get("name"),
      building: f.get("building"),
      capacity: Number(f.get("capacity")),
      leader: f.get("leader"),
      active: f.get("active") === "on",
    });
    if (ok) {
      setModal("");
      setEditing(null);
    }
  }
  if (loading)
    return (
      <div className="panel ops-loading" role="status">
        Loading the camp arrival roster…
      </div>
    );
  if (!data)
    return (
      <div className="panel ops-loading">
        <h1>Arrival desk unavailable</h1>
        <p role="alert">{error}</p>
        <button
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Try again
        </button>
      </div>
    );
  const configuration = section === "Rooms & teams";
  return (
    <div className="camp-operations">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CAMP VICTORY · 19–22 NOVEMBER 2026</span>
          <h1>
            {configuration
              ? "Rooms & activity teams"
              : data.canDesk
                ? "Welcome to camp."
                : "Camp arrivals"}
          </h1>
          <p>
            {configuration
              ? "A place to stay. A team to belong to. Clinical groups are assigned separately."
              : data.canDesk
                ? "Find a participant, confirm their details and record their arrival."
                : "Find any registered camper, confirm their details and record arrival."}
          </p>
        </div>
        <div className="heading-actions">
          <button onClick={() => void load()} disabled={!online || busy}>
            <RefreshCw size={16} />
            Refresh
          </button>
          {data.canDesk && !configuration && (
            <button
              className="primary"
              disabled={!online}
              onClick={() => setModal("walkin")}
            >
              <Plus size={17} />
              Register a walk-in
            </button>
          )}
          {configuration && data.canConfigure && (
            <>
              <button
                disabled={!online}
                onClick={() => {
                  setEditing(null);
                  setModal("team");
                }}
              >
                <Users size={16} />
                Add team
              </button>
              <button
                className="primary"
                disabled={!online}
                onClick={() => {
                  setEditing(null);
                  setModal("room");
                }}
              >
                <Plus size={17} />
                Add room
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <div role="alert" className="reg-error ops-banner">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="ops-notice">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {!online && (
        <div className="reg-notice">
          <p>
            Offline roster · Arrivals can be saved on this protected device and
            must sync before other staff see them. Allocate rooms and beds at
            the connected rooming desk.
          </p>
        </div>
      )}
      {!configuration ? (
        <>
          {!data.canDesk && <aside className="ops-scope-note">
            <ClipboardCheck size={20} aria-hidden="true" />
            <div><strong>Check-in for all registered campers</strong><p>Every staff member can find a camper, confirm their identity and record arrival. Room assignments, document checks and clinical care keep their existing role permissions.</p></div>
          </aside>}
      <div className="ops-metrics">
            {[
              ["Registered", data.people.length, "All participants"],
              [
                "Arrived",
                data.people.filter((p) => p.arrival === "Arrived").length,
                "Arrived",
              ],
              [
                "Not arrived",
                data.people.filter((p) => p.arrival !== "Arrived").length,
                "Not arrived",
              ],
              [
                "Need a room",
                data.people.filter((p) => !p.room_id).length,
                "Needs room",
              ],
              [
                "Need a team",
                data.people.filter((p) => !p.team_id).length,
                "Needs team",
              ],
              [
                "Documents outstanding",
                data.people.filter((p) => !p.documents).length,
                "Documents outstanding",
              ],
              [
                "Medical review pending",
                data.people.filter((p) => p.medical === "Pending").length,
                "Medical review pending",
              ],
            ].map(([title, n, f]) => (
              <button
                key={title}
                className={filter === f ? "selected" : ""}
                aria-pressed={filter === f}
                onClick={() => setFilter(String(f))}
              >
                <span>{title}</span>
                <strong>{n}</strong>
              </button>
            ))}
          </div>
          <section className="panel ops-roster">
            <div className="ops-toolbar">
              <label className="search-field">
                <Search size={18} />
                <input
                  aria-label="Find a registration"
                  placeholder="Name, phone or registration reference"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <select
                aria-label="Arrival roster filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {[
                  "All participants",
                  "Arrived",
                  "Not arrived",
                  "Needs room",
                  "Needs team",
                  "Documents outstanding",
                  "Medical review pending",
                ].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="ops-roster-caption">
              <span>
                {filtered.length}{" "}
                {filtered.length === 1 ? "participant" : "participants"}
                {filter !== "All participants" ? " · " + filter : ""}
              </span>
              <div>
                <button onClick={() => print("roster")}>
                  <Printer size={15} />
                  Print roster
                </button>
                {data.canDesk && (
                  <button
                    disabled={!online || busy}
                    onClick={() => void exportRoster()}
                  >
                    <Download size={15} />
                    Export CSV
                  </button>
                )}
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Arrival</th>
                    <th>Room & team</th>
                    <th>Next steps</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="ops-person"
                          onClick={() => setSelected(p.id)}
                        >
                          <strong>{p.name}</strong>
                          <small>
                            {p.age} years · {p.group_name}
                          </small>
                        </button>
                      </td>
                      <td>
                        <span
                          className={
                            "ops-pill " +
                            (queued(p)
                              ? "amber"
                              : p.arrival === "Arrived"
                                ? "green"
                                : "")
                          }
                        >
                          {queued(p) ? "Pending sync" : p.arrival}
                        </span>
                      </td>
                      <td>
                        <span>{roomLabel(p)}</span>
                        <small className="ops-subline">{teamLabel(p)}</small>
                      </td>
                      <td>
                        <div className="ops-tasks">
                          {!p.documents && <span>Documents</span>}
                          {p.medical === "Pending" && (
                            <span>Medical review</span>
                          )}
                          {!!p.documents && p.medical === "Reviewed" && (
                            <span className="complete">Checks complete</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button onClick={() => setSelected(p.id)}>
                          View camper
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <div className="ops-empty">
                <ClipboardCheck size={32} />
                <h2>
                  {data.people.length
                    ? "No matching participants"
                    : "No registrations yet"}
                </h2>
                <p>
                  {data.people.length
                    ? "Try another name, registration reference or phone number, or clear the filter."
                    : "New campers appear here after their registration is submitted. No care-group assignment is needed to check in."}
                </p>
                {data.canDesk && (
                  <a href="/register" target="_blank" rel="noreferrer">
                    Open participant registration
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            )}
          </section>
          {data.canConfigure && (
            <section className="panel ops-registration-control">
              <div>
                <h2>Participant registration</h2>
                <p>
                  {data.open
                    ? "The public form is accepting registrations."
                    : "The public form is closed. Staff can still register walk-ins."}
                </p>
                <a href="/register" target="_blank" rel="noreferrer">
                  Open registration form
                  <ExternalLink size={15} />
                </a>
              </div>
              <button
                disabled={!online || busy}
                onClick={() =>
                  void mutate({ action: "registration-open", open: !data.open })
                }
              >
                {data.open ? "Close registration" : "Open registration"}
              </button>
            </section>
          )}
        </>
      ) : (
        <div className="ops-setup-grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">ROOMING</span>
                <h2>Rooms & beds</h2>
              </div>
              <Home size={22} />
            </div>
            <p className="ops-section-note">
              Assign beds from a participant’s arrival record. Each bed can
              belong to one participant.
            </p>
            {data.rooms.map((r) => {
              const occupants = data.people.filter((p) => p.room_id === r.id);
              return (
                <div className="ops-resource" key={r.id}>
                  <div>
                    <strong>
                      {r.building} · {r.name}
                    </strong>
                    <span>
                      {occupants.length} / {r.capacity} beds assigned
                      {!r.active ? " · Retired" : ""}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setSearch("");
                        setFilter("All participants");
                        setModal("room-roster:" + r.id);
                      }}
                    >
                      View roster
                    </button>
                    {data.canConfigure && (
                      <button
                        disabled={!online}
                        onClick={() => {
                          setEditing(r);
                          setModal("room");
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!data.rooms.length && (
              <div className="ops-empty">
                <Home size={30} />
                <h3>No rooms added yet</h3>
                <p>
                  {data.canConfigure
                    ? "Add the actual rooms and bed capacities before allocating participants."
                    : "The camp administrator will add rooms before arrival."}
                </p>
              </div>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">BELONGING</span>
                <h2>Activity teams</h2>
              </div>
              <Users size={22} />
            </div>
            <p className="ops-section-note">
              Activity teams bring participants together. They do not change
              clinical care groups.
            </p>
            {data.teams.map((t) => (
              <div className="ops-resource" key={t.id}>
                <div>
                  <strong>{t.name}</strong>
                  <span>
                    {data.people.filter((p) => p.team_id === t.id).length}{" "}
                    participants · {t.leader || "Leader not assigned"}
                    {!t.active ? " · Retired" : ""}
                  </span>
                </div>
                <div>
                  <button onClick={() => setModal("team-roster:" + t.id)}>
                    View roster
                  </button>
                  {data.canConfigure && (
                    <button
                      disabled={!online}
                      onClick={() => {
                        setEditing(t);
                        setModal("team");
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!data.teams.length && (
              <div className="ops-empty">
                <Users size={30} />
                <h3>No activity teams yet</h3>
                <p>
                  {data.canConfigure
                    ? "Create teams and add their leaders before assigning participants."
                    : "The camp administrator will create the activity teams."}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      {person && (
        <Dialog
          title={person.name}
          navigation={<>
            <a href="#ops-person-details">Details</a>
            <a href="#ops-person-documents">Documents</a>
            {data.canAssign && <a href="#ops-person-assignments">Assignments</a>}
            <a href="#ops-person-medical">Medical review</a>
          </>}
          onClose={() => {
            setSelected(null);
            setError("");
          }}
        >
          <div className="ops-person-header" id="ops-person-details">
            <span className="ops-person-monogram">
              {person.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <p>
                {person.age} years · {person.group_name}
              </p>
              <small>{person.reference}</small>
            </div>
          </div>
          <div className="ops-person-status">
            <span
              className={
                "ops-pill " +
                (queued(person)
                  ? "amber"
                  : person.arrival === "Arrived"
                    ? "green"
                    : "")
              }
            >
              {queued(person) ? "Arrival pending sync" : person.arrival}
            </span>
            {person.arrived_at && (
              <small>
                {new Date(person.arrived_at).toLocaleString("en-GB", {
                  timeZone: "Africa/Accra",
                })}{" "}
                GMT
              </small>
            )}
          </div>
          {error && (
            <div role="alert" className="reg-error">
              {error}
            </div>
          )}
          {queued(person) && (
            <div className="reg-notice">
              <p>
                This arrival is waiting to sync. Reconnect and sync before
                updating the record.
              </p>
            </div>
          )}
          <div className="ops-detail-grid">
            {person.details.dob && (
              <div>
                <small>Date of birth</small>
                <strong>{person.details.dob}</strong>
              </div>
            )}
            {person.details.availability && (
              <div>
                <small>Full-camp attendance</small>
                <strong>{person.details.availability}</strong>
              </div>
            )}

            <div>
              <small>Room & bed</small>
              <strong>{roomLabel(person)}</strong>
            </div>
            <div>
              <small>Activity team</small>
              <strong>{teamLabel(person)}</strong>
            </div>
            {person.details.phone && (
              <div>
                <small>Participant / guardian phone</small>
                <a href={"tel:" + person.details.phone}>
                  {person.details.phone}
                </a>
              </div>
            )}
            {person.details.emergencyName && (
              <div>
                <small>Primary emergency contact</small>
                <strong>{person.details.emergencyName}</strong>
                <a href={"tel:" + person.details.emergencyPhone}>
                  {person.details.emergencyPhone}
                </a>
              </div>
            )}
            {person.details.emergencyPhone2 && (
              <div>
                <small>Second emergency phone</small>
                <a href={"tel:" + person.details.emergencyPhone2}>
                  {person.details.emergencyPhone2}
                </a>
              </div>
            )}
            {person.details.guardian && (
              <div>
                <small>Parent / guardian</small>
                <strong>{person.details.guardian}</strong>
              </div>
            )}
            {person.details.diet && (
              <div>
                <small>Dietary requirements</small>
                <strong>{person.details.diet}</strong>
              </div>
            )}
            {(data.canDesk || person.canAssess) && <div>
              <small>Photo / video permission</small>
              <strong>
                {typeof person.details.photoConsent === "boolean"
                  ? person.details.photoConsent
                    ? "Permission given"
                    : "No permission"
                  : "Not recorded"}
              </strong>
            </div>}
          </div>
          {data.canCheckIn && person.arrival === "Expected" && !queued(person) && (
            <section className="ops-action-section">
              <h3>Record arrival</h3>
              <label className="reg-consent">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                <span>
                  I have confirmed the participant’s identity and contact
                  details.
                </span>
              </label>
              <button
                className="primary"
                disabled={busy || !confirmed || (!online && !offlineEnabled)}
                onClick={() => void arrival()}
              >
                <CheckCircle2 size={18} />
                {busy
                  ? "Saving…"
                  : online
                    ? "Mark as arrived"
                    : "Save arrival offline"}
              </button>
            </section>
          )}
          {data.canDesk && (
            <form
              className="ops-action-section"
              key={"contacts:" + person.id + ":" + person.version}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void update("contacts", Object.fromEntries(f.entries()));
              }}
            >
              <details>
                <summary>Correct name or contact details</summary>
                <p>
                  Record confirmed corrections here. Clinical history and
                  permissions are kept separately.
                </p>
                {(
                  [
                    ["name", "Full name"],
                    ["phone", "Participant or guardian phone"],
                    ["guardian", "Parent or guardian name"],
                    ["emergencyName", "Primary emergency contact"],
                    ["emergencyPhone", "Primary emergency phone"],
                    ["emergencyPhone2", "Second emergency phone"],
                    ["diet", "Dietary requirements"],
                  ] as const
                ).map(([key, title]) => (
                  <label className="reg-field" key={key}>
                    <span>{title}</span>
                    <input
                      name={key}
                      required={key !== "guardian"}
                      maxLength={key === "diet" ? 2000 : 150}
                      defaultValue={
                        key === "name"
                          ? person.name
                          : String(person.details[key] || "")
                      }
                    />
                  </label>
                ))}
                <label className="reg-field">
                  <span>Reason for correction</span>
                  <textarea name="reason" required maxLength={1000} />
                </label>
                <button disabled={busy || !online || queued(person)}>
                  Save corrected details
                </button>
              </details>
            </form>
          )}
          <section className="ops-action-section" id="ops-person-documents">
            <h3>Documents</h3>
            <p>
              {person.documents
                ? "Verified by the arrival desk."
                : person.age < 18
                  ? "Guardian permission form and participation documents need checking."
                  : "Participation permissions need checking."}
            </p>
            {data.canDesk && (
              <button
                disabled={busy || !online || queued(person)}
                onClick={() =>
                  void update("documents", { verified: !person.documents })
                }
              >
                {person.documents
                  ? "Mark as outstanding"
                  : "Confirm documents checked"}
              </button>
            )}
          </section>
          {data.canAssign && (
            <form
              className="ops-action-section"
              id="ops-person-assignments"
              key={person.id + ":" + person.version}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void update("assignment", {
                  roomId: f.get("roomId"),
                  bed: Number(f.get("bed")),
                  teamId: f.get("teamId"),
                  group: f.get("group") || person.group_name,
                });
              }}
            >
              <h3>Room, team & care group</h3>
              <div className="reg-two">
                <label className="reg-field">
                  <span>Room</span>
                  <select
                    name="roomId"
                    value={roomChoice}
                    onChange={(e) => {
                      setRoomChoice(e.target.value);
                      setBedChoice(String(freeBeds(e.target.value)[0] || ""));
                    }}
                  >
                    <option value="">Unassigned</option>
                    {data.rooms
                      .filter((r) => r.active || r.id === person.room_id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.building} · {r.name} ({r.capacity} beds)
                        </option>
                      ))}
                  </select>
                </label>
                <label className="reg-field">
                  <span>Bed number</span>
                  <select
                    name="bed"
                    value={bedChoice}
                    onChange={(e) => setBedChoice(e.target.value)}
                    disabled={!roomChoice}
                    required={!!roomChoice}
                  >
                    <option value="">
                      {roomChoice
                        ? "Choose an available bed"
                        : "Choose a room first"}
                    </option>
                    {freeBeds(roomChoice).map((b) => (
                      <option key={b} value={b}>
                        Bed {b}
                        {person.room_id === roomChoice && person.bed === b
                          ? " · Current bed"
                          : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    Only available beds are listed. Availability is checked
                    again when saving.
                  </small>
                </label>
              </div>
              <div className="reg-two">
              <label className="reg-field">
                <span>Activity team</span>
                <select name="teamId" defaultValue={person.team_id || ""}>
                  <option value="">Unassigned</option>
                  {data.teams
                    .filter((t) => t.active || t.id === person.team_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              </label>
              {(camp.user.owner ||
                ["coordinator", "medical_lead"].includes(role)) && (
                <label className="reg-field">
                  <span>Clinical care group</span>
                  <select name="group" defaultValue={person.group_name}>
                    <option>Unassigned</option>
                    {Array.from({ length: 20 }, (_, i) => (
                      <option key={i}>
                        Group {String.fromCharCode(65 + i)}
                      </option>
                    ))}
                  </select>
                  <small>
                    This controls which clinical staff can see the care record.
                  </small>
                </label>
              )}
              </div>
              <button
                disabled={
                  busy ||
                  !online ||
                  queued(person) ||
                  (!!roomChoice && !bedChoice)
                }
                className="primary"
              >
                <Check size={16} />
                Save assignments
              </button>
              <small className="ops-subline">
                Room and bed changes are saved online to prevent double
                allocation.
              </small>
            </form>
          )}
          {person.care && (
            <section className="ops-action-section">
              <h3>Reported care details</h3>
              <p>
                Provided at registration. Confirm with the participant before
                using this information. Prescriptions remain in the clinical
                care record.
              </p>
              <dl className="ops-care-details">
                {Object.entries(person.care).map(([key, value]) => (
                  <div key={key}>
                    <dt>
                      {{
                        diagnosisYear: "Diagnosis year",
                        clinic: "Hospital / clinic",
                        insulin: "Insulin names",
                        insulinDoses: "Insulin doses & timing",
                        otherMedicines: "Other medicines",
                        support: "Allergies & support needs",
                      }[key] || key}
                    </dt>
                    <dd>{value || "Not recorded"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <section className="ops-action-section" id="ops-person-medical">
            <h3>Arrival medical review</h3>
            <span
              className={
                "ops-pill " +
                (person.medical === "Reviewed" ? "green" : "amber")
              }
            >
              {person.medical}
            </span>
            {data.canMedical && person.canAssess && (
              <button
                disabled={busy || !online || queued(person)}
                onClick={() =>
                  void update("medical", {
                    status:
                      person.medical === "Reviewed" ? "Pending" : "Reviewed",
                  })
                }
              >
                {person.medical === "Reviewed"
                  ? "Reopen arrival assessment"
                  : "Confirm arrival assessment complete"}
              </button>
            )}
          </section>
          <section className="ops-action-section ops-badge-section">
            <div>
              <p>
                Print a name badge with their team, room and registration
                reference.
              </p>
            </div>
            <button onClick={() => print("badge")}>
              <Printer size={16} />
              Print name badge
            </button>
          </section>
          {data.canDesk && person.arrival === "Arrived" && (
            <form
              className="ops-action-section"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void update("reverse-arrival", { reason: f.get("reason") });
              }}
            >
              <details>
                <summary>Correct an arrival recorded by mistake</summary>
                <p>
                  This keeps an audit record and returns the participant to “Not
                  arrived”. It keeps room and team assignments.
                </p>
                <label className="reg-field">
                  <span>Reason for correction</span>
                  <textarea required name="reason" maxLength={1000} />
                </label>
                <button disabled={busy || !online || queued(person)}>
                  Reverse arrival
                </button>
              </details>
            </form>
          )}
        </Dialog>
      )}
      {modal === "walkin" && (
        <Dialog
          title="Register a walk-in"
          wide
          onClose={() => {
            setModal("");
            void load();
          }}
        >
          <RegistrationForm
            walkin
            onDone={() => {
              void load();
              void refresh();
            }}
          />
        </Dialog>
      )}
      {(modal === "room" || modal === "team") && (
        <Dialog
          title={
            (editing ? "Edit " : "Add ") +
            (modal === "room" ? "room" : "activity team")
          }
          onClose={() => {
            setModal("");
            setEditing(null);
          }}
        >
          <form className="reg-form ops-resource-form" onSubmit={configure}>
            {modal === "room" && (
              <label className="reg-field">
                <span>Building / accommodation block</span>
                <input
                  required
                  name="building"
                  maxLength={80}
                  defaultValue={(editing as OpsRoom)?.building || ""}
                />
              </label>
            )}
            <label className="reg-field">
              <span>
                {modal === "room" ? "Room number or name" : "Team name"}
              </span>
              <input
                required
                name="name"
                maxLength={80}
                defaultValue={editing?.name || ""}
              />
            </label>
            {modal === "room" ? (
              <label className="reg-field">
                <span>Number of beds</span>
                <input
                  type="number"
                  required
                  name="capacity"
                  min={1}
                  max={100}
                  defaultValue={(editing as OpsRoom)?.capacity || 1}
                />
              </label>
            ) : (
              <label className="reg-field">
                <span>Team leader staff email (optional)</span>
                <input
                  name="leader"
                  type="email"
                  maxLength={150}
                  defaultValue={(editing as OpsTeam)?.leader || ""}
                />
                <small>
                  A mentor with this email can see the team roster. Clinical
                  history still follows their approved care groups.
                </small>
              </label>
            )}
            <label className="reg-consent">
              <input
                type="checkbox"
                name="active"
                defaultChecked={editing ? !!editing.active : true}
              />
              <span>Available for new assignments</span>
            </label>
            {error && (
              <div role="alert" className="reg-error">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy || !online}>
              {busy ? "Saving…" : "Save " + modal}
            </button>
          </form>
        </Dialog>
      )}
      {(modal.startsWith("room-roster:") ||
        modal.startsWith("team-roster:")) && (
        <Dialog
          title={
            modal.startsWith("room") ? "Room roster" : "Activity team roster"
          }
          onClose={() => setModal("")}
        >
          <p>Showing participants available to your account.</p>
          {data.people
            .filter((p) =>
              modal.startsWith("room")
                ? p.room_id === modal.split(":")[1]
                : p.team_id === modal.split(":")[1],
            )
            .map((p) => (
              <div className="ops-resource" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <span>
                    {p.arrival} · {roomLabel(p)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setModal("");
                    setSelected(p.id);
                  }}
                >
                  View camper
                </button>
              </div>
            ))}
        </Dialog>
      )}
      <div className="ops-print-view">
        {printMode === "badge" && person ? (
          <div className="ops-print-badge">
            <img
              src="/dyc-logo-light.png"
              alt="Diabetes Youth Care"
              width={160}
            />
            <h1>{person.name}</h1>
            <p>{teamLabel(person)}</p>
            <p>{roomLabel(person)}</p>

            <small>{person.reference}</small>
          </div>
        ) : (
          <>
            <h1>Camp Victory · Arrival roster</h1>
            <p>
              19–22 November 2026 · {filter} · Printed{" "}
              {new Date().toLocaleDateString("en-GB")}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Arrival</th>
                  <th>Room / bed</th>
                  <th>Activity team</th>
                  <th>Care group</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.arrival}</td>
                    <td>{roomLabel(p)}</td>
                    <td>{teamLabel(p)}</td>
                    <td>{p.group_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
