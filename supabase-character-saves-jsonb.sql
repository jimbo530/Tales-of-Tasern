-- Tales of Tasern — Character Save schema fix (run once in Supabase SQL Editor)
--
-- WHY: the CharacterSave TypeScript type has ~50 fields (coins, parties, party,
-- feats, spells, ships, crafting, food, hp, gate_mail, hex_threats, …) but the
-- original character_saves table only had ~22 columns. saveCharacter() upserted
-- the WHOLE object, so PostgREST rejected the unknown columns (PGRST204) and
-- every cloud save silently failed — the offline-tolerant catch reported success
-- while only localStorage actually persisted. Clearing the browser or switching
-- devices lost all RPG progress.
--
-- FIX: store the full save as one jsonb blob (save_data). The code writes the
-- blob plus the few flat columns that already exist (for leaderboard/analytics
-- queries) and reads the blob back as the source of truth. No need to mirror
-- every field as its own column.

-- Add the blob column (safe to run repeatedly).
alter table character_saves
  add column if not exists save_data jsonb;

-- The original table defaulted class_id NOT NULL etc.; the blob is the real
-- payload now, so relax the legacy NOT NULLs that the code no longer guarantees
-- to send as top-level columns. (Existing rows keep their values.)
alter table character_saves alter column class_id   drop not null;
alter table character_saves alter column nft_address drop not null;

-- Note: `gold integer` is a legacy column from an older money model; the game
-- now uses coins {gp,sp,cp} inside save_data. The gold column is left in place
-- (harmless) but is no longer authoritative.
