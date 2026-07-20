import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "Stripe is not configured. Add your STRIPE_SECRET_KEY to edge function secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "create_checkout";

    if (action === "create_checkout") {
      // Get or create Stripe customer
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("parent_id", userId)
        .maybeSingle();

      let stripeCustomerId = subData?.stripe_customer_id;

      if (!stripeCustomerId) {
        const customerRes = await fetch("https://api.stripe.com/v1/customers", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            email: userData.user.email ?? "",
            metadata: { supabase_user_id: userId },
          }),
        });
        if (!customerRes.ok) {
          const err = await customerRes.json().catch(() => ({}));
          throw new Error(err.error?.message ?? "Failed to create Stripe customer");
        }
        const customer = await customerRes.json();
        stripeCustomerId = customer.id;
      }

      // Create checkout session
      const origin = req.headers.get("origin") ?? "http://localhost:3000";
      const params = new URLSearchParams({
        customer: stripeCustomerId,
        payment_method_types: "card",
        mode: "subscription",
        line_items: STRIPE_PRICE_ID
          ? JSON.stringify([{ price: STRIPE_PRICE_ID, quantity: "1" }])
          : JSON.stringify([{
              price_data: {
                currency: "gbp",
                unit_amount: "1000",
                recurring: { interval: "month" },
                product_data: { name: "ElevenPlus Prep - Monthly Subscription" },
              },
              quantity: "1",
            }]),
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancelled`,
        metadata: { supabase_user_id: userId },
      });

      const checkoutRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json().catch(() => ({}));
        throw new Error(err.error?.message ?? "Failed to create checkout session");
      }

      const session = await checkoutRes.json();

      // Update subscription record with stripe customer id
      if (subData) {
        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("id", subData.id);
      } else {
        await supabase.from("subscriptions").insert({
          parent_id: userId,
          status: "trialing",
          stripe_customer_id: stripeCustomerId,
        });
      }

      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "billing_portal") {
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("parent_id", userId)
        .maybeSingle();

      if (!subData?.stripe_customer_id) {
        return new Response(
          JSON.stringify({ error: "No Stripe customer found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const origin = req.headers.get("origin") ?? "http://localhost:3000";
      const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: subData.stripe_customer_id,
          return_url: `${origin}/`,
        }),
      });

      if (!portalRes.ok) {
        const err = await portalRes.json().catch(() => ({}));
        throw new Error(err.error?.message ?? "Failed to create portal session");
      }

      const session = await portalRes.json();
      return new Response(
        JSON.stringify({ url: session.url }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
