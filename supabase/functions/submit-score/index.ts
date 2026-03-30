import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// ── In-memory rate limiter (per-instance, resets on cold start) ──
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 10 seconds between submissions per wallet

// ── Game formula constants (must match client-side GameScene.js) ──
function getMaxPointsForLevel(level: number): number {
  const totalDiamonds = 5 + Math.floor(level * 1.5);
  const pointsPerDiamond = 10 + (level * 2);
  const levelCompleteBonus = 100 + (level * 20);
  // Max possible = all diamonds collected + completion bonus
  return (totalDiamonds * pointsPerDiamond) + levelCompleteBonus;
}

serve(async (req) => {
  // CORS setup for browser requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get credentials from ENVIRONMENT VARIABLES (not hardcoded!)
    const supabaseUrl = "https://xtiryhqorgvqksqnggnj.supabase.co";
    const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXJ5aHFvcmd2cWtzcW5nZ25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE5MDgyMCwiZXhwIjoyMDg4NzY2ODIwfQ.H7CUZTk1glB6-2y2BwknysM8nStPjprBjvmlWaYYL9E";
    const gameSecret = "JIUzI1Nsgstsetst9s6dfj9sdf489iIsInR5cCI6Ik";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Using service_role key to bypass RLS policies
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 2. Parse and validate request body
    const body = await req.json();
    const { wallet, points, level, diamonds, signature, timestamp } = body;

    // ── Basic input validation ──
    if (!wallet || typeof wallet !== "string") {
      return new Response(JSON.stringify({ error: "Wallet address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof points !== "number" || points < 0 || !Number.isFinite(points)) {
      return new Response(JSON.stringify({ error: "Invalid points value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof level !== "number" || level < 1 || level > 500 || !Number.isInteger(level)) {
      return new Response(JSON.stringify({ error: "Invalid level value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof diamonds !== "number" || diamonds < 0 || !Number.isInteger(diamonds)) {
      return new Response(JSON.stringify({ error: "Invalid diamonds value" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletLower = wallet.toLowerCase();

    // ── 3. RATE LIMITING ──
    const lastSubmit = rateLimitMap.get(walletLower) || 0;
    const now = Date.now();
    if (now - lastSubmit < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastSubmit)) / 1000);
      return new Response(JSON.stringify({ error: `Rate limited. Wait ${waitSec}s.` }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rateLimitMap.set(walletLower, now);

    // ── 4. HMAC SIGNATURE VERIFICATION ──
    if (!signature || !timestamp) {
      return new Response(JSON.stringify({ error: "Missing game signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify timestamp is recent (within 60 seconds)
    const tsNum = Number(timestamp);
    if (Math.abs(now - tsNum) > 60_000) {
      return new Response(JSON.stringify({ error: "Expired game session" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify HMAC signature
    const message = `${walletLower}:${points}:${level}:${diamonds}:${timestamp}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(gameSecret);
    const msgData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const expectedSig = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expectedSig) {
      console.warn(`Invalid signature from wallet ${walletLower}. Expected: ${expectedSig}, Got: ${signature}`);
      return new Response(JSON.stringify({ error: "Invalid game signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 5. ANTI-CHEAT: Score plausibility check ──
    // Calculate max possible points for this level
    const maxPointsForLevel = getMaxPointsForLevel(level - 1); // level is "next level reached"
    if (points > maxPointsForLevel) {
      console.warn(`Suspicious score: wallet=${walletLower} points=${points} maxPossible=${maxPointsForLevel} level=${level}`);
      return new Response(JSON.stringify({ error: "Score exceeds maximum possible for this level" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Max diamonds check
    const maxDiamonds = 5 + Math.floor((level - 1) * 1.5);
    if (diamonds > maxDiamonds) {
      console.warn(`Suspicious diamonds: wallet=${walletLower} diamonds=${diamonds} maxPossible=${maxDiamonds}`);
      return new Response(JSON.stringify({ error: "Diamond count exceeds maximum for this level" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 6. Fetch current profile and validate level progression ──
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('points, diamonds_collected, level')
      .eq('wallet', walletLower)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentPoints = profile.points || 0;
    const currentDiamonds = profile.diamonds_collected || 0;
    const currentMaxLevel = profile.level || 1;

    // Level progression check: can only advance 1 level at a time
    if (level > currentMaxLevel + 1) {
      console.warn(`Level skip detected: wallet=${walletLower} currentMax=${currentMaxLevel} claimed=${level}`);
      return new Response(JSON.stringify({ error: "Invalid level progression" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 7. Update the database ──
    const newTotalPoints = currentPoints + points;
    const newTotalDiamonds = currentDiamonds + diamonds;
    const newMaxLevel = Math.max(currentMaxLevel, level);

    console.log(`✅ Valid score: wallet=${walletLower} +${points}pts level=${currentMaxLevel}→${newMaxLevel}`);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        points: newTotalPoints,
        diamonds_collected: newTotalDiamonds,
        level: newMaxLevel
      })
      .eq("wallet", walletLower);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Score verified: +${points} pts`,
        totalPoints: newTotalPoints,
        level: newMaxLevel
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (err) {
    console.error("submit-score error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
