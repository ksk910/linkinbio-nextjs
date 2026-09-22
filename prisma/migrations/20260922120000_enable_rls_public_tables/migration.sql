-- Supabase flagged every public table as "rls_disabled_in_public" /
-- "sensitive_columns_exposed": Row-Level Security was never enabled,
-- and the anon/authenticated PostgREST roles held full
-- SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants on all of them,
-- including "User" (password hashes, email verification and password
-- reset tokens). Since NEXT_PUBLIC_SUPABASE_ANON_KEY is shipped in
-- the client bundle, this meant anyone could read or modify all data
-- directly through the Supabase REST API.
--
-- This app never queries these tables through PostgREST/anon or
-- authenticated roles - Prisma connects as the `postgres` role, which
-- has BYPASSRLS and is unaffected by RLS. Enabling RLS with no
-- policies below default-denies anon/authenticated entirely, and the
-- REVOKEs remove the standing grants as defense in depth.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Link" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "User" FROM anon, authenticated;
REVOKE ALL ON TABLE "Profile" FROM anon, authenticated;
REVOKE ALL ON TABLE "Link" FROM anon, authenticated;
REVOKE ALL ON TABLE "Block" FROM anon, authenticated;
REVOKE ALL ON TABLE "AnalyticsEvent" FROM anon, authenticated;
REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
