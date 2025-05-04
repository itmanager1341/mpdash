
-- Create an SQL function that our edge function can call via RPC
CREATE OR REPLACE FUNCTION create_api_keys_table()
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create the api_keys table if it doesn't exist
  CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    service TEXT NOT NULL,
    key_masked TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  
  RETURN TRUE;
END;
$$;
