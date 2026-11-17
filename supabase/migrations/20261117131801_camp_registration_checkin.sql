CREATE TABLE dyc.camp_rooms (
 id text PRIMARY KEY, building text NOT NULL, name text NOT NULL,
 capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100), active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)), version integer NOT NULL DEFAULT 1,
 UNIQUE(building,name)
);
CREATE TABLE dyc.camp_teams (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, leader text NOT NULL DEFAULT '',
 active integer NOT NULL DEFAULT 1 CHECK (active IN (0,1)), version integer NOT NULL DEFAULT 1
);
CREATE TABLE dyc.registrations (
 warrior_id text PRIMARY KEY REFERENCES dyc.warriors(id), reference text NOT NULL UNIQUE,
 fingerprint text UNIQUE, request_id text UNIQUE, request_hash text,
 details text NOT NULL DEFAULT '{}', reported_care text NOT NULL DEFAULT '{}',
 source text NOT NULL CHECK (source IN ('public','walkin','legacy')),
 created_at text NOT NULL, created_by text NOT NULL,
 arrival text NOT NULL DEFAULT 'Expected' CHECK (arrival IN ('Expected','Arrived')),
 arrived_at text NOT NULL DEFAULT '', arrived_by text NOT NULL DEFAULT '',
 documents integer NOT NULL DEFAULT 0 CHECK (documents IN (0,1)),
 medical text NOT NULL DEFAULT 'Pending' CHECK (medical IN ('Pending','Reviewed')),
 medical_by text NOT NULL DEFAULT '', medical_at text NOT NULL DEFAULT '',
 room_id text REFERENCES dyc.camp_rooms(id), bed integer CHECK (bed > 0),
 team_id text REFERENCES dyc.camp_teams(id), version integer NOT NULL DEFAULT 1,
 CHECK ((room_id IS NULL) = (bed IS NULL)), UNIQUE(room_id,bed)
);
CREATE TABLE dyc.arrival_events (
 id text PRIMARY KEY, warrior_id text REFERENCES dyc.warriors(id), actor text NOT NULL,
 action text NOT NULL, at text NOT NULL, details text NOT NULL
);
CREATE INDEX registrations_team ON dyc.registrations(team_id);
CREATE INDEX arrival_events_warrior ON dyc.arrival_events(warrior_id,at);
CREATE INDEX reviews_warrior ON dyc.reviews(warrior_id);
-- Existing care records keep their identity and clinical data. Unknown registration
-- permissions remain unknown; they are never backfilled as consent.
INSERT INTO dyc.registrations(warrior_id,reference,source,created_at,created_by)
 SELECT id,'DYC26-'||upper(replace(gen_random_uuid()::text,'-','')),'legacy',CURRENT_TIMESTAMP::text,'migration' FROM dyc.warriors;
REVOKE ALL ON dyc.camp_rooms,dyc.camp_teams,dyc.registrations,dyc.arrival_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON dyc.camp_rooms,dyc.camp_teams,dyc.registrations TO dyc_app;
GRANT SELECT,INSERT ON dyc.arrival_events TO dyc_app;
ALTER TABLE dyc.camp_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyc.camp_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyc.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dyc.arrival_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.camp_rooms FOR ALL TO dyc_app USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON dyc.camp_teams FOR ALL TO dyc_app USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON dyc.registrations FOR ALL TO dyc_app USING (true) WITH CHECK (true);
CREATE POLICY backend_only ON dyc.arrival_events FOR ALL TO dyc_app USING (true) WITH CHECK (true);
