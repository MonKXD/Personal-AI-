-- ================================================================= --
-- Personal AI 0003 — tighten collection_memories RLS                  --
-- Apply in the Supabase SQL editor after 0000/0001/0002.             --
-- ================================================================= --

-- The 0002 policy only checked that the *collection* belonged to the
-- caller — not that the *memory* being associated did too. The app's
-- setMemoryInCollection() already verifies both before writing, so this
-- was never exploitable over the pooled service-role connection the app
-- actually uses, but it's a real gap if this table is ever queried under
-- RLS by a less-privileged role. Require both sides to match, mirroring
-- the ownership check already enforced in application code.
drop policy if exists "collection_memories_own" on public.collection_memories;
create policy "collection_memories_own" on public.collection_memories for all
  using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
    and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
    and exists (select 1 from public.memories m where m.id = memory_id and m.user_id = auth.uid())
  );
