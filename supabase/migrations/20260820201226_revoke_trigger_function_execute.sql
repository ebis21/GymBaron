-- Anything in the `public` schema is also an RPC endpoint. These three exist
-- only to be fired by their triggers, and `handle_new_user` runs as definer —
-- leaving it callable would publish a privileged endpoint for no reason.
revoke execute on function public.handle_new_user()          from public, anon, authenticated;
revoke execute on function public.game_saves_bump_revision() from public, anon, authenticated;
revoke execute on function public.profiles_touch_updated_at() from public, anon, authenticated;
