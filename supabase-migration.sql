-- Shared NFT/LP Registry — used by both Tales of Tasern and the card-battle game
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ── NFTs table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nfts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  contract_address text NOT NULL,
  chain text NOT NULL CHECK (chain IN ('base', 'polygon')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (contract_address, chain)
);

-- ── LP Pairs table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lp_pairs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  pair_address text NOT NULL,
  chain text NOT NULL CHECK (chain IN ('base', 'polygon')),
  label text,  -- e.g. "USDGLO / MfT (Uniswap V2 Base)"
  created_at timestamptz DEFAULT now(),
  UNIQUE (pair_address, chain)
);

-- ── RLS policies (allow public read, authenticated insert) ──────────────────
ALTER TABLE nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lp_pairs ENABLE ROW LEVEL SECURITY;

-- Anyone can read (both games need this from the browser)
CREATE POLICY "nfts_public_read" ON nfts FOR SELECT USING (true);
CREATE POLICY "lp_pairs_public_read" ON lp_pairs FOR SELECT USING (true);

-- Anon key can insert/update (for the seed route and future admin)
CREATE POLICY "nfts_anon_insert" ON nfts FOR INSERT WITH CHECK (true);
CREATE POLICY "nfts_anon_update" ON nfts FOR UPDATE USING (true);
CREATE POLICY "lp_pairs_anon_insert" ON lp_pairs FOR INSERT WITH CHECK (true);
CREATE POLICY "lp_pairs_anon_update" ON lp_pairs FOR UPDATE USING (true);
