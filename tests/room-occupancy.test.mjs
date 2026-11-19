import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/room-occupancy.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {roomOccupancy}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const rooms=[{id:'a',name:'D1-466',building:'First floor',capacity:10,active:1},{id:'b',name:'D2-490',building:'Female floor',capacity:2,active:1},{id:'retired',name:'Test room',building:'Old',capacity:4,active:0}];
const people=[{id:'1',name:'Synthetic Expected',room_id:'a',bed:2,arrival:'Expected'},{id:'2',name:'Synthetic Arrived',room_id:'a',bed:1,arrival:'Arrived'},{id:'3',name:'Synthetic Unassigned',room_id:null,bed:null,arrival:'Expected'}];
const summary=roomOccupancy(rooms,people);
assert.equal(summary.capacity,12);assert.equal(summary.roomCount,2);assert.equal(summary.assigned,2);assert.equal(summary.available,10);assert.equal(summary.unassigned,1);
const first=summary.rows.find(r=>r.room.id==='a');assert.equal(first.arrived,1);assert.equal(first.available,8);assert.deepEqual(first.freeBeds,[3,4,5,6,7,8,9,10]);assert.deepEqual(first.occupants.map(p=>p.id),['2','1']);
assert.equal(summary.rows.find(r=>r.room.id==='retired').available,0);
// An unarrived camper's reservation still occupies a bed. Bad data must not
// appear as an invitation to allocate more campers to the same room.
for(const bad of [{id:'duplicate',name:'Synthetic duplicate',room_id:'a',bed:1,arrival:'Expected'},{id:'invalid',name:'Synthetic invalid',room_id:'a',bed:11,arrival:'Expected'},{id:'missing',name:'Synthetic missing',room_id:'a',bed:null,arrival:'Expected'}]){
 const row=roomOccupancy(rooms,[...people,bad]).rows.find(r=>r.room.id==='a');assert.equal(row.needsReview,true);assert.equal(row.available,0);
}
assert.deepEqual(roomOccupancy([],[]),{rows:[],roomCount:0,capacity:0,assigned:0,available:0,unassigned:0});
console.log('Room occupancy: reservations, arrival counts, free bed numbers, inactive rooms, unassigned campers and invalid/duplicate bed protection passed.');
