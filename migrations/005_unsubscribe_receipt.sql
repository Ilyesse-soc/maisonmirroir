BEGIN;
ALTER TABLE mm_jobs DROP CONSTRAINT IF EXISTS mm_jobs_kind_check;
ALTER TABLE mm_jobs ADD CONSTRAINT mm_jobs_kind_check CHECK(kind IN ('confirmation','welcome','campaign','unsubscribe_confirmation'));
COMMIT;
