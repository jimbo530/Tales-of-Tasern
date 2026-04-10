CREATE TABLE vault_entries (
  wallet text NOT NULL,
  token_id int NOT NULL,
  vault_address text NOT NULL,
  total_lp_deposited float DEFAULT 0,
  total_eth_deposited float DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (wallet, token_id, vault_address)
);
