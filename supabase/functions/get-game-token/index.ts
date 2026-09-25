import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { wallet } = await req.json();

    if (!wallet || typeof wallet !== "string") {
      return new Response(JSON.stringify({ error: "Wallet required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const walletLower = wallet.toLowerCase();

    // Pastikan wallet terdaftar
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('wallet')
      .eq('wallet', walletLower)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Wallet not registered" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Token stabil per wallet berdasarkan GAME_HMAC_SECRET
    const sessionSeed = `${gameSecret}:${walletLower}`;
    const encoder = new TextEncoder();
    const tokenBuf = await crypto.subtle.digest("SHA-256", encoder.encode(sessionSeed));
    const sessionToken = Array.from(new Uint8Array(tokenBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    return new Response(
      JSON.stringify({
        success: true,
        sessionToken: sessionToken,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
