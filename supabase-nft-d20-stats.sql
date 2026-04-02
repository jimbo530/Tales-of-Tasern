-- Computed D20 stats cache (one row per NFT + one "__summary__" row)
-- Populated by /api/stats/refresh cron (daily), read by client via anon key
create table if not exists nft_d20_stats (
  key         text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Public read, service role write
alter table nft_d20_stats enable row level security;
create policy "Public read nft_d20_stats" on nft_d20_stats
  for select using (true);

-- Fast freshness check
create index if not exists idx_nft_d20_stats_updated
  on nft_d20_stats(updated_at);
