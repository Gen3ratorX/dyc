'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,AlertCircle,CheckCheck,Clock3,RefreshCw,Search,ShieldCheck,Stethoscope} from 'lucide-react';

type TriageCase={id:string;kind:'meter_flag'|'staff_request';flag?:'HI'|'LO';status:string;owner:string;proposed_owner:string|null;created_at:string;name:string;group_name:string;room:string};
type Filter='All open'|'Needs clinician'|'With clinician'|'Handover pending';
const filters:Filter[]=['All open','Needs clinician','With clinician','Handover pending'];
const takenOver=(item:Pick<TriageCase,'status'>)=>['Acknowledged','In progress'].includes(item.status);
const stamp=(value:string)=>new Date(value).toLocaleString('en-GB',{timeZone:'Africa/Accra',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

function State({value}:{value:string}){
 return <span className={`status ${takenOver({status:value})?'status-success':value==='Open'||value==='Reopened'||value==='Needs clinician'?'status-amber':'status-neutral'}`}><i/>{value}</span>;
}

export default function AdminTriage(){
 const [cases,setCases]=useState<TriageCase[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<Filter>('All open');
 const [refreshing,setRefreshing]=useState(false);
 const refresh=useCallback(async()=>{
  setRefreshing(true);setError('');
  try{const response=await fetch('/api/triage',{cache:'no-store'});const result=await response.json() as {cases?:TriageCase[];error?:string};if(!response.ok)throw Error(result.error||'Triage status could not be loaded.');setCases(result.cases||[]);}
  catch(cause){setError(cause instanceof Error?cause.message:'Triage status could not be loaded.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const needsClinician=cases.filter(item=>!takenOver(item));
 const withClinician=cases.filter(takenOver);
 const handovers=cases.filter(item=>Boolean(item.proposed_owner));
 const shown=useMemo(()=>cases.filter(item=>{
  const matchesFilter=filter==='All open'||(filter==='Needs clinician'&&!takenOver(item))||(filter==='With clinician'&&takenOver(item))||(filter==='Handover pending'&&Boolean(item.proposed_owner));
  const text=`${item.name} ${item.group_name} ${item.room}`.toLowerCase();
  return matchesFilter&&text.includes(query.trim().toLowerCase());
 }),[cases,filter,query]);

 return <div className="admin-triage-page">
  <div className="page-heading"><div><span className="eyebrow">CAMP OPERATIONS</span><h1>Clinical triage<span className="heading-dot">.</span></h1><p>Track open requests for clinical follow-up and whether a clinician has taken responsibility.</p></div><button className="triage-refresh" onClick={()=>void refresh()} disabled={refreshing} type="button"><RefreshCw size={16} className={refreshing?'spinning':''}/>{refreshing?'Refreshing…':'Refresh'}</button></div>
  <div className="triage-privacy-note"><ShieldCheck size={18}/><p>This screen flags the meter’s HI/LO display and staff-requested reviews. It does not show numeric glucose values, clinical notes, or reading history. Numeric alert thresholds are not configured.</p></div>
  {error&&<div className="error-message" role="alert">{error}</div>}
  <div className="triage-metrics" aria-label="Triage summary">
   <section className="panel triage-metric"><span className="triage-metric-icon"><Activity size={19}/></span><div><strong>{cases.length}</strong><span>Open requests</span></div></section>
   <section className="panel triage-metric"><span className="triage-metric-icon triage-waiting"><AlertCircle size={19}/></span><div><strong>{needsClinician.length}</strong><span>Needs clinician</span></div></section>
   <section className="panel triage-metric"><span className="triage-metric-icon triage-covered"><CheckCheck size={19}/></span><div><strong>{withClinician.length}</strong><span>Clinician responsible</span></div></section>
   <section className="panel triage-metric"><span className="triage-metric-icon triage-handover"><Clock3 size={19}/></span><div><strong>{handovers.length}</strong><span>Handover awaiting acceptance</span></div></section>
  </div>
  <section className="panel triage-list-panel">
   <div className="triage-list-heading"><div><span className="eyebrow">FOLLOW-UP QUEUE</span><h2>Open clinical requests</h2></div><label className="triage-search"><Search size={17}/><input value={query} onChange={event=>setQuery(event.target.value)} aria-label="Search triage by warrior, group or room" placeholder="Search warrior, group or room"/></label></div>
   <div className="triage-filter" role="group" aria-label="Filter triage requests">{filters.map(item=><button type="button" key={item} className={filter===item?'selected':''} onClick={()=>setFilter(item)}>{item}{item==='All open'&&<span>{cases.length}</span>}</button>)}</div>
   {loading?<div className="triage-loading" role="status">Loading triage requests…</div>:shown.length?<div className="triage-case-list">{shown.map(item=><article className="triage-case" key={item.id}>
    <div className="triage-case-person"><span className="triage-person-icon"><Stethoscope size={17}/></span><div><strong>{item.name}</strong><span>{item.group_name} · {item.room||'Room unassigned'}</span></div></div>
    <div className="triage-case-state"><span className="triage-case-kind">{item.kind==='meter_flag'?`Meter display · ${item.flag}`:'Staff requested review'}</span><State value={item.status}/><small>{item.kind==='meter_flag'?'Measured':'Requested'} {stamp(item.created_at)}</small></div>
    <div className="triage-case-owner"><small>Responsible clinician</small><strong>{takenOver(item)?item.owner||'Clinician has taken responsibility':'Awaiting clinician acceptance'}</strong>{item.proposed_owner&&<span className="triage-handover-note">Handover awaiting {item.proposed_owner}</span>}</div>
   </article>)}</div>:<div className="triage-empty"><span className="triage-empty-icon"><CheckCheck size={23}/></span><h3>{cases.length?'No requests match this view':'No open clinical requests'}</h3><p>{cases.length?'Try another filter or search term.':'New staff requests for clinical follow-up will appear here.'}</p></div>}
   <div className="triage-footnote">{shown.length} of {cases.length} open {cases.length===1?'request':'requests'} · Last loaded from the camp record</div>
  </section>
 </div>;
}
