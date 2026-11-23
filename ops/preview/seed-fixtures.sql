BEGIN;
INSERT INTO mm_preview.mm_subscribers (
  id,email,status,consent_version,consent_source,consent_ip_hash,unsubscribe_token
) VALUES
  ('10000000-0000-4000-8000-000000000001','active@example.test','active','preview-fixture-v1','preview-fixture','not-a-real-ip-hash','preview-active-token'),
  ('10000000-0000-4000-8000-000000000002','unsubscribed@example.test','unsubscribed','preview-fixture-v1','preview-fixture','not-a-real-ip-hash','preview-unsubscribed-token'),
  ('10000000-0000-4000-8000-000000000003','pending@example.test','pending','preview-fixture-v1','preview-fixture','not-a-real-ip-hash','preview-pending-token')
ON CONFLICT(email) DO NOTHING;
INSERT INTO mm_preview.mm_campaigns (
  id,title,subject,preheader,body,status
) VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Brouillon de démonstration',
  'Aperçu de la campagne',
  'Exemple réservé à la prévisualisation',
  'Données fictives, aucun envoi ne sera effectué.',
  'draft'
)
ON CONFLICT(id) DO NOTHING;
COMMIT;
