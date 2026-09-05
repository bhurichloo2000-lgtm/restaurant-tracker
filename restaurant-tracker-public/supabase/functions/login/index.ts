// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This code is running in a Supabase Edge Function (Deno environment)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, password } = await req.json();

    // 1. Validate inputs
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "กรุณากรอกชื่อและรหัสผ่าน" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Initialize admin client with Service Role Key (securely inside Edge Function)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration missing" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 3. Fetch shared password from secure settings table or env
    const { data: settingRow, error: settingError } = await supabaseAdmin
      .from("settings")
      .select("shared_password")
      .eq("id", 1)
      .maybeSingle();

    const expectedPassword = settingRow?.shared_password || Deno.env.get("RESTAURANT_SHARED_PASSWORD");

    if (!expectedPassword || password !== expectedPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "รหัสผ่านไม่ถูกต้อง" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Generate unique secure session token
    const token = "rt_sess_" + crypto.randomUUID().replace(/-/g, "");

    // 5. Save session to database
    const { error: sessionError } = await supabaseAdmin.from("sessions").insert([
      {
        token: token,
        staff_name: trimmedName,
        created_at: new Date().toISOString(),
      },
    ]);

    if (sessionError) {
      console.error("Error creating session:", sessionError);
      return new Response(
        JSON.stringify({ success: false, error: "ไม่สามารถสร้างเซสชันได้" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 6. Return response to frontend (Never expose actual password or service key)
    return new Response(
      JSON.stringify({
        success: true,
        name: trimmedName,
        token: token,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Login edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "เกิดข้อผิดพลาดภายในระบบ" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
