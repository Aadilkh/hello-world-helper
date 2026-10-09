/*
# Create app_connections and virtual_servers tables

1. New Tables
- `app_connections`: tracks which connected apps the user has linked to Vision Pilot
  - id (uuid, primary key)
  - app_name (text, not null) — e.g. "YouTube", "GitHub"
  - category (text, not null) — e.g. "Social", "Development"
  - connected (boolean, default false)
  - notes (text, optional user notes about the connection)
  - created_at (timestamptz)
- `virtual_servers`: tracks virtual server connections for development/deployment
  - id (uuid, primary key)
  - name (text, not null) — server label
  - host (text, optional) — hostname or IP
  - status (text, default 'offline') — offline, connecting, online
  - last_connected_at (timestamptz, optional)
  - created_at (timestamptz)

2. Security
- Single-tenant app (no sign-in screen). RLS enabled, anon+authenticated full CRUD.
- Data is intentionally shared/public within the workspace.
*/

CREATE TABLE IF NOT EXISTS app_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name text NOT NULL,
  category text NOT NULL,
  connected boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE app_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_app_connections" ON app_connections;
CREATE POLICY "anon_select_app_connections" ON app_connections FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_app_connections" ON app_connections;
CREATE POLICY "anon_insert_app_connections" ON app_connections FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_app_connections" ON app_connections;
CREATE POLICY "anon_update_app_connections" ON app_connections FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_app_connections" ON app_connections;
CREATE POLICY "anon_delete_app_connections" ON app_connections FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS virtual_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  host text DEFAULT '',
  status text NOT NULL DEFAULT 'offline',
  last_connected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE virtual_servers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_virtual_servers" ON virtual_servers;
CREATE POLICY "anon_select_virtual_servers" ON virtual_servers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_virtual_servers" ON virtual_servers;
CREATE POLICY "anon_insert_virtual_servers" ON virtual_servers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_virtual_servers" ON virtual_servers;
CREATE POLICY "anon_update_virtual_servers" ON virtual_servers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_virtual_servers" ON virtual_servers;
CREATE POLICY "anon_delete_virtual_servers" ON virtual_servers FOR DELETE
  TO anon, authenticated USING (true);
