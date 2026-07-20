import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const signature = req.headers.get("Stripe-Signature");

    let event;
    if (STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET && signature) {
      // Verify webhook signature
      const { Stripe } = await import("npm:stripe@14.21.0");
      const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
    } else {
      // No webhook secret configured — parse without verification (for testing)
      event = JSON.parse(body);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          const { data: existing } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("parent_id", userId)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("subscriptions")
              .update({
                status: "active",
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("subscriptions").insert({
              parent_id: userId,
              status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            });
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subData) {
          const status = subscription.status === "active" ? "active"
            : subscription.status === "past_due" ? "past_due"
            : subscription.status === "canceled" ? "canceled"
            : "inactive";

          await supabase
            .from("subscriptions")
            .update({
              status,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : subData.current_period_end,
            })
            .eq("id", subData.id);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subData && invoice.period_end) {
          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              current_period_end: new Date(invoice.period_end * 1000).toISOString(),
            })
            .eq("id", subData.id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (subData) {
          await supabase
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("id", subData.id);
        }
        break;
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
