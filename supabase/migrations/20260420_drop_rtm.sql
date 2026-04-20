-- Drop RTM (Remote Therapeutic Monitoring) feature
-- Provider linking is being removed in favor of a different business model.
-- PDF exports will be available to all users without clinician linkage.

-- Drop the FK constraint first
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_rtm_clinician_id_fkey;

-- Drop RTM columns from profiles
ALTER TABLE profiles
  DROP COLUMN IF EXISTS rtm_enabled,
  DROP COLUMN IF EXISTS rtm_clinician_id,
  DROP COLUMN IF EXISTS rtm_linked_at,
  DROP COLUMN IF EXISTS rtm_consent_text;

-- Drop the engagement days RPC
DROP FUNCTION IF EXISTS rtm_engagement_days(UUID, DATE, DATE);

-- Drop RLS policies on clinicians
DROP POLICY IF EXISTS "Authenticated users can view active clinicians" ON clinicians;

-- Drop clinicians table
DROP TABLE IF EXISTS clinicians;
