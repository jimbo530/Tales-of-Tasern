-- Shared chain data tables for both game branches
-- Run this in Supabase SQL Editor

-- Raw token amounts held by each NFT (the game-agnostic intermediate data)
-- Both games read from this table and apply their own stat formulas
create table if not exists nft_token_amounts (
  nft_address   text not null,
  token_address text not null,
  symbol        text not null default '',
  raw_amount    float8 not null default 0,
  usd_value     float8 not null default 0,
  decimals      int not null default 18,
  updated_at    timestamptz not null default now(),
  primary key (nft_address, token_address)
);

-- Token USD prices derived from on-chain pairs + CoinGecko
create table if not exists token_prices (
  token_address text primary key,
  symbol        text not null default '',
  usd_price     float8 not null default 0,
  decimals      int not null default 18,
  category      text not null default 'game',
  updated_at    timestamptz not null default now()
);

-- Which NFTs the marketplace seller wallet holds
create table if not exists seller_ownership (
  nft_address text primary key,
  chain       text not null default 'base',
  balance     int not null default 0,
  updated_at  timestamptz not null default now()
);

-- Cached NFT image URLs (resolved from IPFS metadata)
create table if not exists nft_images (
  nft_address  text primary key,
  chain        text not null default 'base',
  metadata_uri text,
  image_url    text,
  updated_at   timestamptz not null default now()
);

-- Per-NFT summary: total USD backing and asset category breakdown
create table if not exists nft_summary (
  nft_address    text primary key,
  name           text not null default '',
  chain          text not null default 'base',
  usd_backing    float8 not null default 0,
  usd_traditional float8 not null default 0,
  usd_game       float8 not null default 0,
  usd_impact     float8 not null default 0,
  updated_at     timestamptz not null default now()
);

-- RLS: public read, service role write
alter table nft_token_amounts enable row level security;
alter table token_prices enable row level security;
alter table seller_ownership enable row level security;
alter table nft_images enable row level security;
alter table nft_summary enable row level security;

-- Allow anyone to read
create policy "Public read nft_token_amounts" on nft_token_amounts for select using (true);
create policy "Public read token_prices" on token_prices for select using (true);
create policy "Public read seller_ownership" on seller_ownership for select using (true);
create policy "Public read nft_images" on nft_images for select using (true);
create policy "Public read nft_summary" on nft_summary for select using (true);

-- Indexes for common queries
create index if not exists idx_nft_token_amounts_nft on nft_token_amounts(nft_address);
create index if not exists idx_nft_token_amounts_token on nft_token_amounts(token_address);
create index if not exists idx_token_prices_category on token_prices(category);
