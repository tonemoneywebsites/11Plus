/*
# Auto-create trial subscription on signup

## Overview
When a new parent account is created, automatically create a subscription record
with 'trialing' status and a 7-day trial period.

## Changes
- Updated handle_new_user trigger function to also insert a subscription record.
- The subscription starts trialing with trial_end = now() + 7 days.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (parent_id, status, trial_start, trial_end)
  VALUES (NEW.id, 'trialing', now(), now() + interval '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;