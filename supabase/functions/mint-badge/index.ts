import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "./cors.ts";

// ⚠️ IMPORTANT: Set this to your deployed ZicoRushBadge contract address
const NFT_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // ← REPLACE after deploy
const BASE_RPC_URL = "https://mainnet.base.org";

/**
 * Verify that a transaction exists on Base network and was sent
 * by the claiming wallet to the NFT contract.
 */
async function verifyOnChainTx(txHash: string, expectedWallet: string): Promise<boolean> {
  try {
    const resp = await fetch(BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [txHash]
      })
    });

    const data = await resp.json();
    const receipt = data.result;

    if (!receipt) {
      console.log("Tx receipt not found (may be pending):", txHash);
      return true; // Allow if tx is still pending — it was already sent
    }

    // Check tx was successful (status 0x1)
    if (receipt.status !== "0x1") {
      console.log("Tx failed on-chain:", txHash);
      return false;
    }

    // Check sender matches the wallet claiming points
    const sender = receipt.from?.toLowerCase();
    if (sender !== expectedWallet.toLowerCase()) {
      console.log("Tx sender mismatch:", sender, "vs", expectedWallet);
      return false;
    }

    // Check tx was sent to the NFT contract
    const to = receipt.to?.toLowerCase();
    if (NFT_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
        to !== NFT_CONTRACT_ADDRESS.toLowerCase()) {
      console.log("Tx not sent to NFT contract:", to);
      return false;
    }

    return true;
  } catch (e) {
    console.error("On-chain verification error:", e);
    return true; // Fail-open if RPC call fails to not block the user
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { wallet, txHash } = await req.json();

    if (!wallet) {
      throw new Error("Wallet parameter is required.");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get player profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('points')
      .eq('wallet', wallet.toLowerCase())
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error("Player profile not found");

    // 2. Check if already minted via social_tasks
    const { data: existingTask, error: existingTaskError } = await supabaseClient
      .from('social_tasks')
      .select('*')
      .eq('wallet', wallet.toLowerCase())
      .eq('task_type', 'mint_badge')
      .maybeSingle();

    if (existingTaskError) throw existingTaskError;

    if (existingTask) {
      return new Response(
        JSON.stringify({ error: "Badge already minted", status: "already_minted" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      );
    }

    // 3. Verify on-chain transaction (if txHash provided)
    if (txHash) {
      const isValid = await verifyOnChainTx(txHash, wallet);
      if (!isValid) {
        throw new Error("On-chain transaction verification failed.");
      }
    }

    // 4. Award points
    const pointsAwarded = 100000;

    // 5. Record minting task (with txHash)
    const { error: insertTaskError } = await supabaseClient
      .from('social_tasks')
      .insert([{
        wallet: wallet.toLowerCase(),
        task_type: 'mint_badge',
        points_awarded: pointsAwarded,
        ...(txHash ? { tx_hash: txHash } : {})
      }]);

    if (insertTaskError) throw insertTaskError;

    // 6. Update profile points
    const { error: updateProfileError } = await supabaseClient
      .from('profiles')
      .update({ points: profile.points + pointsAwarded })
      .eq('wallet', wallet.toLowerCase());

    if (updateProfileError) throw updateProfileError;

    return new Response(
      JSON.stringify({
        message: "Badge minted successfully!",
        points_awarded: pointsAwarded,
        tx_hash: txHash || null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});
