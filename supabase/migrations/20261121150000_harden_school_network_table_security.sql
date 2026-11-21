-- Restrict the singleton school-network record to authenticated network authorities.
-- All network mutations remain behind the existing audited SECURITY DEFINER RPCs.
ALTER TABLE public.school_networks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS school_networks_network_authority_read ON public.school_networks;
CREATE POLICY school_networks_network_authority_read
  ON public.school_networks
  FOR SELECT
  TO authenticated
  USING (public._is_network_authority() AND network_key = true);

-- Do not expose the network record or mutation privileges to anonymous clients.
REVOKE ALL ON TABLE public.school_networks FROM PUBLIC, anon;
-- Authenticated clients may read the singleton record only when the policy allows it.
-- They cannot directly create, modify, delete, truncate, or attach triggers to it.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.school_networks FROM authenticated;
GRANT SELECT ON TABLE public.school_networks TO authenticated;

-- These helpers are used by authenticated RLS policies and guarded RPCs.
-- PUBLIC grants would implicitly make them callable by anonymous clients.
REVOKE ALL ON FUNCTION public._is_network_authority() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_network_authority() TO authenticated;

REVOKE ALL ON FUNCTION public.school_network_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_network_id() TO authenticated;
