import type { OpsPerson, OpsRoom } from './registration';

export function roomOccupancy(rooms: OpsRoom[], people: OpsPerson[]) {
  const rows = rooms.map(room => {
    const occupants = people.filter(p => p.room_id === room.id)
      .sort((a, b) => (a.bed ?? Infinity) - (b.bed ?? Infinity) || a.name.localeCompare(b.name));
    const occupiedBeds = new Set(occupants.filter(p => Number.isInteger(p.bed) && p.bed! >= 1 && p.bed! <= room.capacity).map(p => p.bed!));
    const needsReview = occupiedBeds.size !== occupants.length;
    const freeBeds = Array.from({ length: room.capacity }, (_, i) => i + 1).filter(bed => !occupiedBeds.has(bed));
    return {
      room, occupants, freeBeds, needsReview,
      assigned: occupants.length,
      arrived: occupants.filter(p => p.arrival === 'Arrived').length,
      available: room.active && !needsReview ? freeBeds.length : 0,
    };
  }).sort((a, b) => a.room.name.localeCompare(b.room.name, undefined, { numeric: true }));
  const active = rows.filter(row => row.room.active);
  return {
    rows,
    roomCount: active.length,
    capacity: active.reduce((n, row) => n + row.room.capacity, 0),
    assigned: active.reduce((n, row) => n + row.assigned, 0),
    available: active.reduce((n, row) => n + row.available, 0),
    unassigned: people.filter(p => !p.room_id).length,
  };
}
