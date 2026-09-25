import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { verifyMessage } from "https://esm.sh/ethers@6.11.1";

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ⚠️ Security Tip: Sangat disarankan untuk menyimpan supabaseServiceRoleKey 
    // di dalam Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") daripada ditulis langsung di kode.
    const supabaseUrl = "https://xtiryhqorgvqksqnggnj.supabase.co";
    const supabaseServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0aXJ5aHFvcmd2cWtzcW5nZ25qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzE5MDgyMCwiZXhwIjoyMDg4NzY2ODIwfQ.H7CUZTk1glB6-2y2BwknysM8nStPjprBjvmlWaYYL9E";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const {
      wallet,
      username,
      referral_code_input,
      signature,
      timestamp,
      cf_turnstile_response // Token dari Turnstile frontend
    } = await req.json();

    // ── Turnstile Verification (Anti-Bot Lapis 2) ──
    if (!cf_turnstile_response) {
      return new Response(JSON.stringify({ error: "Security captcha token missing" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TURNSTILE_SECRET_KEY = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!TURNSTILE_SECRET_KEY) {
      console.warn("TURNSTILE_SECRET_KEY is not set in Supabase Secrets.");
    }

    const formData = new FormData();
    formData.append("secret", TURNSTILE_SECRET_KEY || "");
    formData.append("response", cf_turnstile_response);

    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    const turnstileData = await turnstileRes.json();

    if (!turnstileData.success) {
      console.error("Turnstile verification failed:", turnstileData);
      return new Response(JSON.stringify({ error: "Failed Security CAPTCHA Check (Bot Detected)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Input validation ──
    if (!wallet || typeof wallet !== "string") {
      return new Response(JSON.stringify({ error: "Wallet is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!username || typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return new Response(JSON.stringify({ error: "Invalid username (3-20 chars, alphanumeric + _)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletLower = wallet.toLowerCase();

    // ── Cryptographic Signature Verification (Anti-Bot) ──
    if (!signature || !timestamp) {
      return new Response(JSON.stringify({ error: "Wallet signature required (Anti-Bot Protection)" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify timestamp is within 5 minutes to prevent replay attacks
    const now = Date.now();
    if (Math.abs(now - Number(timestamp)) > 5 * 60_000) {
      return new Response(JSON.stringify({ error: "Registration session expired. Please try again." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = `Register Zico Rush\nWallet: ${walletLower}\nUsername: ${username}\nTimestamp: ${timestamp}`;
    let recoveredAddress;
    try {
      recoveredAddress = verifyMessage(message, signature);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid signature format" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recoveredAddress.toLowerCase() !== walletLower) {
      return new Response(JSON.stringify({ error: "Signature does not match the provided wallet" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Check if wallet or username already exists ──
    const { data: existingWallet } = await supabaseAdmin
      .from('profiles')
      .select('wallet')
      .eq('wallet', walletLower)
      .maybeSingle();

    if (existingWallet) {
      return new Response(JSON.stringify({ error: "Wallet already registered" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .ilike('username', username)
      .limit(1);

    if (existingUser && existingUser.length > 0) {
      return new Response(JSON.stringify({ error: "Username already taken" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate referral code ──
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let refCode = username.slice(0, 3).toUpperCase();
    for (let i = refCode.length; i < 6; i++) {
      refCode += chars[Math.floor(Math.random() * chars.length)];
    }

    // ── Validate referral code (if provided) ──
    let bonusPoints = 0;
    let validReferral: string | null = null;

    if (referral_code_input && typeof referral_code_input === "string") {
      const refUpper = referral_code_input.toUpperCase().trim();
      const { data: referrer } = await supabaseAdmin
        .from('profiles')
        .select('wallet, points, referral_count')
        .eq('referral_code', refUpper)
        .single();

      if (referrer) {
        validReferral = refUpper;
        bonusPoints = 25; // Bonus for using a referral code

        // Reward referrer server-side (+50 pts, +1 referral count)
        await supabaseAdmin
          .from('profiles')
          .update({
            points: (referrer.points || 0) + 50,
            referral_count: (referrer.referral_count || 0) + 1,
          })
          .eq('wallet', referrer.wallet);

        console.log(`Referral reward: referrer=${referrer.wallet} +50pts from new user=${walletLower}`);
      }
    }

    // ── Insert new profile ──
    const { data: newProfile, error: insertError } = await supabaseAdmin
      .from('profiles')
      .insert([{
        wallet: walletLower,
        username: username,
        referral_code: refCode,
        referred_by: validReferral,
        points: bonusPoints,
        diamonds_collected: 0,
        level: 1,
      }])
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') {
        return new Response(JSON.stringify({ error: "Already registered" }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw insertError;
    }

    console.log(`✅ New player registered: ${username} (${walletLower})`);

    return new Response(JSON.stringify({
      success: true,
      profile: newProfile
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("register-player error:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
