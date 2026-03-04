-- Migration 012: Populate avatar_url from Slack profile pictures
-- Matched by work_email

UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-14/9515612204930_3cf3a961bcdea445e30a_original.png' WHERE work_email = 'admin@omdsystems.com';
UPDATE employees SET avatar_url = 'https://secure.gravatar.com/avatar/d51b52c47c7b022540c419f8448b5b25.jpg?s=512&d=https%3A%2F%2Fa.slack-edge.com%2Fdf10d%2Fimg%2Favatars%2Fava_0008-512.png' WHERE work_email = 'abhishek@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-11-05/9828757578103_0946bdc04d860687d3a9_original.jpg' WHERE work_email = 'ihordutchak@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2026-02-04/10454139512417_cc09a490a967ae333e93_original.jpg' WHERE work_email = 'denys.homyakov@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2026-02-09/10486053086897_d7c71a42e70bc08bb56a_original.jpg' WHERE work_email = 'dmitry.siem@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2026-01-07/10244554190834_81119f16cd06adb477a5_original.jpg' WHERE work_email = 'slava@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-15/9518371659014_15a095ae269f30bde0ee_original.jpg' WHERE work_email = 'aleksandr.gusarov@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2026-01-09/10262713328118_d0eb4a7a2789a7e35779_original.jpg' WHERE work_email = 'petrov_av@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-15/9517529938070_eb414d79c3f52d2a4386_original.png' WHERE work_email = 'lena@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-18/9527206158455_caf7bbd4bd4245599268_original.png' WHERE work_email = 'sergey@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-15/9515603092741_bd5d9366709e0d662e06_original.jpg' WHERE work_email = 'vadim@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2026-01-27/10378718292550_b3a16ce6db8813384270_original.jpg' WHERE work_email = 'bhorokhov@omdsystems.com';
UPDATE employees SET avatar_url = 'https://avatars.slack-edge.com/2025-09-19/9559865598497_079fdb5422035fb78982_original.jpg' WHERE work_email = 'perss@omdsystems.com';
