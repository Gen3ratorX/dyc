'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardCheck,
  ClipboardList, CloudOff, Download, FileSpreadsheet, HeartPulse, LayoutDashboard,
  Menu, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Stethoscope, Users,
  Wifi, X, RefreshCw, Clock3, CalendarDays, SlidersHorizontal, Pill, LockKeyhole,
} from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { can, careDay, csv, roles, slots, type Entry, type Review, type Warrior } from '../lib/domain';
import { useCamp } from '../lib/use-camp';
import LiveClock from './clock';
import {StaffLogin,DeviceAccess} from './access';
import { CampDate, CampTime } from './date-controls';

const GROUPS = Array.from({ length: 20 }, (_, i) => `Group ${String.fromCharCode(65 + i)}`);
const TITLES: Record<string, string> = {
  Overview: 'Camp overview', Warriors: 'Warrior registry', Warrior: 'Warrior record',
  'Clinical review': 'Clinical reviews', Reports: 'Reports & exports',
  'Sync centre': 'Sync centre', Settings: 'Camp settings',
};
const MODALS: Record<string, string> = {
  reading: 'Record glucose', register: 'Register a warrior', note: 'Add a care note',
  review: 'Request clinical review', exception: 'Record a check exception',
  regimen: 'Update prescribed regimen', administration: 'Record administration',
  assignment: 'Change group & room', members: 'Add or update staff',
  resolve: 'Complete clinical review', handover: 'Hand over this review',
};
const label = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
const shortTime = (value: string) => new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit' });
const shortDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', day: 'numeric', month: 'short' });
const fullDate = (value: string) => new Date(value + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const initials = (name: string) => name.split(' ').slice(0, 2).map(part => part[0]).join('').toUpperCase();
const authorName = (name: string) => name === 'seedy@sites.test' ? 'Local care team' : name;
function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  const color = Array.from(name).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 5;
  return <span className={`person-avatar tint-${color}${large ? ' avatar-large' : ''}`}>{initials(name)}</span>;
}
function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><ClipboardList size={24} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}
function Status({ value }: { value: string }) {
  return <span className={`status ${value === 'Resolved' || value === 'Synced' ? 'status-success' : value === 'Open' || value.includes('Pending') ? 'status-amber' : 'status-neutral'}`}><i />{value}</span>;
}

