import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// In-memory rate limiter per cold start instance
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 10 detik

function getMaxPointsForLevel(level: number): { maxPoints: number; maxDiamonds: number } {
  const totalDiamonds = 5 + Math.floor(level * 1.5);
  const pointsPerDiamond = 10 + (level * 2);
  const levelCompleteBonus = 100 + (level * 20);
  const maxPoints = (totalDiamonds * pointsPerDiamond) + levelCompleteBonus;
  return { maxPoints, maxDiamonds: totalDiamonds };
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://xtiryhqorgvqksqnggnj.supabase.co";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const gameSecret = Deno.env.get("GAME_HMAC_SECRET");

    if (!supabaseServiceRoleKey || !gameSecret) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY or GAME_HMAC_SECRET");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const body = await req.json();
    const { wallet, points, level, diamonds, signature, timestamp } = body;

    if (!wallet || typeof wallet !== "string") {
      return new Response(JSON.stringify({ error: "Wallet address is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof points !== "number" || points < 0 || !Number.isFinite(points)) {
      return new Response(JSON.stringify({ error: "Invalid points value" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof level !== "number" || level < 1 || level > 500 || !Number.isInteger(level)) {
      return new Response(JSON.stringify({ error: "Invalid level value" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof diamonds !== "number" || diamonds < 0 || !Number.isInteger(diamonds)) {
      return new Response(JSON.stringify({ error: "Invalid diamonds value" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletLower = wallet.toLowerCase();

    // Rate Limiter
    const lastSubmit = rateLimitMap.get(walletLower) || 0;
    const now = Date.now();
    if (now - lastSubmit < RATE_LIMIT_MS) {
      const waitSec = Math.ceil((RATE_LIMIT_MS - (now - lastSubmit)) / 1000);
      return new Response(JSON.stringify({ error: `Rate limited. Wait ${waitSec}s.` }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rateLimitMap.set(walletLower, now);

    if (!signature || !timestamp) {
      return new Response(JSON.stringify({ error: "Missing game signature" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tsNum = Number(timestamp);
    if (Math.abs(now - tsNum) > 120_000) { // toleransi 2 menit
      return new Response(JSON.stringify({ error: "Expired game session" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const message = `${walletLower}:${points}:${level}:${diamonds}:${timestamp}`;

    // Validasi signature:
    // Coba verifikasi dengan 2 kemungkinan:
    // 1. Menggunakan session token (HMAC(gameSecret:walletLower))
    // 2. Menggunakan gameSecret langsung
    const sessionSeed = `${gameSecret}:${walletLower}`;
    const tokenBuf = await crypto.subtle.digest("SHA-256", encoder.encode(sessionSeed));
    const derivedToken = Array.from(new Uint8Array(tokenBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const keysToTry = [derivedToken, gameSecret];
    let signatureValid = false;

    for (const secretKey of keysToTry) {
      const cryptoKey = await crypto.subtle.importKey(
        "raw", encoder.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
      );
      const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
      const expectedSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (signature === expectedSig) {
        signatureValid = true;
        break;
      }
    }

    if (!signatureValid) {
      return new Response(JSON.stringify({ error: "Invalid game signature" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-cheat plausibility check
    const { maxPoints: maxPointsForLevel, maxDiamonds } = getMaxPointsForLevel(level - 1);
    if (points > maxPointsForLevel) {
      return new Response(JSON.stringify({ error: "Score exceeds maximum possible for this level" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (diamonds > maxDiamonds) {
      return new Response(JSON.stringify({ error: "Diamond count exceeds maximum for this level" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Profil check & update
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('points, diamonds_collected, level')
      .eq('wallet', walletLower)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentPoints = profile.points || 0;
    const currentDiamonds = profile.diamonds_collected || 0;
    const currentMaxLevel = profile.level || 1;

    if (level > currentMaxLevel + 1) {
      return new Response(JSON.stringify({ error: "Invalid level progression" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newTotalPoints = currentPoints + points;
    const newTotalDiamonds = currentDiamonds + diamonds;
    const newMaxLevel = Math.max(currentMaxLevel, level);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        points: newTotalPoints,
        diamonds_collected: newTotalDiamonds,
        level: newMaxLevel,
      })
      .eq("wallet", walletLower);

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Score verified: +${points} pts`,
        totalPoints: newTotalPoints,
        level: newMaxLevel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
