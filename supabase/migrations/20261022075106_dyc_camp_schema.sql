-- Private, server-only camp schema. Supabase Auth remains unchanged.
CREATE SCHEMA IF NOT EXISTS dyc;
REVOKE ALL ON SCHEMA dyc FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dyc_app') THEN
  CREATE ROLE dyc_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
GRANT dyc_app TO postgres;
SET LOCAL search_path TO dyc, pg_catalog;
CREATE TABLE "warriors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"group_name" text NOT NULL,
	"room" text NOT NULL,
	"guardian" text NOT NULL,
	"contact" text NOT NULL,
	"allergies" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
CREATE TABLE "atomic_guards" (
	"id" text PRIMARY KEY NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "guard_one_change" CHECK("atomic_guards"."value" = 1)
);

CREATE TABLE "commands" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"body" text NOT NULL,
	"at" text NOT NULL
);

CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"warrior_id" text NOT NULL,
	"kind" text NOT NULL,
	"care_day" text NOT NULL,
	"measured_at" text NOT NULL,
	"payload" text NOT NULL,
	"author" text NOT NULL,
	"author_id" text NOT NULL,
	"received_at" text NOT NULL,
	FOREIGN KEY ("warrior_id") REFERENCES "warriors"("id") ON UPDATE no action ON DELETE no action
);

CREATE INDEX "entries_warrior_time" ON "entries" ("warrior_id","measured_at");
CREATE TABLE "members" (
	"email" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"groups_json" text DEFAULT '[]' NOT NULL
);

CREATE TABLE "regimens" (
	"id" text PRIMARY KEY NOT NULL,
	"warrior_id" text NOT NULL,
	"medicine" text NOT NULL,
	"dose" text NOT NULL,
	"instructions" text NOT NULL,
	"author" text NOT NULL,
	"at" text NOT NULL,
	"version" integer NOT NULL,
	FOREIGN KEY ("warrior_id") REFERENCES "warriors"("id") ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX "regimen_version" ON "regimens" ("warrior_id","version");
CREATE TABLE "reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"warrior_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"owner" text NOT NULL,
	"proposed_owner" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	FOREIGN KEY ("warrior_id") REFERENCES "warriors"("id") ON UPDATE no action ON DELETE no action
);

CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);



CREATE TABLE "export_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"at" text NOT NULL,
	"care_day" text NOT NULL,
	"scope" text NOT NULL,
	"rows" integer NOT NULL
);

CREATE TABLE "request_buckets" (
	"id" text PRIMARY KEY NOT NULL,
	"requests" integer NOT NULL,
	"window" integer NOT NULL
);

CREATE INDEX "request_buckets_window" ON "request_buckets" ("window");
ALTER TABLE "members" ADD "active" integer DEFAULT 1 NOT NULL;
ALTER TABLE "members" ADD "user_id" text;
CREATE UNIQUE INDEX "members_user_id" ON "members" ("user_id");
CREATE TABLE "staff_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_seen" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"revoked" integer DEFAULT 0 NOT NULL
);

CREATE INDEX "staff_sessions_user" ON "staff_sessions" ("user_id");
REVOKE ALL ON ALL TABLES IN SCHEMA dyc FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA dyc TO dyc_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dyc TO dyc_app;
ALTER TABLE dyc.atomic_guards ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.atomic_guards FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.commands FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.entries FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.members ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.members FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.regimens ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.regimens FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.reviews FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.settings FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.warriors ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.warriors FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.export_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.export_events FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.request_buckets ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.request_buckets FOR ALL TO dyc_app USING (true) WITH CHECK (true);
ALTER TABLE dyc.staff_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY backend_only ON dyc.staff_sessions FOR ALL TO dyc_app USING (true) WITH CHECK (true);
