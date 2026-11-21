'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  return <div className="camp-date" onKeyDown={event=>{if(event.key==='Escape'&&expanded){event.preventDefault();event.stopPropagation();setExpanded(false);}}}>
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
  const [hour,setHour]=useState('12');
  const [minute,setMinute]=useState('00');
  const [period,setPeriod]=useState<'AM'|'PM'>('AM');
  const editing=useRef(false);
  const sync=useCallback((raw:string)=>{
    const [hourText='00',minuteText='00']=raw.split(':');
    const hour24=Number(hourText);
    setHour(String(hour24%12||12));
    setMinute(String(Number(minuteText)||0).padStart(2,'0'));
    setPeriod(hour24>=12?'PM':'AM');
  },[]);
  useEffect(()=>{if(!editing.current)sync(value);},[sync,value]);
  function commit(nextHour:string,nextMinute:string,nextPeriod:'AM'|'PM'){
    if(!/^(?:[1-9]|1[0-2])$/.test(nextHour)||!/^\d{1,2}$/.test(nextMinute)||Number(nextMinute)>59)return;
    const hour12=Number(nextHour);
    const hour24=(hour12%12)+(nextPeriod==='PM'?12:0);
    onChange(`${String(hour24).padStart(2,'0')}:${String(Number(nextMinute)).padStart(2,'0')}`);
  }
  function editHour(text:string){if(!/^\d{0,2}$/.test(text))return;editing.current=true;setHour(text);commit(text,minute,period);}
  function editMinute(text:string){if(!/^\d{0,2}$/.test(text))return;editing.current=true;setMinute(text);commit(hour,text,period);}
  function editPeriod(next:'AM'|'PM'){editing.current=true;setPeriod(next);commit(hour,minute,next);}
  return <div className="camp-time" onFocusCapture={()=>{editing.current=true;}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){editing.current=false;sync(value);}}}>
    <Clock3 size={16}/><input type="hidden" name="measurementTime" value={value}/>
    <input aria-label="Hour" type="text" inputMode="numeric" pattern="(?:[1-9]|1[0-2])" maxLength={2} value={hour} onFocus={event=>event.target.select()} onChange={event=>editHour(event.target.value)} required/>
    <span>:</span>
    <input aria-label="Minute" type="text" inputMode="numeric" pattern="(?:[0-9]|[0-5][0-9])" maxLength={2} value={minute} onFocus={event=>event.target.select()} onChange={event=>editMinute(event.target.value)} required/>
    <select aria-label="AM or PM" value={period} onChange={event=>editPeriod(event.target.value as 'AM'|'PM')}><option>AM</option><option>PM</option></select>
    <small>GMT</small>
  </div>;
}
