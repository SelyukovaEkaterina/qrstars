-- Users with setup.completed should have onboardingCompleted = true (funnel / analytics alignment).
UPDATE "User" u
SET "onboardingCompleted" = true
WHERE u."onboardingCompleted" = false
  AND EXISTS (
    SELECT 1
    FROM "UserEvent" e
    WHERE e."userId" = u.id
      AND e.event = 'setup.completed'
      AND (e.props IS NULL OR e.props->>'rerun' IS DISTINCT FROM 'true')
  );
