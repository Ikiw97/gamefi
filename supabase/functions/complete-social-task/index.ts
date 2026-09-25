import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const VALID_TASKS: Record<string, number> = {
  twitter_connect: 1500,
  twitter_follow: 1000,
  twitter_retweet: 800,
  twitter_like: 800,
};

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = "https://xtiryhqorgvqksqnggnj.supabase.co";
    const supabaseServiceRoleKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXJ5aHFvcmd2cWtzcW5nZ25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE5MDgyMCwiZXhwIjoyMDg4NzY2ODIwfQ.H7CUZTk1glB6-2y2BwknysM8nStPjprBjvmlWaYYL9E";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { wallet, task_type } = await req.json();

    // ── Input validation ──
    if (!wallet || typeof wallet !== "string") {
      return new Response(
        JSON.stringify({ error: "Wallet is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!task_type || !VALID_TASKS[task_type]) {
      return new Response(
        JSON.stringify({ error: "Invalid task type" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const walletLower = wallet.toLowerCase();
    const pointsToAward = VALID_TASKS[task_type];

    // ── Check player exists ──
    const { data: player, error: playerError } = await supabaseAdmin
      .from("profiles")
      .select("wallet, points")
      .eq("wallet", walletLower)
      .maybeSingle();

    if (playerError) throw playerError;

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Check if task already completed ──
    const { data: existing } = await supabaseAdmin
      .from("social_tasks")
      .select("id")
      .eq("wallet", walletLower)
      .eq("task_type", task_type)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Task already completed" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Insert task completion ──
    const { error: insertError } = await supabaseAdmin
      .from("social_tasks")
      .insert([
        {
          wallet: walletLower,
          task_type: task_type,
          points_awarded: pointsToAward,
        },
      ]);

    if (insertError) {
      // Handle unique constraint violation (race condition)
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "Task already completed" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      throw insertError;
    }

    // ── Award points to player ──
    const newPoints = (player.points || 0) + pointsToAward;
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ points: newPoints })
      .eq("wallet", walletLower);

    if (updateError) throw updateError;

    console.log(
      `✅ Social task completed: ${walletLower} - ${task_type} (+${pointsToAward} pts)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        task_type: task_type,
        points_awarded: pointsToAward,
        new_points: newPoints,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("complete-social-task error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
