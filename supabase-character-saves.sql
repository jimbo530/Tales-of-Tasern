-- Tales of Tasern — Character Save System
-- Wallet-keyed, one active character per wallet.
-- NFT stats live on-chain (LP backing). This stores the RPG layer on top.

-- ── Main character save ─────────────────────────────────────────────────────

create table if not exists character_saves (
  wallet           text primary key,
  nft_address      text not null,                    -- which NFT they're playing
  class_id         text not null default 'fighter',   -- barbarian, wizard, etc.
  level            integer not null default 1,
  xp               integer not null default 0,
  skill_ranks      jsonb not null default '{}',       -- { "climb": 2, "hide": 1, ... }
  quest_flags      jsonb not null default '{}',       -- { "elder_brynn_intro": true, "goblin_camp_cleared": false, ... }
  quest_cooldowns  jsonb not null default '{}',       -- { "daily_goblin": "2026-03-30T12:00:00Z", ... }
  inventory        jsonb not null default '[]',       -- [{ "id": "health_potion", "qty": 3 }, ...]
  equipment        jsonb not null default '{}',       -- { "weapon": "iron_sword", "armor": "leather" }
  map_region       text not null default 'newbsberd', -- current region/zone
  map_node         text not null default 'tavern',    -- current map node
  world_layer      integer not null default 1,        -- world 1, 2, 3...
  gold             integer not null default 0,
  battles_won      integer not null default 0,
  battles_lost     integer not null default 0,
  total_play_time  integer not null default 0,        -- seconds
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table character_saves enable row level security;

create policy "Read own save" on character_saves
  for select using (true);

create policy "Insert own save" on character_saves
  for insert with check (true);

create policy "Update own save" on character_saves
  for update using (true);

-- ── Combat log / battle history ─────────────────────────────────────────────
-- Optional: track battle outcomes for leaderboards and analytics

create table if not exists battle_log (
  id               uuid primary key default gen_random_uuid(),
  wallet           text not null,
  nft_address      text not null,
  class_id         text not null,
  level            integer not null,
  difficulty       text not null,                    -- easy/medium/hard
  enemies          jsonb not null default '[]',       -- enemy names fought
  result           text not null,                    -- victory/defeat/retreat
  rounds           integer not null default 0,
  xp_earned        integer not null default 0,
  gold_earned      integer not null default 0,
  fought_at        timestamptz not null default now()
);

alter table battle_log enable row level security;

create policy "Read own battles" on battle_log
  for select using (true);

create policy "Insert own battles" on battle_log
  for insert with check (true);

-- Index for leaderboard queries
create index if not exists idx_battle_log_wallet on battle_log (wallet);
create index if not exists idx_battle_log_fought_at on battle_log (fought_at desc);
