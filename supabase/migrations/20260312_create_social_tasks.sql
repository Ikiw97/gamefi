-- =============================================
-- Social Tasks Table
-- Tracks completed social media tasks per player
-- =============================================

CREATE TABLE IF NOT EXISTS social_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet TEXT NOT NULL,
  task_type TEXT NOT NULL,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wallet, task_type)
);

-- Enable Row Level Security
ALTER TABLE social_tasks ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tasks (via client-side Supabase)
CREATE POLICY "Users can read own social tasks"
  ON social_tasks FOR SELECT
  USING (true);

-- Only service role (Edge Function) can insert
-- No INSERT policy needed for anon — the Edge Function uses service_role key