export default function Pilot() {
  const store = useCamp();
  const { camp, loading, online, pending, syncing, syncErrors, error, setError, notice, setNotice, send, sync } = store;
  const [tab, setTab] = useState('Overview');
  const [group, setGroup] = useState('Group A');
  const [day, setDay] = useState(careDay(new Date().toISOString()));
  const [search, setSearch] = useState('');
  const [registryScope, setRegistryScope] = useState('All groups');
  const [filter, setFilter] = useState('All warriors');
  const [checkFilter, setCheckFilter] = useState('All checks');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState('Overview');
  const [chartPeriod, setChartPeriod] = useState('All readings');
  const [reviewFilter, setReviewFilter] = useState('Active');
  const [reportScope, setReportScope] = useState('All groups');
  const [mobileNav, setMobileNav] = useState(false);
  const [modal, setModal] = useState<string | null>(null);
  const [formWarriorId, setFormWarriorId] = useState('');
  const [formSlot, setFormSlot] = useState<string>('Waking');
  const [formTime, setFormTime] = useState('');
  const [formDay, setFormDay] = useState(day);
  const [reviewTarget, setReviewTarget] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [printPending, setPrintPending] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(false);
  useEffect(() => { setLocal(['127.0.0.1', 'localhost'].includes(location.hostname)); }, []);

  const user = camp?.user;
  const role = user?.role || 'mentor';
  const warriors = camp?.warriors || [];
  const entries = camp?.entries || [];
  const reviews = camp?.reviews || [];
  const selected = warriors.find(warrior => warrior.id === selectedId);
  const formWarrior = warriors.find(warrior => warrior.id === formWarriorId);
  const regimen = camp?.regimens.find(item => item.warrior_id === formWarriorId);
  const selectedRegimen = camp?.regimens.find(item => item.warrior_id === selectedId);
  const ownQueue = pending.filter(item => item.actor === user?.id);
  const activeReviews = reviews.filter(review => review.status !== 'Resolved');
  const clinical = ['medical_lead', 'doctor', 'nurse', 'mentor'].includes(role);
  const scopedGroups = ['medical_lead', 'coordinator', 'analyst'].includes(role) ? GROUPS : user?.groups || [];
  const todayEntries = useMemo(() => entries.filter(entry => entry.care_day === day), [entries, day]);
  const readings = todayEntries.filter(entry => entry.kind === 'reading');
  const readingIndex = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of todayEntries) {
      if (!['reading', 'exception'].includes(entry.kind)) continue;
      const key = `${entry.warrior_id}:${entry.payload.slot}`;
      map.set(key, [...(map.get(key) || []), entry]);
    }
    return map;
  }, [todayEntries]);
  const groupWarriors = warriors.filter(warrior => warrior.group_name === group);
  const groupIds = new Set(groupWarriors.map(warrior => warrior.id));
  const groupReviews = activeReviews.filter(review => groupIds.has(review.warrior_id));
  const groupReadings = readings.filter(entry => groupIds.has(entry.warrior_id));
  const recordedSlots = new Set(groupReadings.filter(entry => slots.includes(entry.payload.slot)).map(entry => `${entry.warrior_id}:${entry.payload.slot}`));
  const searched = (warrior: Warrior) => `${warrior.name} ${warrior.id}`.toLowerCase().includes(search.toLowerCase());
  const roster = groupWarriors.filter(warrior => {
    if (!searched(warrior)) return false;
    if (filter === 'With readings') return readings.some(entry => entry.warrior_id === warrior.id);
    if (filter === 'No readings yet') return !readings.some(entry => entry.warrior_id === warrior.id);
    if (filter === 'Needs review') return activeReviews.some(review => review.warrior_id === warrior.id);
    return true;
  });
  const registry = warriors.filter(warrior => (registryScope === 'All groups' || warrior.group_name === registryScope) && searched(warrior));
  const pageSize = tab === 'Warriors' ? 12 : 8;
  const currentList = tab === 'Warriors' ? registry : roster;
  const shown = currentList.slice(page * pageSize, (page + 1) * pageSize);
  const shownSlots = checkFilter === 'All checks' ? slots : slots.filter(slot => slot === checkFilter);
  const warriorEntries = entries.filter(entry => entry.warrior_id === selectedId);
  const warriorPending = ownQueue.filter(command => command.warrior === selectedId);
  const chartReadings = warriorEntries.filter(entry => entry.kind === 'reading' && typeof entry.payload.value === 'number' && (chartPeriod !== 'This care day' || entry.care_day === day)).slice().reverse();
  const chartData = chartReadings.map(entry => ({ at: Date.parse(entry.measured_at), value: entry.payload.value }));
  const latestReading = warriorEntries.find(entry => entry.kind === 'reading');
  const latestActivity = entries.filter(entry => groupIds.has(entry.warrior_id)).slice(0, 4);
  const exportReadings = readings.filter(entry => reportScope === 'All groups' || warriors.some(warrior => warrior.id === entry.warrior_id && warrior.group_name === reportScope));

  useEffect(() => { setPage(0); }, [group, search, filter, registryScope, tab]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [tab, selectedId, profileTab]);
  useEffect(() => { if (scopedGroups.length && !scopedGroups.includes(group)) setGroup(scopedGroups[0]); }, [camp]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice, setNotice]);
  useEffect(() => {
    if (!printPending) return;
    const timer = setTimeout(() => { window.print(); setPrintPending(false); }, 150);
    return () => clearTimeout(timer);
  }, [printPending]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const element = dialogRef.current;
    const controls = () => Array.from(element?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type=hidden]),select,textarea,a[href]') || []);
    const firstInput = element?.querySelector<HTMLElement>('[data-initial-focus]') || element?.querySelector<HTMLElement>('input:not([type=hidden]),textarea,select');
    firstInput?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setModal(null);
      if (event.key !== 'Tab') return;
      const targets = controls();
      if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [modal, busy]);

  function navigate(destination: string) {
    setTab(destination); setMobileNav(false); setSearch(''); setError(''); setPage(0);
  }
  function viewWarrior(warrior: Warrior) {
    setSelectedId(warrior.id); setProfileTab('Overview'); setTab('Warrior'); setError('');
  }
  function open(type: string, warrior?: Warrior, slot?: string) {
    const target = warrior || (tab === 'Warrior' ? selected : undefined) || roster[0] || warriors[0];
    setFormWarriorId(target?.id || '');
    setFormSlot(slot || (checkFilter === 'All checks' ? 'Waking' : checkFilter));
    const now = new Date();
    const timestamp = day === careDay(now.toISOString()) ? now.toISOString().slice(0, 16) : `${day}T07:00`;
    setFormTime(timestamp); setFormDay(day); setModal(type); setError('');
  }
  function setObservationTime(value: string) {
    setFormTime(value);
    if (value && Number.isFinite(Date.parse(value + 'Z'))) setFormDay(careDay(new Date(value + 'Z').toISOString()));
  }
  function useCurrentTime() { setObservationTime(new Date().toISOString().slice(0, 16)); }
  function openReview(type: string, review: Review) {
    setReviewTarget(review); setFormWarriorId(review.warrior_id); setError(''); setModal(type);
  }
  async function updateReview(review: Review, status: string) {
    setBusy(true); setError('');
    try { await send('transition', { reviewId: review.id, version: review.version, status }, review.warrior_id); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload: Record<string, any> = Object.fromEntries(new FormData(event.currentTarget));
      if (['reading', 'exception', 'note', 'administration'].includes(modal || '')) {
        payload.measuredAt = new Date(`${payload.measurementDate}T${payload.measurementTime}Z`).toISOString();
        payload.careDay = formDay; payload.unit = 'mmol/L';
      }
      if (modal === 'reading') {
        const raw = String(payload.value).trim().toUpperCase();
        payload.value = ['HI', 'LO'].includes(raw) ? raw : Number(raw);
        payload.slot = formSlot;
      }
      if (modal === 'register') payload.age = Number(payload.age);
      if (modal === 'regimen') payload.baseVersion = regimen?.version || 0;
      if (modal === 'administration') {
        payload.dose = Number(payload.dose); payload.regimenId = regimen?.id;
        payload.medicine = regimen?.medicine; payload.regimenSeenAt = camp?.serverTime;
      }
      if (modal === 'assignment') payload.version = formWarrior?.version;
      if (modal === 'members') payload.groups = String(payload.groups || '').split(',').map(value => value.trim()).filter(Boolean);
      if (modal === 'resolve' || modal === 'handover') {
        if (!reviewTarget) throw Error('Select a clinical review first.');
        await send('transition', {
          reviewId: reviewTarget.id, version: reviewTarget.version,
          ...(modal === 'resolve' ? { status: 'Resolved', outcome: payload.outcome } : { action: 'handover', to: payload.to }),
        }, reviewTarget.warrior_id);
      } else await send(modal!, payload, ['register', 'members'].includes(modal!) ? undefined : formWarriorId);
      setModal(null);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function exportData() {
    setError('');try{
      const response=await fetch('/api/exports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({careDay:day,scope:reportScope})});
      if(!response.ok){const result=await response.json() as {error?:string;message?:string;next?:string};throw Error(result.error||'The export could not be created.');}
      const url=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=url;anchor.download=`dyc-readings-${day}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
      setNotice('Export created and recorded in the access log.');
    }catch(err){setError((err as Error).message);}
  }
  function printGroup() { setTab('Overview'); setSearch(''); setFilter('All warriors'); setCheckFilter('All checks'); setPrintPending(true); }

  const pagination = <div className="table-footer"><span>{currentList.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, currentList.length)}` : '0'} of {currentList.length} warriors</span><div><button className="icon-button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><span>Page {page + 1}</span><button className="icon-button" aria-label="Next page" disabled={(page + 1) * pageSize >= currentList.length} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></div>;
  const rosterRows = (printPending ? roster : shown).map(warrior => <tr key={warrior.id}>
    <td><button className="person" onClick={() => viewWarrior(warrior)}><Avatar name={warrior.name} /><span><strong>{warrior.name}</strong><small>{warrior.id} <b>·</b> Room {warrior.room || '—'}</small></span></button></td>
    {(printPending ? slots : shownSlots).map(slot => {
      const records = readingIndex.get(`${warrior.id}:${slot}`) || [];
      const latest = records[0];
      const queued = ownQueue.filter(item => item.warrior === warrior.id && item.payload.slot === slot && item.payload.careDay === day);
      return <td key={slot} className={checkFilter === slot ? 'focused-column' : ''}>
        {latest ? <button className="reading-cell" onClick={() => viewWarrior(warrior)}><strong>{latest.kind === 'reading' ? latest.payload.value : latest.payload.status}</strong><small>{shortTime(latest.measured_at)}{records.length > 1 ? ` · ${records.length} checks` : ''}</small></button> : queued.length ? null : can(role, 'reading') ? <button className="add-reading" aria-label={`Record ${slot} for ${warrior.name}`} onClick={() => open('reading', warrior, slot)}><Plus size={14} /><span>Record</span></button> : <span className="cell-empty">—</span>}
        {queued.length > 0 && <small className="queued-tag"><Clock3 size={10} />Pending sync</small>}
      </td>;
    })}
    <td><button className="icon-button" aria-label={`Open ${warrior.name}`} onClick={() => viewWarrior(warrior)}><ChevronRight size={17} /></button></td>
  </tr>);

  if (loading) return <div className="launch"><img className="launch-logo" src="/dyc-logo-light.png" alt="Diabetes Youth Care" width="768" height="398" /><h1>DYC Care</h1><p>Opening your camp workspace<span className="loading-dots">…</span></p></div>;
  if(store.gate==='setup'||store.gate==='locked')return <DeviceAccess setup={store.gate==='setup'} vaults={store.vaults} actor={store.deviceActor} onActor={store.setDeviceActor} onUnlock={store.unlockDevice} onSignOut={store.closeSession} error={error}/>;
  if(!camp)return <StaffLogin error={error}/>;

  return <div className="app">
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar${mobileNav ? ' is-open' : ''}`}>
      <a href="/" className="brand" aria-label="Diabetes Youth Care home"><img src="/dyc-logo.png" alt="Diabetes Youth Care — Reaching young Ghanaians living with diabetes" width="1024" height="505" /></a>
      <div className="camp-switch"><span className="camp-monogram">CV</span><div><strong>Camp Victory</strong><small>2026 camp workspace</small></div><span className="camp-live" aria-label="Local camp active" /></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Main navigation">{[
        ['Overview', LayoutDashboard], ['Warriors', Users], ['Clinical review', Stethoscope],
        ['Reports', FileSpreadsheet], ['Sync centre', RefreshCw], ['Settings', Settings],
      ].map(([name, Icon]: any) => <button key={name} className={tab === name || (tab === 'Warrior' && name === 'Warriors') ? 'active' : ''} onClick={() => navigate(name)}><Icon size={19} strokeWidth={1.7} /><span>{TITLES[name]}</span>{name === 'Clinical review' && activeReviews.length > 0 && <b className="nav-badge">{activeReviews.length}</b>}{name === 'Sync centre' && ownQueue.length > 0 && <b className="nav-badge">{ownQueue.length}</b>}</button>)}</nav>
      {scopedGroups.length > 0 && <div className="quick-groups"><span className="nav-label">YOUR GROUPS <small>{scopedGroups.length}</small></span>{scopedGroups.slice(0, 3).map((name, index) => <button key={name} className={tab === 'Overview' && group === name ? 'selected-group' : ''} onClick={() => { setGroup(name); navigate('Overview'); }}><span className={`group-symbol group-symbol-${index}`}>{name.slice(-1)}</span><span>{name}</span><small>{warriors.filter(warrior => warrior.group_name === name).length}</small></button>)}<button className="all-groups" onClick={() => { setRegistryScope('All groups'); navigate('Warriors'); }}>View all groups<ArrowUpRight size={14} /></button></div>}
      <div className="sidebar-bottom"><div className="local-card"><span><span className="live-dot" />{camp.mode==='demo'?'Local demonstration':'DYC care workspace'}</span><p>{camp.mode==='demo'?'Demo records. Real workflows.':'Approved staff · protected records'}</p></div><button className="identity" onClick={() => navigate('Settings')}><span className="identity-avatar">{local ? 'DC' : initials(user?.name || 'Care team')}</span><span><strong>{local ? 'Local care team' : user?.name}</strong><small>{label(role)}</small></span><ChevronDown size={15} /></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button><span>Camp Victory</span><ChevronRight size={14} /><strong>{TITLES[tab]}</strong></div><div className="top-actions"><LiveClock /><button className="workspace-search" onClick={() => { navigate('Warriors'); setTimeout(() => searchRef.current?.focus(), 50); }}><Search size={17} /><span>Find a warrior</span></button><span className={`connection${online ? '' : ' offline'}`}>{online ? <CheckCheck size={16} /> : <CloudOff size={16} />}<span>{online ? ownQueue.length ? `${ownQueue.length} pending` : 'All changes saved' : store.offlineEnabled?'Working offline':'Offline · reconnect to save'}</span></span><button className={`icon-button${syncing ? ' spinning' : ''}`} aria-label="Refresh and sync" disabled={syncing} onClick={() => void sync()}><RefreshCw size={17} /></button></div></header>
      <main className={tab === 'Overview' ? 'overview-page' : ''}>
        <div className="environment-line"><span className="demo-label"><ShieldCheck size={13} />{camp.mode==='demo'?'DEMO WORKSPACE':'STAFF WORKSPACE'}</span><span>{camp.mode==='demo'?'Synthetic data only':'Individual staff session'}</span><span className="environment-end">Africa/Accra · mmol/L</span></div>
        {notice && <div className="toast" role="status"><span className="toast-icon"><Check size={16} /></span>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
        {error && !modal && <div className="error-message" role="alert">{error}<button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}

        {tab === 'Overview' && <>
          <div className="page-heading overview-heading"><div><div className="care-signature"><svg aria-hidden="true" viewBox="0 0 38 22" fill="none"><path d="M2 18C8 18 8 6 17 6S26 18 36 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="10" cy="4" r="3" fill="#009EFF"/><circle cx="26" cy="7" r="3" fill="#16FFFF"/></svg><span>Care, together.</span></div><h1>Camp overview<span className="heading-dot">.</span></h1><p>Monitor readings and coordinate care across all groups.</p></div><div className="heading-actions"><CampDate label="Care day" value={day} onChange={setDay} />{can(role, 'reading') && <button className="primary" onClick={() => open('reading')}><Plus size={17} />Record reading</button>}</div></div>
          <div className="care-context"><CalendarDays size={14} /><span>{fullDate(day)}</span><span className="care-context-hours">Care day · 06:00–05:59 GMT</span></div><section className="camp-summary"><div className="summary-metrics"><div className="summary-metric"><span className="metric-icon"><Users size={20} /></span><div><small>Warriors at camp</small><strong>{warriors.length}<span>/ 300</span></strong><p>{new Set(warriors.map(warrior => warrior.group_name)).size} groups at camp</p></div></div><div className="summary-metric"><span className="metric-icon"><Activity size={20} /></span><div><small>Readings recorded</small><strong>{readings.length.toLocaleString()}</strong><p>Across this care day</p></div></div><button className="summary-metric review-metric" onClick={() => navigate('Clinical review')}><span className="metric-icon amber-icon"><Stethoscope size={20} /></span><div><small>Awaiting clinical review</small><strong>{activeReviews.length}<ArrowUpRight size={17} /></strong><p>{activeReviews.length ? 'Ready for your attention' : 'No unresolved reviews'}</p></div></button></div></section>
          <div className="overview-columns"><div className="monitoring-column"><section className="panel monitoring-panel"><div className="panel-heading"><div><span className="eyebrow">THE DAILY CHECK-IN</span><h2>Group monitoring</h2></div><select className="group-select" aria-label="Select group" value={group} onChange={event => setGroup(event.target.value)}>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></div><div className="monitoring-meta"><span><Users size={14} />{groupWarriors.length} warriors</span><span><CheckCheck size={14} />{recordedSlots.size} check slots recorded</span><span className="unit-label">mmol/L</span></div><div className="check-tabs" aria-label="Filter check columns">{['All checks', ...slots].map(slot => <button key={slot} className={checkFilter === slot ? 'selected' : ''} onClick={() => setCheckFilter(slot)}>{slot === 'Before lunch' ? 'Lunch' : slot === 'Before dinner' ? 'Dinner' : slot}</button>)}</div><div className="table-tools"><label className="search-field"><Search size={16} /><input aria-label="Search group warriors" placeholder="Search this group…" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="filter-select"><SlidersHorizontal size={14} /><select aria-label="Filter warriors" value={filter} onChange={event => setFilter(event.target.value)}><option>All warriors</option><option>With readings</option><option>No readings yet</option><option>Needs review</option></select></label></div>
            {clinical ? <div className="table-wrap" role="region" aria-label="Group monitoring readings; scroll horizontally for all checks" tabIndex={0}><div className="monitoring-scroll-hint">Swipe the table to see all checks<ArrowRight size={13} /></div><table className="monitoring-table"><thead><tr><th>Warrior</th>{(printPending ? slots : shownSlots).map(slot => <th key={slot}>{slot === 'Before lunch' ? <>Before<br />lunch</> : slot === 'Before dinner' ? <>Before<br />dinner</> : slot === '3 a.m.' ? <>3:00 a.m.<span className="th-note">Next morning</span></> : slot}</th>)}<th aria-label="Open record" /></tr></thead><tbody>{rosterRows}</tbody></table></div> : <div className="nonclinical-summary"><Users size={32} /><h3>{groupWarriors.length} warriors in {group}</h3><p>Your role has roster access. Clinical observations are available to the assigned care team.</p><button onClick={() => { setRegistryScope(group); navigate('Warriors'); }}>View group roster<ArrowRight size={16} /></button></div>}
            {!roster.length && <Empty title={warriors.length ? 'No warriors match this view' : 'Your camp is ready to begin'}>{warriors.length ? 'Try another group or change the filters.' : 'Load the synthetic roster to explore the care workspace.'}{user?.owner && !warriors.length && <button className="primary" onClick={async () => { try { await send('seed', {}); } catch (err) { setError((err as Error).message); } }}>Load demo camp</button>}</Empty>}{pagination}</section><div className="care-day-note"><Clock3 size={15} /><p>Overnight checks stay with their care day.<span>The 3 a.m. reading appears with the previous evening’s records.</span></p><span className="note-monogram">DYC</span></div></div>
            <aside className="context-column"><section className="panel review-preview"><div className="side-panel-heading"><h2>Clinical review queue</h2><span className="count-badge">{groupReviews.length}</span></div><p className="side-description">Staff-requested reviews in {group}.</p>{groupReviews.slice(0, 3).map(review => { const warrior = warriors.find(item => item.id === review.warrior_id); return <button className="review-preview-row" key={review.id} onClick={() => navigate('Clinical review')}><div className="review-preview-top"><Avatar name={warrior?.name || review.warrior_id} /><div><strong>{warrior?.name || review.warrior_id}</strong><small>{review.status} · {shortTime(review.created_at)}</small></div><ChevronRight size={15} /></div><p>{review.reason}</p></button>; })}{!groupReviews.length && <div className="small-empty"><ClipboardCheck size={25} /><p>No open reviews for this group.</p></div>}<button className="side-link" onClick={() => navigate('Clinical review')}>View clinical reviews<ArrowUpRight size={15} /></button></section><section className="panel activity-panel"><div className="side-panel-heading"><h2>Recent observations</h2><span className="live-dot" /></div>{latestActivity.map(entry => <div className="activity-row" key={entry.id}><span className={`activity-icon ${entry.kind === 'reading' ? '' : 'soft-purple'}`}>{entry.kind === 'reading' ? <Activity size={15} /> : <ClipboardList size={15} />}</span><div><strong>{warriors.find(warrior => warrior.id === entry.warrior_id)?.name || entry.warrior_id}</strong><p>{entry.kind === 'reading' ? `${entry.payload.value} mmol/L · ${entry.payload.slot}` : label(entry.kind)}</p><small>{shortTime(entry.measured_at)} · {authorName(entry.author)}</small></div></div>)}{!latestActivity.length && <div className="small-empty"><p>Recorded care will appear here.</p></div>}</section><div className="offline-note"><span className="offline-note-icon">{online ? <Wifi size={18} /> : <CloudOff size={18} />}</span><div><strong>{ownQueue.length ? `${ownQueue.length} ${ownQueue.length === 1 ? 'entry' : 'entries'} waiting to sync` : online ? 'Ready, wherever care happens.' : store.offlineEnabled?'You can keep recording.':'Reconnect to continue.'}</strong><p>{ownQueue.length ? 'Saved on this device until the team receives them.' : store.offlineEnabled?'New readings can be captured when your connection drops.':'Enable protected offline access in Camp settings to record without a connection.'}</p><button onClick={() => navigate('Sync centre')}>View sync status<ArrowRight size={13} /></button></div></div></aside>
          </div>
        </>}

        {tab === 'Warriors' && <><div className="page-heading"><div><span className="eyebrow">PEOPLE AT THE HEART OF CAMP</span><h1>Warrior registry<span className="heading-dot">.</span></h1><p>Every profile brings the person, their care and their team together.</p></div>{can(role, 'register') && <button className="primary" onClick={() => open('register')}><Plus size={17} />Register warrior</button>}</div><div className="registry-summary"><span className="registry-total"><Users size={20} /><strong>{warriors.length}</strong>warriors</span><span>{scopedGroups.length} groups</span><span>Camp Victory 2026</span></div><section className="panel"><div className="registry-tools"><label className="search-field"><Search size={17} /><input ref={searchRef} aria-label="Search all warriors" placeholder="Search by name or warrior ID…" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Registry group" value={registryScope} onChange={event => setRegistryScope(event.target.value)}><option>All groups</option>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></div><div className="table-wrap"><table className="registry-table"><thead><tr><th>Warrior</th><th>Group</th><th>Age</th><th>Room</th><th>Care record</th><th /></tr></thead><tbody>{shown.map(warrior => <tr key={warrior.id}><td><button className="person" onClick={() => viewWarrior(warrior)}><Avatar name={warrior.name} /><span><strong>{warrior.name}</strong><small>{warrior.id}</small></span></button></td><td><span className="group-tag"><i />{warrior.group_name}</span></td><td>{warrior.age} years</td><td>{warrior.room || '—'}</td><td>{activeReviews.some(review => review.warrior_id === warrior.id) ? <Status value="Open review" /> : <span className="quiet-status">Available</span>}</td><td><button className="row-open" onClick={() => viewWarrior(warrior)}>View record<ArrowUpRight size={15} /></button></td></tr>)}</tbody></table></div>{!registry.length && <Empty title="No warriors found">Try a different name, ID or group.</Empty>}{pagination}</section></>}

        {tab === 'Warrior' && selected && <><button className="back-link" onClick={() => navigate('Warriors')}><ArrowLeft size={15} />All warriors</button><div className="profile-heading"><Avatar name={selected.name} large /><div><span className="profile-id">{selected.id}<span className="small-demo">Demo profile</span></span><h1>{selected.name}</h1><p>{selected.age} years old<span>·</span>{selected.group_name}<span>·</span>Room {selected.room || 'unassigned'}</p></div><div className="profile-actions">{can(role, 'review') && <button onClick={() => open('review', selected)}><Stethoscope size={16} />Request review</button>}{can(role, 'reading') && <button className="primary" onClick={() => open('reading', selected)}><Plus size={17} />Record reading</button>}</div></div><div className="profile-tabs">{['Overview', 'Glucose history', 'Medicines', 'Care timeline'].map(name => <button key={name} className={profileTab === name ? 'selected' : ''} onClick={() => setProfileTab(name)}>{name}</button>)}</div>
          {['Overview', 'Glucose history'].includes(profileTab) && <div className="profile-columns"><div><section className="panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">GLUCOSE OBSERVATIONS</span><h2>See the picture over time.</h2></div><select aria-label="Chart period" value={chartPeriod} onChange={event => setChartPeriod(event.target.value)}><option>All readings</option><option>This care day</option></select></div><div className="chart-heading"><div><span className="chart-value">{latestReading?.payload.value ?? '—'}</span><span className="chart-unit">mmol/L</span><span className="latest-label">Latest recorded{latestReading ? ` · ${shortDate(latestReading.measured_at)}, ${shortTime(latestReading.measured_at)}` : ''}</span></div><span className="chart-legend"><i />Spot glucose checks</span></div>{chartData.length > 0 ? <div className="glucose-chart" role="img" aria-label={`${chartData.length} recorded glucose readings in mmol per litre, plotted by actual measurement time.`}><ResponsiveContainer width="100%" height={240}><LineChart data={chartData} margin={{ top: 16, right: 20, bottom: 5, left: -12 }}><CartesianGrid stroke="#e8eeeb" strokeDasharray="3 4" vertical={false} /><XAxis dataKey="at" type="number" domain={['dataMin', 'dataMax']} tickCount={4} tickFormatter={value => `${shortDate(new Date(value).toISOString())} ${shortTime(new Date(value).toISOString())}`} tick={{ fill: '#8a9994', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={28} /><YAxis domain={['auto', 'auto']} tick={{ fill: '#8a9994', fontSize: 11 }} tickLine={false} axisLine={false} width={45} /><Tooltip contentStyle={{ border: '1px solid #dce6e0', borderRadius: 10, fontSize: 12 }} labelFormatter={value => `${shortDate(new Date(Number(value)).toISOString())} · ${shortTime(new Date(Number(value)).toISOString())}`} formatter={value => [`${value} mmol/L`, 'Glucose']} /><Line type="linear" dataKey="value" stroke="#007bc4" strokeWidth={2.3} dot={{ r: 3.5, fill: '#fff', strokeWidth: 2, stroke: '#007bc4' }} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div> : <Empty title="A history starts with the first check">Recorded numeric readings will appear here.</Empty>}<div className="chart-caption">Discrete observations, not continuous monitoring. HI/LO readings appear in the history below.</div></section>
            {profileTab === 'Overview' && <section className="panel"><div className="panel-heading"><h2>Recent care</h2>{can(role, 'note') && <button className="text-button" onClick={() => open('note', selected)}><Plus size={15} />Add a note</button>}</div>{warriorEntries.slice(0, 4).map(entry => <CareEntry key={entry.id} entry={entry} />)}{!warriorEntries.length && <Empty title="No care recorded yet">Add the first reading or observation.</Empty>}</section>}
            {profileTab === 'Glucose history' && <section className="panel"><div className="panel-heading"><h2>Reading history</h2><span className="count-badge">{warriorEntries.filter(entry => entry.kind === 'reading').length}</span></div><div className="table-wrap"><table><thead><tr><th>Measured at</th><th>Reading</th><th>Check</th><th>Method</th><th>Recorded by</th></tr></thead><tbody>{warriorEntries.filter(entry => entry.kind === 'reading').map(entry => <tr key={entry.id}><td>{shortDate(entry.measured_at)}<small className="cell-subtext">{shortTime(entry.measured_at)}</small></td><td><strong>{entry.payload.value}</strong><small className="cell-subtext">mmol/L</small></td><td>{entry.payload.slot}</td><td>{entry.payload.method}</td><td>{authorName(entry.author)}</td></tr>)}</tbody></table></div></section>}
          </div><aside><section className="panel essentials-panel"><div className="side-panel-heading"><h2>Care essentials</h2><ShieldCheck size={17} /></div><dl><dt>Allergies & other conditions</dt><dd>{selected.allergies || 'Not available for this role'}</dd><dt>Guardian</dt><dd>{selected.guardian || 'Not recorded'}</dd><dt>Emergency contact</dt><dd>{selected.contact || 'Not recorded'}</dd></dl></section><section className="panel essentials-panel"><div className="side-panel-heading"><h2>Camp assignment</h2><Users size={17} /></div><div className="assignment-display"><span className="group-symbol">{selected.group_name.slice(-1)}</span><div><strong>{selected.group_name}</strong><small>Room {selected.room || 'unassigned'}</small></div></div>{can(role, 'assignment') && <button className="text-button" onClick={() => open('assignment', selected)}>Change group or room<ArrowUpRight size={14} /></button>}</section><section className="panel essentials-panel"><div className="side-panel-heading"><h2>Check exceptions</h2></div><p>Record a declined check or a doctor-approved schedule exception.</p>{can(role, 'exception') && <button className="button-block" onClick={() => open('exception', selected)}>Record an exception</button>}</section>{warriorPending.length > 0 && <div className="offline-note"><Clock3 size={20} /><p>{warriorPending.length} local entries awaiting sync. They will appear in this history after acceptance.</p></div>}</aside></div>}
          {profileTab === 'Medicines' && <div className="profile-columns"><section className="panel medicine-panel"><div className="panel-heading"><div><span className="eyebrow">CURRENT PRESCRIPTION</span><h2>Verified regimen</h2></div>{can(role, 'regimen') && <button onClick={() => open('regimen', selected)}><Plus size={16} />{selectedRegimen ? 'Update regimen' : 'Add regimen'}</button>}</div>{selectedRegimen ? <div className="regimen-detail"><span className="medicine-icon"><Pill size={25} /></span><div><h3>{selectedRegimen.medicine}</h3><p>{selectedRegimen.dose}</p><p className="muted">{selectedRegimen.instructions}</p><span className="regimen-meta">Version {selectedRegimen.version} · {shortDate(selectedRegimen.at)} · {authorName(selectedRegimen.author)}</span></div></div> : <Empty title="No verified regimen recorded">A doctor can add the prescribed medicine and instructions.</Empty>}{selectedRegimen && can(role, 'administration') && <div className="panel-action"><button className="primary" onClick={() => open('administration', selected)}><Plus size={16} />Record actual administration</button></div>}<div className="section-divider" /><div className="panel-heading"><h2>Administration history</h2></div>{warriorEntries.filter(entry => entry.kind === 'administration').map(entry => <CareEntry key={entry.id} entry={entry} />)}{!warriorEntries.some(entry => entry.kind === 'administration') && <div className="quiet-empty">No actual administrations recorded.</div>}</section><aside className="panel essentials-panel"><div className="side-panel-heading"><h2>Prescription history</h2></div>{camp.regimens.filter(item => item.warrior_id === selected.id).map(item => <div className="regimen-version" key={item.id}><span className="count-badge">v{item.version}</span><div><strong>{item.medicine}</strong><p>{item.dose}</p><small>{shortDate(item.at)} · {authorName(item.author)}</small></div></div>)}<p>Prescriptions and doses actually administered are recorded separately.</p></aside></div>}
          {profileTab === 'Care timeline' && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">ONE CONNECTED RECORD</span><h2>Care timeline</h2></div>{can(role, 'note') && <button onClick={() => open('note', selected)}><Plus size={16} />Add observation</button>}</div>{warriorEntries.map(entry => <CareEntry key={entry.id} entry={entry} />)}{!warriorEntries.length && <Empty title="No care recorded yet">Add the first observation to begin the timeline.</Empty>}</section>}
        </>}

        {tab === 'Clinical review' && <><div className="page-heading"><div><span className="eyebrow">ATTENTION, ACTION, FOLLOW-THROUGH</span><h1>Clinical reviews<span className="heading-dot">.</span></h1><p>Keep every request visible until the next step is complete.</p></div><span className="heading-badge"><Stethoscope size={16} />{activeReviews.length} unresolved</span></div><div className="review-toolbar"><div className="segmented">{['Active', 'Resolved', 'All'].map(name => <button className={reviewFilter === name ? 'selected' : ''} key={name} onClick={() => setReviewFilter(name)}>{name}{name === 'Active' && <span>{activeReviews.length}</span>}</button>)}</div><p><ShieldCheck size={14} />Staff-requested reviews · Automatic thresholds inactive</p></div><div className="reviews-grid">{reviews.filter(review => reviewFilter === 'All' || (reviewFilter === 'Resolved' ? review.status === 'Resolved' : review.status !== 'Resolved')).map(review => { const warrior = warriors.find(item => item.id === review.warrior_id); return <section className="panel clinical-card" key={review.id}><div className="clinical-card-heading"><Status value={review.status} /><small>{shortDate(review.created_at)} · {shortTime(review.created_at)}</small></div><button className="person review-person" onClick={() => warrior && viewWarrior(warrior)}><Avatar name={warrior?.name || review.warrior_id} /><span><strong>{warrior?.name || review.warrior_id}</strong><small>{review.warrior_id} · {warrior?.group_name}</small></span><ArrowUpRight size={16} /></button><p className="review-reason">{review.reason}</p><div className="review-owner"><span className="owner-avatar"><Stethoscope size={14} /></span><span><small>Accountable owner</small><strong>{authorName(review.owner)}</strong></span></div>{review.proposed_owner && <div className="handover-pending"><Clock3 size={15} /><span>Handover awaiting {review.proposed_owner}. Current owner remains responsible.</span></div>}{review.outcome && <div className="review-outcome"><CheckCheck size={16} /><p>{review.outcome}</p></div>}{can(role, 'transition') && <div className="review-actions">{['Open', 'Reopened'].includes(review.status) && <button className="primary" disabled={busy || !online} onClick={() => void updateReview(review, 'Acknowledged')}>Acknowledge<ArrowRight size={15} /></button>}{review.status === 'Acknowledged' && <button className="primary" disabled={busy || !online} onClick={() => void updateReview(review, 'In progress')}>Start assessment</button>}{['Acknowledged', 'In progress'].includes(review.status) && <button className="primary" disabled={busy || !online} onClick={() => openReview('resolve', review)}>Record outcome<Check size={15} /></button>}{review.status === 'Resolved' ? <button disabled={busy || !online} onClick={() => void updateReview(review, 'Reopened')}>Reopen review</button> : <button className="text-button" disabled={busy || !online} onClick={() => openReview('handover', review)}>Hand over<ArrowUpRight size={14} /></button>}{review.proposed_owner === user?.email && <button disabled={busy || !online} onClick={async () => { try { await send('transition', { reviewId: review.id, version: review.version, action: 'accept' }, review.warrior_id); } catch (err) { setError((err as Error).message); } }}>Accept handover</button>}</div>}</section>; })}</div>{!reviews.filter(review => reviewFilter === 'All' || (reviewFilter === 'Resolved' ? review.status === 'Resolved' : review.status !== 'Resolved')).length && <section className="panel"><Empty title="Nothing waiting in this view">New staff review requests will appear here.</Empty></section>}</>}

        {tab === 'Reports' && <><div className="page-heading"><div><span className="eyebrow">FROM OBSERVATIONS TO UNDERSTANDING</span><h1>Reports & exports<span className="heading-dot">.</span></h1><p>Bring the camp’s care records into a format your team can use.</p></div></div><section className="report-controls panel"><div><label>Care day<input type="date" value={day} onChange={event => setDay(event.target.value)} /></label><label>Group<select value={reportScope} onChange={event => setReportScope(event.target.value)}><option>All groups</option>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></label></div><span><CheckCheck size={16} /><strong>{exportReadings.length.toLocaleString()}</strong>synced readings in this selection</span></section><div className="report-grid"><section className="panel report-card"><span className="report-icon"><FileSpreadsheet size={26} /></span><span className="eyebrow">ANALYSIS READY</span><h2>Glucose reading export</h2><p>One row per reading, with care day, measurement time, unit, method and author.</p><div className="report-format"><span>CSV</span><span>Excel compatible</span></div>{['medical_lead', 'analyst', 'doctor', 'nurse'].includes(role) ? <button className="primary" onClick={exportData}><Download size={16} />Export {exportReadings.length} readings</button> : <span className="permission-note"><LockKeyhole size={14} />Clinical export permission required</span>}</section><section className="panel report-card"><span className="report-icon sand"><ClipboardList size={26} /></span><span className="eyebrow">AT A GLANCE</span><h2>Daily group sheet</h2><p>Print the five-check monitoring sheet with separate bedtime and overnight columns.</p><label className="report-group">Print group<select value={group} onChange={event => setGroup(event.target.value)}>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></label><button onClick={printGroup}><ArrowDownToLine size={16} />Print {group} sheet</button></section><section className="panel report-card"><span className="report-icon lilac"><Stethoscope size={26} /></span><span className="eyebrow">CONTINUITY OF CARE</span><h2>Clinical review register</h2><p>Review ownership, status, assessments and outstanding handovers in one place.</p><div className="review-register-count"><strong>{activeReviews.length}</strong><span>unresolved reviews</span></div><button onClick={() => navigate('Clinical review')}>Open review register<ArrowUpRight size={16} /></button></section></div><div className="export-note"><ShieldCheck size={18} /><p><strong>A report is only as current as its last sync.</strong>Pending entries stay on their device until accepted. Last refreshed {shortDate(camp.serverTime)} at {shortTime(camp.serverTime)} GMT.</p></div></>}

        {tab === 'Sync centre' && <><div className="page-heading"><div><span className="eyebrow">CARE CONTINUES, EVEN OFFLINE</span><h1>Sync centre<span className="heading-dot">.</span></h1><p>Know what is saved here and what has reached the shared record.</p></div><button className="primary" disabled={syncing} onClick={() => void sync()}><RefreshCw size={16} className={syncing ? 'spinning' : ''} />{syncing ? 'Syncing…' : 'Sync now'}</button></div><div className={`sync-summary ${pending.length ? 'has-pending' : ''}`}><span className="sync-summary-icon">{pending.length ? <CloudOff size={30} /> : <CheckCheck size={30} />}</span><div><h2>{pending.length ? `${pending.length} ${pending.length === 1 ? 'entry is' : 'entries are'} waiting to sync` : 'Everything is up to date.'}</h2><p>{pending.length ? 'These records are saved on this device. They will be retried when the connection is available.' : 'Your local queue is clear. Saved records are available in the shared camp history.'}</p><span>{online ? 'Connected' : 'Offline'} · Last refresh {shortTime(camp.serverTime)} GMT</span></div></div><section className="panel"><div className="panel-heading"><h2>Device queue</h2><span className="count-badge">{pending.length}</span></div>{pending.map(command => <div className="queue-row" key={command.id}><span className="queue-icon"><ClipboardList size={20} /></span><div><strong>{warriors.find(warrior => warrior.id === command.warrior)?.name || command.warrior}</strong><p>{label(command.type)}{command.payload.value !== undefined ? ` · ${command.payload.value} mmol/L` : ''}{command.payload.slot ? ` · ${command.payload.slot}` : ''}</p><small>{shortDate(command.createdAt)} · {shortTime(command.createdAt)} · {command.actor === user?.id ? 'Your entry' : 'Original author must sign in'}</small>{syncErrors[command.id] && <div className="queue-error">Needs reconciliation: {syncErrors[command.id]}</div>}</div><Status value={syncErrors[command.id] ? 'Needs review' : 'Pending sync'} /></div>)}{!pending.length && <Empty title="No entries left behind">New offline entries will appear here until the team receives them.</Empty>}</section><div className="export-note"><LockKeyhole size={18} /><p>{store.offlineEnabled?'Records on this device are encrypted with your device passphrase. Offline access lasts up to 8 hours after a verified refresh.':'You are using an online session. Entries are sent directly to the camp server. Enable protected offline access in Camp settings if you need to work without a connection.'} Close your staff session before handing over a shared device.</p></div></>}

        {tab === 'Settings' && <><div className="page-heading"><div><span className="eyebrow">A WORKSPACE BUILT AROUND THE TEAM</span><h1>Camp settings<span className="heading-dot">.</span></h1><p>Your camp, care-team access and local testing details.</p></div>{user?.owner && <button className="primary" onClick={() => open('members')}><Plus size={16} />Add or update staff</button>}</div><div className="settings-grid"><section className="panel settings-card"><div className="panel-heading"><h2>Camp configuration</h2><span className="camp-monogram">CV</span></div><dl className="settings-list"><div><dt>Camp</dt><dd>Camp Victory 2026</dd></div><div><dt>Capacity</dt><dd>300 warriors · 20 groups</dd></div><div><dt>Glucose unit</dt><dd>mmol/L</dd></div><div><dt>Care day</dt><dd>06:00–05:59 · Africa/Accra</dd></div><div><dt>Clinical thresholds</dt><dd><span className="status status-neutral">Inactive</span></dd></div></dl></section><section className="panel settings-card"><div className="panel-heading"><h2>Your staff session</h2><ShieldCheck size={20} /></div><dl className="settings-list"><div><dt>Account</dt><dd>{user?.email}</dd></div><div><dt>Role</dt><dd>{label(role)}</dd></div><div><dt>Access</dt><dd>{role === 'medical_lead' ? 'All camp groups' : user?.groups.join(', ') || 'No groups assigned'}</dd></div><div><dt>Workspace</dt><dd>{local ? 'Local · this Mac' : 'Hosted workspace'}</dd></div></dl><div className="access-footnote"><p>{store.offlineEnabled?'Protected offline access is enabled on this device.':'Online session · no camp records are saved on this device.'}</p>{!store.offlineEnabled&&<button type="button" onClick={()=>{void store.enableOffline().catch(err=>setError(err.message));}}>Enable protected offline access</button>}</div><button className="settings-signout" onClick={()=>{void store.closeSession().catch(err=>setError(err.message));}}>Close staff session<ArrowUpRight size={14} /></button></section></div>{user?.owner && <section className="panel"><div className="panel-heading"><div><span className="eyebrow">CARE TEAM</span><h2>Staff access</h2></div><span className="count-badge">{camp.members.length} accounts</span></div><div className="table-wrap"><table><thead><tr><th>Staff account</th><th>Role</th><th>Assigned groups</th><th>Access</th></tr></thead><tbody>{camp.members.map(member => <tr key={member.email}><td><span className="staff-email"><span className="staff-mini-avatar">{member.email[0].toUpperCase()}</span>{member.email}</span></td><td>{label(member.role)}</td><td>{member.role === 'medical_lead' ? 'All groups' : member.groups.join(', ') || 'No group access'}</td><td>{member.email===user?.email?'Your account':<button type="button" onClick={()=>{void send('members',{...member,active:member.active===false}).catch(err=>setError(err.message));}}>{member.active===false?'Restore access':'Suspend access'}</button>}</td></tr>)}</tbody></table></div></section>}<section className="panel rehearsal-panel"><div><span className="eyebrow">TRY THE WORKFLOW</span><h2>A quick camp rehearsal.</h2><p>Use the demo records to try the same steps staff will take at camp.</p></div><ol><li><span>01</span>Open a warrior and record a glucose reading.</li><li><span>02</span>Request a review, acknowledge it and record an outcome.</li><li><span>03</span>Try an offline reading, then reconnect and sync.</li><li><span>04</span>Export the readings and compare them with the group sheet.</li></ol></section></>}
        <footer className="page-footer"><span><HeartPulse size={13} />DYC Care</span><span>Supporting warriors. Connecting care.</span><span>Camp Victory 2026</span></footer>
      </main>
    </div>

    {modal && <div className={`modal-backdrop${modal === 'reading' ? ' drawer-backdrop' : ''}`} onMouseDown={event => { if (event.target === event.currentTarget && !busy) setModal(null); }}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal${modal === 'reading' ? ' reading-drawer' : ''}`}><div className="modal-header"><div><span className="eyebrow">{modal === 'reading' ? 'GLUCOSE CHECK' : 'CAMP VICTORY'}</span><h2 id="modal-title">{MODALS[modal]}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)} disabled={busy}><X size={20} /></button></div><form onSubmit={submit} key={modal + (reviewTarget?.id || '')}><div className="modal-content">
      {modal === 'reading' && <><label className="form-label">Warrior<select aria-label="Warrior for reading" value={formWarriorId} onChange={event => setFormWarriorId(event.target.value)}>{warriors.map(warrior => <option key={warrior.id} value={warrior.id}>{warrior.name} · {warrior.id}</option>)}</select></label>{formWarrior && <div className="entry-person"><Avatar name={formWarrior.name} /><div><strong>{formWarrior.name}</strong><small>{formWarrior.group_name} · Room {formWarrior.room} · {formWarrior.age} years</small></div></div>}<label className="glucose-input-label">Measured glucose<div className="glucose-input"><input data-initial-focus name="value" aria-label="Measured value in mmol/L" inputMode="decimal" autoComplete="off" placeholder="0.0" required /><span>mmol/L</span></div><small>You can also enter a device-reported HI or LO.</small></label><fieldset className="check-picker"><legend>Which check is this?</legend>{[...slots, 'Unscheduled'].map(slot => <label key={slot}><input type="radio" name="slot" value={slot} checked={formSlot === slot} onChange={() => setFormSlot(slot)} /><span>{slot}</span></label>)}</fieldset></>}
      {!['reading', 'register', 'members'].includes(modal) && formWarrior && <div className="entry-person"><Avatar name={formWarrior.name} /><div><strong>{formWarrior.name}</strong><small>{formWarrior.id} · {formWarrior.group_name}</small></div></div>}
      {['reading', 'exception', 'note', 'administration'].includes(modal) && <section className="observation-timing" aria-label="Observation date and time">
        <div className="timing-heading"><span>When was this measured?</span><button type="button" className="use-now" onClick={useCurrentTime}><Clock3 size={13} />Use current time</button></div>
        <div className="timing-grid">
          <div className="form-label">Measurement date<CampDate label="Measurement date" name="measurementDate" value={formTime.slice(0,10)} onChange={value => setObservationTime(`${value}T${formTime.slice(11,16)}`)} /></div>
          <div className="form-label">Measurement time<CampTime value={formTime.slice(11,16)} onChange={value => setObservationTime(`${formTime.slice(0,10)}T${value}`)} /></div>
        </div>
        <div className="care-day-summary"><span>Care day · <strong>{new Date(formDay + 'T12:00:00Z').toLocaleDateString('en-GB', {day:'numeric',month:'short',timeZone:'UTC'})}</strong></span><details><summary>Adjust care day</summary><CampDate label="Observation care day" name="careDay" value={formDay} onChange={setFormDay} /></details><small>Before 06:00, readings belong to the previous care day.</small></div>
        {formTime && Number.isFinite(Date.parse(formTime+'Z')) && formDay !== careDay(new Date(formTime + 'Z').toISOString()) && <label className="form-label">Reason for changing the care day<input name="overrideReason" required /></label>}
      </section>}
      {modal === 'reading' && <><label className="form-label">Measurement method<select name="method"><option>Finger-prick glucometer</option><option>CGM transcription</option><option>Laboratory transcription</option></select></label><label className="form-label">Action or observation <span className="optional">Optional</span><textarea name="note" rows={3} placeholder="Add any action taken or context for the care team…" /></label><div className="save-explainer"><ShieldCheck size={15} /><span>Saved to this warrior’s history and group monitoring sheet.</span></div></>}
      {modal === 'note' && <label className="form-label">Care observation<textarea data-initial-focus name="note" rows={5} placeholder="What does the next member of the care team need to know?" required /></label>}
      {modal === 'review' && <><label className="form-label">What needs a clinical review?<textarea data-initial-focus name="reason" rows={5} required placeholder="Describe the observation and the reason for review…" /></label><div className="form-info"><Stethoscope size={18} /><p>The medical lead receives this request. A doctor takes ownership when they acknowledge it.</p></div></>}
      {modal === 'exception' && <><div className="form-grid"><label className="form-label">Scheduled check<select name="slot" defaultValue={formSlot}>{slots.map(slot => <option key={slot}>{slot}</option>)}</select></label><label className="form-label">Status<select name="status"><option>Declined</option>{['medical_lead', 'doctor'].includes(role) && <option>Not required</option>}</select></label></div><label className="form-label">Reason<textarea name="note" rows={4} required /></label><div className="form-info"><ClipboardCheck size={18} /><p>A declined check creates a review request. Only a doctor can mark a check not required.</p></div></>}
      {modal === 'register' && <><label className="form-label">Warrior name<input data-initial-focus name="name" required placeholder={camp.mode==='demo'?'Use a synthetic name for testing':'Full name'} /></label><div className="form-grid"><label className="form-label">Age<input type="number" name="age" min="0" max="120" required /></label><label className="form-label">Group<select name="group" defaultValue={group}>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></label><label className="form-label">Room<input name="room" /></label><label className="form-label">Guardian name<input name="guardian" /></label></div><label className="form-label">Emergency contact<input name="contact" placeholder={camp.mode==='demo'?'Test contact details only':'Emergency contact number'} /></label><label className="form-label">Allergies / other medical conditions<input name="allergies" defaultValue="Unknown" /></label></>}
      {modal === 'assignment' && <div className="form-grid"><label className="form-label">Group<select name="group" defaultValue={formWarrior?.group_name}>{scopedGroups.map(name => <option key={name}>{name}</option>)}</select></label><label className="form-label">Room<input name="room" defaultValue={formWarrior?.room} /></label></div>}
      {modal === 'regimen' && <><label className="form-label">Medicine<input data-initial-focus name="medicine" defaultValue={regimen?.medicine} required /></label><label className="form-label">Prescribed dose and unit<input name="dose" defaultValue={regimen?.dose} required /></label><label className="form-label">Schedule, instructions and reason for change<textarea name="instructions" defaultValue={regimen?.instructions} rows={5} required /></label><div className="form-info"><Pill size={18} /><p>This saves a new prescription version. Earlier versions remain in the warrior’s record.</p></div></>}
      {modal === 'administration' && <><div className="prescription-reference"><span>VERIFIED PRESCRIPTION · VERSION {regimen?.version}</span><strong>{regimen?.medicine}</strong><p>{regimen?.dose}</p></div><div className="form-grid"><label className="form-label">Actual dose<input name="dose" type="number" min="0.01" step="any" required /></label><label className="form-label">Dose unit<input name="doseUnit" placeholder="e.g. units" required /></label></div><label className="form-label">Administration notes<textarea name="note" rows={3} /></label><div className="form-info"><Clock3 size={18} /><p>Confirm recent doses directly. Another offline device may have an administration waiting to sync. Last refreshed {shortTime(camp.serverTime)} GMT.</p></div></>}
      {modal === 'members' && <><label className="form-label">Staff email<input data-initial-focus type="email" name="email" required /></label><label className="form-label">Role<select name="role">{roles.map(name => <option key={name} value={name}>{label(name)}</option>)}</select></label><label className="form-label">Assigned groups<input name="groups" placeholder="Group A, Group B" /><small>Separate multiple groups with commas.</small></label></>}
      {modal === 'resolve' && <><div className="form-review-context"><Status value={reviewTarget?.status || 'Open'} /><p>{reviewTarget?.reason}</p></div><label className="form-label">Assessment and outcome<textarea data-initial-focus name="outcome" rows={5} required placeholder="Document the assessment, action taken and outcome…" /></label></>}
      {modal === 'handover' && <><div className="form-review-context"><span className="eyebrow">CURRENT OWNER</span><strong>{authorName(reviewTarget?.owner || '')}</strong><p>{reviewTarget?.reason}</p></div><label className="form-label">Incoming doctor’s email<input data-initial-focus name="to" type="email" list="available-doctors" required /><datalist id="available-doctors">{camp.members.filter(member => ['medical_lead', 'doctor'].includes(member.role)).map(member => <option key={member.email}>{member.email}</option>)}</datalist></label><div className="form-info"><Users size={18} /><p>Ownership transfers only after the incoming doctor accepts the handover.</p></div></>}
      {error && <div className="error-message" role="alert">{error}</div>}
    </div><div className="modal-footer"><span className={online ? 'save-status' : 'save-status offline'}>{online ? <CheckCheck size={14} /> : <CloudOff size={14} />}{online ? 'Ready to save' : store.offlineEnabled?'Saves on this device':'Reconnect to save'}</span><button type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="primary" type="submit" disabled={busy}>{busy ? 'Saving…' : modal === 'reading' ? 'Save reading' : modal === 'resolve' ? 'Resolve review' : modal === 'handover' ? 'Request handover' : 'Save record'}<Check size={16} /></button></div></form></section></div>}
  </div>;
}

function CareEntry({ entry }: { entry: Entry }) {
  return <div className="care-entry"><span className={`care-entry-icon ${entry.kind === 'reading' ? '' : 'soft-purple'}`}>{entry.kind === 'reading' ? <Activity size={17} /> : entry.kind === 'administration' ? <Pill size={17} /> : <ClipboardList size={17} />}</span><div><div className="care-entry-top"><strong>{entry.kind === 'reading' ? `${entry.payload.value} mmol/L` : entry.kind === 'administration' ? `${entry.payload.medicine} · ${entry.payload.dose} ${entry.payload.doseUnit}` : entry.kind === 'exception' ? `${entry.payload.slot} · ${entry.payload.status}` : 'Care observation'}</strong><small>{shortDate(entry.measured_at)} · {shortTime(entry.measured_at)}</small></div><p>{entry.kind === 'reading' ? entry.payload.slot : label(entry.kind)}{entry.payload.note ? ` · ${entry.payload.note}` : ''}</p><small>{authorName(entry.author)} · Care day {entry.care_day}</small></div></div>;
}
