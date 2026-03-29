create table adventure_saves (
  wallet text primary key,
  state jsonb not null default '{}',
  intro_seen boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table adventure_saves enable row level security;

create policy "Anyone can read their own save" on adventure_saves for select using (true);

create policy "Anyone can upsert their own save" on adventure_saves for insert with check (true);

create policy "Anyone can update their own save" on adventure_saves for update using (true);
