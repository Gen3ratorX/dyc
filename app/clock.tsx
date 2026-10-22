'use client';
import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const time = now?.toLocaleTimeString('en-GB', { timeZone: 'Africa/Accra', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) || '—:—:—';
  const date = now?.toLocaleDateString('en-GB', { timeZone: 'Africa/Accra', weekday: 'short', day: 'numeric', month: 'short' }) || 'Accra';
  return <div className="live-clock" aria-label="Current date and time in Accra" aria-live="off"><Clock3 size={17} aria-hidden="true" /><div><time dateTime={now?.toISOString()}>{time}<span>GMT</span></time><small>{date}</small></div></div>;
}
