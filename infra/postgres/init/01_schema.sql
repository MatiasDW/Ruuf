CREATE TABLE IF NOT EXISTS plants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    clearance_radius_m NUMERIC(8, 2) NOT NULL,
    structure_clearance_m NUMERIC(8, 2) NOT NULL,
    sunlight TEXT[] NOT NULL,
    water_need TEXT NOT NULL,
    liters_per_week NUMERIC(10, 2) NOT NULL,
    style_tags TEXT[] NOT NULL,
    color TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plants_category_idx ON plants (category);
CREATE INDEX IF NOT EXISTS plants_is_active_idx ON plants (is_active);
