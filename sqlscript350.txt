-- Corrected consolidated idempotent DDL script (constraints added conditionally)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type_enum') THEN
    CREATE TYPE transaction_type_enum AS ENUM ('buy','sell');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL DEFAULT 'user',
  kyc_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON c.relnamespace = n.oid WHERE c.relname = 'users' AND n.nspname = 'auth') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'profiles' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'auth_id'
    ) THEN
      ALTER TABLE profiles
        ADD CONSTRAINT fk_profiles_auth_users
        FOREIGN KEY (auth_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON profiles(auth_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE TABLE IF NOT EXISTS properties (
  property_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  property_type text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_properties_name ON properties(name);

CREATE TABLE IF NOT EXISTS listings (
  listing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  created_by_user_id uuid,
  status text NOT NULL DEFAULT 'draft',
  price_per_share_usd numeric(20,8) NOT NULL CHECK (price_per_share_usd >= 0),
  min_investment_usd numeric(20,2) NOT NULL CHECK (min_investment_usd >= 0),
  max_investment_usd numeric(20,2),
  total_shares_available integer NOT NULL CHECK (total_shares_available >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'listings' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'property_id'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT fk_listings_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'listings' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE listings ADD CONSTRAINT fk_listings_created_by FOREIGN KEY (created_by_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_listings_property_id ON listings(property_id);
CREATE INDEX IF NOT EXISTS idx_listings_created_by ON listings(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);

CREATE TABLE IF NOT EXISTS holdings (
  holding_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  share_quantity numeric(30,8) NOT NULL CHECK (share_quantity >= 0),
  average_cost_basis_usd numeric(20,8) NOT NULL CHECK (average_cost_basis_usd >= 0),
  last_updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'holdings' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE holdings ADD CONSTRAINT fk_holdings_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'holdings' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'listing_id'
  ) THEN
    ALTER TABLE holdings ADD CONSTRAINT fk_holdings_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_holdings_user_listing ON holdings(user_id, listing_id);
CREATE INDEX IF NOT EXISTS idx_holdings_user_id ON holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_listing_id ON holdings(listing_id);

CREATE TABLE IF NOT EXISTS transactions (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  listing_id uuid,
  transaction_type transaction_type_enum NOT NULL,
  share_quantity numeric(30,8) NOT NULL CHECK (share_quantity > 0),
  price_per_share_usd numeric(20,8) NOT NULL CHECK (price_per_share_usd >= 0),
  total_amount_usd numeric(30,8) NOT NULL CHECK (total_amount_usd >= 0),
  status text NOT NULL DEFAULT 'pending',
  blockchain_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'transactions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'transactions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'listing_id'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT fk_transactions_listing FOREIGN KEY (listing_id) REFERENCES listings(listing_id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_listing_id ON transactions(listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  notification_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'notifications' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE notifications ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

CREATE OR REPLACE FUNCTION is_profile_admin(profile_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (role = 'admin') FROM profiles WHERE id = profile_uuid LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION is_profile_admin(uuid) FROM PUBLIC;

CREATE TABLE IF NOT EXISTS admin_actions (
  admin_action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_property_id uuid,
  target_listing_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'admin_actions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'admin_user_id'
  ) THEN
    ALTER TABLE admin_actions ADD CONSTRAINT fk_admin_actions_admin FOREIGN KEY (admin_user_id) REFERENCES profiles(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'admin_actions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'target_property_id'
  ) THEN
    ALTER TABLE admin_actions ADD CONSTRAINT fk_admin_actions_property FOREIGN KEY (target_property_id) REFERENCES properties(property_id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'admin_actions' AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'target_listing_id'
  ) THEN
    ALTER TABLE admin_actions ADD CONSTRAINT fk_admin_actions_listing FOREIGN KEY (target_listing_id) REFERENCES listings(listing_id) ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'admin_actions' AND c.contype = 'c' AND c.conname = 'admin_must_be_admin') THEN
    ALTER TABLE admin_actions ADD CONSTRAINT admin_must_be_admin CHECK (is_profile_admin(admin_user_id) IS TRUE);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at ON profiles';
    EXECUTE 'CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='properties' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_properties ON properties';
    EXECUTE 'CREATE TRIGGER set_updated_at_properties BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='listings' AND column_name='updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS set_updated_at_listings ON listings';
    EXECUTE 'CREATE TRIGGER set_updated_at_listings BEFORE UPDATE ON listings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()';
  END IF;
END$$;