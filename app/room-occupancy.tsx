"use client";

import { useState } from 'react';
import { BedDouble, Download, Search } from 'lucide-react';
import { csv } from '../lib/domain';
import { roomOccupancy } from '../lib/room-occupancy';
import type { OpsPerson, OpsRoom } from '../lib/registration';

export default function RoomOccupancy({ rooms, people, online, onCamper, onEdit }: {
  rooms: OpsRoom[]; people: OpsPerson[]; online: boolean;
  onCamper: (id: string) => void; onEdit: (room: OpsRoom) => void;
}) {
  const [search, setSearch] = useState('');
  const [building, setBuilding] = useState('All floors');
  const [availability, setAvailability] = useState('Active rooms');
  const summary = roomOccupancy(rooms, people);
  const buildings = [...new Set(rooms.map(r => r.building))].sort();
  const query = search.trim().toLocaleLowerCase();
  const visible = summary.rows.filter(row =>
    (building === 'All floors' || row.room.building === building) &&
    (availability === 'Inactive rooms' ? !row.room.active : Boolean(row.room.active)) &&
    (availability !== 'Beds available' || row.available > 0) &&
    (availability !== 'Fully assigned' || row.available === 0) &&
    (!query || `${row.room.name} ${row.room.building}`.toLocaleLowerCase().includes(query) || row.occupants.some(p => p.name.toLocaleLowerCase().includes(query))),
  );

  function exportRooms() {
    const rows: unknown[][] = [['Room', 'Building / floor', 'Capacity', 'Bed', 'Camper', 'Arrival status', 'Room status']];
    for (const row of visible) {
      for (let bed = 1; bed <= row.room.capacity; bed++) {
        const occupants = row.occupants.filter(p => p.bed === bed);
        if (!occupants.length) rows.push([row.room.name, row.room.building, row.room.capacity, bed, '', row.room.active ? row.needsReview ? 'Review availability' : 'Available' : 'Unavailable', row.room.active ? 'Active' : 'Inactive']);
        for (const p of occupants) rows.push([row.room.name, row.room.building, row.room.capacity, bed, p.name, p.arrival === 'Arrived' ? 'Arrived' : 'Not arrived', row.room.active ? 'Active' : 'Inactive']);
      }
      for (const p of row.occupants.filter(p => !p.bed || p.bed < 1 || p.bed > row.room.capacity)) rows.push([row.room.name, row.room.building, row.room.capacity, p.bed ?? '', p.name, 'Bed assignment needs review', row.room.active ? 'Active' : 'Inactive']);
    }
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv(rows)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'camp-room-allocations.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="room-occupancy" aria-labelledby="room-occupancy-title">
    <div className="room-occupancy-heading">
      <div><span className="eyebrow">ACCOMMODATION</span><h2 id="room-occupancy-title">Who’s staying where</h2><p>Every room, assigned camper and remaining bed in one view.</p></div>
      <button onClick={exportRooms} disabled={!visible.length}><Download size={16} />Export room list</button>
    </div>
    <dl className="room-occupancy-totals">
      <div><dt>Active rooms</dt><dd>{summary.roomCount}</dd></div>
      <div><dt>Total beds</dt><dd>{summary.capacity}</dd></div>
      <div><dt>Beds assigned</dt><dd>{summary.assigned}</dd></div>
      <div className="room-available-total"><dt>Beds remaining</dt><dd>{summary.available}</dd></div>
    </dl>
    <p className="room-reservation-note">Reserved beds count as assigned, even when the camper has not arrived. <strong>{summary.unassigned} {summary.unassigned === 1 ? 'camper needs' : 'campers need'} a room.</strong></p>
    <div className="room-occupancy-filters">
      <label className="search-field"><Search size={17} /><input aria-label="Search rooms or campers" placeholder="Search room number or camper name" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <label><span>Floor</span><select value={building} onChange={e => setBuilding(e.target.value)}><option>All floors</option>{buildings.map(name => <option key={name}>{name}</option>)}</select></label>
      <label><span>Availability</span><select value={availability} onChange={e => setAvailability(e.target.value)}>{['Active rooms', 'Beds available', 'Fully assigned', 'Inactive rooms'].map(name => <option key={name}>{name}</option>)}</select></label>
    </div>
    <p className="room-result-count" aria-live="polite">{visible.length} {visible.length === 1 ? 'room' : 'rooms'} shown</p>
    <div className="room-occupancy-grid">
      {visible.map(row => <article className="room-occupancy-card" key={row.room.id}>
        <header><div><h3>{row.room.name}</h3><p>{row.room.building}</p></div><span className={`room-space-badge${!row.available ? ' full' : ''}`}>{!row.room.active ? 'Inactive' : row.needsReview ? 'Check beds' : row.available ? `${row.available} remaining` : 'Fully assigned'}</span></header>
        <div className="room-bed-summary"><span><BedDouble size={16} />{row.assigned} of {row.room.capacity} assigned</span><span>{row.arrived} arrived</span></div>
        {row.needsReview && <p className="room-allocation-warning">Some bed numbers are missing or duplicated. Review this room before allocating another bed.</p>}
        {row.occupants.length ? <ul className="room-occupants" aria-label={`Campers in ${row.room.name}`}>
          {row.occupants.map(p => <li key={p.id}><span className="room-bed-number">Bed {p.bed ?? '—'}</span><button onClick={() => onCamper(p.id)}>{p.name}</button><span className={`room-arrival-label${p.arrival === 'Arrived' ? ' arrived' : ''}`}>{p.arrival === 'Arrived' ? 'Arrived' : 'Not arrived'}</span></li>)}
        </ul> : <p className="room-no-occupants">No campers assigned.</p>}
        <footer><p>{row.room.active && !row.needsReview ? row.freeBeds.length ? `Available beds: ${row.freeBeds.join(', ')}` : 'All beds have been allocated.' : row.room.active ? 'Bed availability needs review.' : 'Unavailable for new assignments.'}</p><button disabled={!online} onClick={() => onEdit(row.room)}>Edit room</button></footer>
      </article>)}
    </div>
    {!visible.length && <div className="ops-empty"><BedDouble size={28} /><h3>{rooms.length ? 'No rooms match these filters' : 'No rooms added yet'}</h3><p>{rooms.length ? 'Try another floor or clear your search.' : 'Add the camp rooms and their bed capacities to get started.'}</p>{rooms.length>0&&<button onClick={()=>{setSearch('');setBuilding('All floors');setAvailability('Active rooms');}}>Reset filters</button>}</div>}
  </section>;
}
