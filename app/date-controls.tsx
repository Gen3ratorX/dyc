'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Check, Clock3 } from 'lucide-react';

function dateText(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function CampDate({ value, onChange, name, label }: { value: string; onChange: (value: string) => void; name?: string; label: string }) {
  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const first = new Date(`${month}-01T12:00:00Z`);
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setUTCDate(start.getUTCDate() + index); return day; });
  function move(amount: number) { const next = new Date(first); next.setUTCMonth(first.getUTCMonth() + amount); setMonth(iso(next).slice(0, 7)); }
  function choose(day: string) { onChange(day); setExpanded(false); }
  return <div className="camp-date">
    {name && <input type="hidden" name={name} value={value} />}
    <button type="button" className="date-trigger" aria-label={label} aria-expanded={expanded} onClick={() => { setMonth(value.slice(0, 7)); setExpanded(!expanded); }}><CalendarDays size={16} /><span>{dateText(value)}</span><span className="date-edit">{expanded ? 'Close' : 'Change'}</span></button>
    {expanded && <div className="inline-calendar" role="group" aria-label={`${label} calendar`}>
      <div className="calendar-heading"><button type="button" aria-label={`Previous month for ${label}`} onClick={() => move(-1)}><ChevronLeft size={16} /></button><strong>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong><button type="button" aria-label={`Next month for ${label}`} onClick={() => move(1)}><ChevronRight size={16} /></button></div>
      <div className="calendar-days">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index} aria-hidden="true">{day}</span>)}{days.map(day => <button type="button" key={iso(day)} aria-label={day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} aria-pressed={iso(day) === value} className={`${iso(day) === value ? 'chosen' : ''} ${iso(day).slice(0, 7) !== month ? 'other-month' : ''}`} onClick={() => choose(iso(day))}>{day.getUTCDate()}</button>)}</div>
      <div className="calendar-bottom"><button type="button" onClick={() => choose(iso(new Date()))}>Today</button><button type="button" onClick={() => setExpanded(false)}><Check size={13} />Done</button></div>
    </div>}
  </div>;
}

export function CampTime({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [parts, setParts] = useState(value.split(':'));
  useEffect(() => setParts(value.split(':')), [value]);
  function update(part: number, text: string) {
    if (!/^\d{0,2}$/.test(text)) return;
    const draft = [...parts]; draft[part] = text; setParts(draft);
    if (!text) return;
    const number = Number(text);
    if (number > (part === 0 ? 23 : 59)) return;
    const pieces = value.split(':'); pieces[part] = text.padStart(2, '0'); onChange(pieces.join(':'));
  }
  return <div className="camp-time"><Clock3 size={16} /><input type="hidden" name="measurementTime" value={value} /><input aria-label="Measurement hour" type="number" min="0" max="23" value={parts[0]} onFocus={event => event.target.select()} onChange={event => update(0, event.target.value)} required /><span>:</span><input aria-label="Measurement minute" type="number" min="0" max="59" value={parts[1]} onFocus={event => event.target.select()} onChange={event => update(1, event.target.value)} required /><small>GMT · 24h</small></div>;
}
