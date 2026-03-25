-- Content ideas: quick-capture system for social media and learning catalogue content
-- Used by admin panel to capture, categorise, and develop content ideas

CREATE TABLE IF NOT EXISTS content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('social_media', 'learning_catalogue')),
  raw_input text NOT NULL,
  title text,
  content text,
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'drafted', 'published', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_content_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_ideas_updated_at
  BEFORE UPDATE ON content_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_content_ideas_updated_at();

-- Indexes for common queries
CREATE INDEX idx_content_ideas_category ON content_ideas (category);
CREATE INDEX idx_content_ideas_status ON content_ideas (status);
CREATE INDEX idx_content_ideas_created ON content_ideas (created_at DESC);
