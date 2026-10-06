CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL,
  is_demo boolean NOT NULL DEFAULT false,
  timezone text NOT NULL,
  age int,
  sex text,
  height_cm numeric,
  weight_kg numeric,
  activity text,
  goal text,
  computed_target int,
  target_override int
);

CREATE TABLE IF NOT EXISTS meals (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_type text NOT NULL,
  eaten_at timestamptz NOT NULL,
  source text NOT NULL,
  was_corrected boolean NOT NULL DEFAULT false,
  catalogue_version text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS meals_profile_eaten_idx ON meals (profile_id, eaten_at);

CREATE TABLE IF NOT EXISTS meal_items (
  id uuid PRIMARY KEY,
  meal_id uuid NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  position int NOT NULL,
  catalogue_item_id text,
  display_name text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  calories numeric NOT NULL,
  protein numeric NOT NULL,
  carbs numeric NOT NULL,
  fat numeric NOT NULL,
  fibre numeric NOT NULL,
  sat_fat numeric NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_estimate boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS report_markers (
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  marker text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  original_value numeric NOT NULL,
  original_unit text NOT NULL,
  status text NOT NULL,
  PRIMARY KEY (report_id, marker)
);

CREATE TABLE IF NOT EXISTS focus_assignments (
  id uuid PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  focus text NOT NULL,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  active_from timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  achievement_type text NOT NULL,
  unlocked_at timestamptz NOT NULL,
  PRIMARY KEY (profile_id, achievement_key)
);

-- Goal pace and goal weight (added for weekly-pace goals).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weekly_kg numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_weight_kg numeric;
