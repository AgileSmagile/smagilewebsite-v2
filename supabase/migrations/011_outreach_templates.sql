-- Outreach templates: sector-based multi-touch message templates
-- Used by the admin panel to manage outreach sequences

CREATE TABLE IF NOT EXISTS outreach_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector text NOT NULL,
  sector_label text NOT NULL,
  touch_number integer NOT NULL CHECK (touch_number BETWEEN 1 AND 3),
  touch_label text NOT NULL,
  subject text,
  body text NOT NULL,
  personalisation_hooks jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (sector, touch_number)
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_outreach_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER outreach_templates_updated_at
  BEFORE UPDATE ON outreach_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_outreach_templates_updated_at();

-- Index for common queries
CREATE INDEX idx_outreach_templates_sector ON outreach_templates (sector);
CREATE INDEX idx_outreach_templates_active ON outreach_templates (is_active) WHERE is_active = true;
