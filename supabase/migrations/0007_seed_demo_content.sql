-- ═══════════════════════════════════════════════════════════════
-- SHOWSHAK — SEED DEMO CONTENT  (Step 4 precondition)  [AUTO-GENERATED]
-- ───────────────────────────────────────────────────────────────
-- Generated from data/showshak-data.js by data/_gen_seed.js — do not
-- edit by hand; regenerate instead.
--
-- Makes the demo feed REAL so fires/saves/follows can link by foreign
-- key (your "everything linked to the video + curator" requirement):
--   • 7 demo curators  -> real auth.users + public.users (role=curator)
--   • 8 demo titles    -> titles
--   • 8 demo clips     -> content (linked to creator + title + platform)
--   • genre + mood links             -> content_genres / content_moods
--
-- EVERYTHING here is tagged seed (meta.seed = true / email @seed.showshak)
-- so supabase/RESET_demo_data.sql can remove all of it for a clean
-- launch — without touching any real users or data.
--
-- Run ONCE: SQL Editor → paste → Run. (Re-running errors on duplicate
-- emails, which is harmless — run the reset first if you want to redo.)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Demo curators (real auth users; trigger creates their profile) ──
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('946b952a-78d8-4a1c-94c9-984f6daf5589', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cinephile_arj@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Arjun Mehta', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('05a1156a-91cf-462f-b3f7-b8dc7cd48a37', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'streamjunkie_sk@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Sahil Kapoor', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('2b3e41d2-44ab-42a1-a2f3-4fad09490613', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'binge_with_priya@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Priya Nair', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('92914e14-8072-40d1-ba11-a30e6972395b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'netflixnerd_rv@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Rohan Verma', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('f411091c-50f9-4593-b738-de8f913c81ad', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'desi_binge@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Desi Binge', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('4c755f61-7f72-48cf-aae4-f5178cecc722', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kdrama_world@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'Kim Da-eun', 'seed', true));
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('d65160ae-25f5-4f9d-8570-4aa2bfc7e65b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'hbo_stan_official@seed.showshak', crypt('seed-no-login-2026', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', 'HBO Stan', 'seed', true));

-- ── 2. Enrich curator profiles created by the trigger ──
update public.users set role='curator', verified=true, bio='World cinema & Indian streaming', curator_since=now(), meta=jsonb_build_object('seed', true) where id='946b952a-78d8-4a1c-94c9-984f6daf5589';
update public.users set role='curator', verified=true, bio='Prestige drama obsessive', curator_since=now(), meta=jsonb_build_object('seed', true) where id='05a1156a-91cf-462f-b3f7-b8dc7cd48a37';
update public.users set role='curator', verified=false, bio='Crime & thriller binges', curator_since=now(), meta=jsonb_build_object('seed', true) where id='2b3e41d2-44ab-42a1-a2f3-4fad09490613';
update public.users set role='curator', verified=false, bio='Sci-fi, horror & the weird', curator_since=now(), meta=jsonb_build_object('seed', true) where id='92914e14-8072-40d1-ba11-a30e6972395b';
update public.users set role='curator', verified=true, bio='Feel-good desi picks', curator_since=now(), meta=jsonb_build_object('seed', true) where id='f411091c-50f9-4593-b738-de8f913c81ad';
update public.users set role='curator', verified=true, bio='Your K-drama plug', curator_since=now(), meta=jsonb_build_object('seed', true) where id='4c755f61-7f72-48cf-aae4-f5178cecc722';
update public.users set role='curator', verified=true, bio='Prestige TV, no compromises', curator_since=now(), meta=jsonb_build_object('seed', true) where id='d65160ae-25f5-4f9d-8570-4aa2bfc7e65b';

-- ── 3. Demo titles ──
insert into titles (id, name, year, synopsis, meta) values ('ba20fd27-de95-4ef0-af13-081852147a7f', 'SACRED GAMES', 2018, 'A link in their pasts leads Mumbai crime boss Ganesh Gaitonde to police officer Sartaj Singh.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('76144545-cfdd-42a3-9c83-7206c3d7337e', 'THE BEAR', 2022, 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('9c1aa5fe-62a1-4cb1-9703-d2aa16536b12', 'MIRZAPUR', 2018, 'A drug baron''s son forces two brothers into the world of crime and violence in eastern UP.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('7134518a-4a1d-4278-b701-697cf062ff98', 'STRANGER THINGS', 2016, 'When a boy vanishes, a small town uncovers a mystery involving secret experiments and terrifying forces.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('370ca09f-7ce2-42ad-84c5-6d54307403fd', 'PANCHAYAT', 2020, 'A city boy reluctantly joins as a government officer in a remote village.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('9316fe2b-9520-44b8-900c-14c3dd9d0249', 'SQUID GAME', 2021, 'Hundreds of cash-strapped contestants compete in deadly children''s games for an enormous cash prize.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('99010f3a-1d31-400f-a3d6-332b5331c522', 'SCAM 1992', 2020, 'The rise and fall of Harshad Mehta — the man who took the Indian stock market by storm.', jsonb_build_object('seed', true));
insert into titles (id, name, year, synopsis, meta) values ('e0343921-da67-47cb-bda2-4a181e6eb6ea', 'THE LAST OF US', 2023, 'Joel smuggles a teenage girl across post-apocalyptic America.', jsonb_build_object('seed', true));

-- ── 4. Demo clips (content), linked to creator + title + platform ──
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('8b90ab16-7f15-4876-849a-8d006fdbd8fa', '946b952a-78d8-4a1c-94c9-984f6daf5589', 'ba20fd27-de95-4ef0-af13-081852147a7f', (select id from platforms where name='Netflix' and deleted_at is null limit 1), 'This is how you <em>open</em> a series. Zero warning. Zero mercy.', 'live', 1240, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #1a0505 0%, #2d0808 30%, #0d0d0d 70%, #000 100%)', 'lang', 'Hindi', 'season', 'S1 · 8 Episodes', 'mood', '["Edge of My Seat","Late Night"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('c80b1ff4-9571-4c1f-a0e4-ea6966cea252', '05a1156a-91cf-462f-b3f7-b8dc7cd48a37', '76144545-cfdd-42a3-9c83-7206c3d7337e', (select id from platforms where name='Disney+' and deleted_at is null limit 1), 'The kitchen scene in episode 7 will destroy you. <em>Watch it.</em>', 'live', 876, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #050510 0%, #0a0a20 30%, #080808 70%, #000 100%)', 'lang', 'English', 'season', 'S1–3 · Available', 'mood', '["Want to Cry","Edge of My Seat"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('a7848bdd-c459-43aa-b96c-182f01501d21', '2b3e41d2-44ab-42a1-a2f3-4fad09490613', '9c1aa5fe-62a1-4cb1-9703-d2aa16536b12', (select id from platforms where name='Prime Video' and deleted_at is null limit 1), 'No one escapes Mirzapur. Literally <em>no one.</em>', 'live', 2100, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #0a0510 0%, #150820 30%, #0a0505 70%, #000 100%)', 'lang', 'Hindi', 'season', 'S1–3 · Available', 'mood', '["Edge of My Seat","Late Night"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('791b5c08-236d-4035-a0d6-0aa3738e6c0c', '92914e14-8072-40d1-ba11-a30e6972395b', '7134518a-4a1d-4278-b701-697cf062ff98', (select id from platforms where name='Netflix' and deleted_at is null limit 1), 'Started as nostalgia. Became <em>obsession.</em> S4 Vol 2 is cinema.', 'live', 3400, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #020510 0%, #050a1a 30%, #050205 70%, #000 100%)', 'lang', 'English', 'season', 'S1–4 · Available', 'mood', '["Mind-Bending","Edge of My Seat"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('8eaecc90-78da-48c5-a2d3-a5474fe70c47', 'f411091c-50f9-4593-b738-de8f913c81ad', '370ca09f-7ce2-42ad-84c5-6d54307403fd', (select id from platforms where name='Prime Video' and deleted_at is null limit 1), 'This show will make you quit your job and move to a village. <em>Not joking.</em>', 'live', 5200, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #021005 0%, #041a08 30%, #020802 70%, #000 100%)', 'lang', 'Hindi', 'season', 'S1–3 · Available', 'mood', '["Feel Good","Family Night"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('24822213-3165-43b7-9051-aedd202a0b1f', '4c755f61-7f72-48cf-aae4-f5178cecc722', '9316fe2b-9520-44b8-900c-14c3dd9d0249', (select id from platforms where name='Netflix' and deleted_at is null limit 1), 'Episode 6. Front Man reveal. You will <em>not</em> be okay.', 'live', 7800, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #100008 0%, #1a0010 30%, #080005 70%, #000 100%)', 'lang', 'Korean', 'season', 'S1–2 · Available', 'mood', '["Edge of My Seat","Want to Cry"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('5fc21c07-f522-4767-ab12-bdd457111c7f', '946b952a-78d8-4a1c-94c9-984f6daf5589', '99010f3a-1d31-400f-a3d6-332b5331c522', (select id from platforms where name='SonyLIV' and deleted_at is null limit 1), 'Highest rated Indian show ever. One curator. One verdict. <em>Watch it.</em>', 'live', 4300, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #080500 0%, #140c00 30%, #050300 70%, #000 100%)', 'lang', 'Hindi', 'season', 'S1 · 10 Episodes', 'mood', '["Mind-Bending","Late Night"]'));
insert into content (id, creator_id, title_id, platform_id, description, status, fires_count, meta)
values ('a72d339b-4d40-4549-893a-b3776a9c3998', 'd65160ae-25f5-4f9d-8570-4aa2bfc7e65b', 'e0343921-da67-47cb-bda2-4a181e6eb6ea', (select id from platforms where name='JioHotstar' and deleted_at is null limit 1), 'Episode 3 broke the internet. Broke <em>me</em>. Watch immediately.', 'live', 6100, jsonb_build_object('seed', true, 'bg', 'linear-gradient(160deg, #030805 0%, #050e08 30%, #020503 70%, #000 100%)', 'lang', 'English', 'season', 'S1–2 · Available', 'mood', '["Want to Cry","Edge of My Seat"]'));

-- ── 5. content_genres links (genres exist from migration 0001) ──
insert into content_genres (content_id, genre_id) select '8b90ab16-7f15-4876-849a-8d006fdbd8fa', id from genres where name='Crime' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '8b90ab16-7f15-4876-849a-8d006fdbd8fa', id from genres where name='Thriller' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'c80b1ff4-9571-4c1f-a0e4-ea6966cea252', id from genres where name='Drama' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'c80b1ff4-9571-4c1f-a0e4-ea6966cea252', id from genres where name='Comedy' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'a7848bdd-c459-43aa-b96c-182f01501d21', id from genres where name='Action' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'a7848bdd-c459-43aa-b96c-182f01501d21', id from genres where name='Crime' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '791b5c08-236d-4035-a0d6-0aa3738e6c0c', id from genres where name='Sci-Fi' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '791b5c08-236d-4035-a0d6-0aa3738e6c0c', id from genres where name='Horror' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '8eaecc90-78da-48c5-a2d3-a5474fe70c47', id from genres where name='Comedy' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '8eaecc90-78da-48c5-a2d3-a5474fe70c47', id from genres where name='Drama' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '24822213-3165-43b7-9051-aedd202a0b1f', id from genres where name='Thriller' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '24822213-3165-43b7-9051-aedd202a0b1f', id from genres where name='Drama' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '5fc21c07-f522-4767-ab12-bdd457111c7f', id from genres where name='Crime' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select '5fc21c07-f522-4767-ab12-bdd457111c7f', id from genres where name='Drama' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'a72d339b-4d40-4549-893a-b3776a9c3998', id from genres where name='Drama' limit 1 on conflict do nothing;
insert into content_genres (content_id, genre_id) select 'a72d339b-4d40-4549-893a-b3776a9c3998', id from genres where name='Sci-Fi' limit 1 on conflict do nothing;

-- ── 6. content_moods links (moods exist from migration 0001) ──
insert into content_moods (content_id, mood_id) select '8b90ab16-7f15-4876-849a-8d006fdbd8fa', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '8b90ab16-7f15-4876-849a-8d006fdbd8fa', id from moods where name='Late Night' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'c80b1ff4-9571-4c1f-a0e4-ea6966cea252', id from moods where name='Want to Cry' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'c80b1ff4-9571-4c1f-a0e4-ea6966cea252', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'a7848bdd-c459-43aa-b96c-182f01501d21', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'a7848bdd-c459-43aa-b96c-182f01501d21', id from moods where name='Late Night' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '791b5c08-236d-4035-a0d6-0aa3738e6c0c', id from moods where name='Mind-Bending' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '791b5c08-236d-4035-a0d6-0aa3738e6c0c', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '8eaecc90-78da-48c5-a2d3-a5474fe70c47', id from moods where name='Feel Good' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '8eaecc90-78da-48c5-a2d3-a5474fe70c47', id from moods where name='Family Night' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '24822213-3165-43b7-9051-aedd202a0b1f', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '24822213-3165-43b7-9051-aedd202a0b1f', id from moods where name='Want to Cry' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '5fc21c07-f522-4767-ab12-bdd457111c7f', id from moods where name='Mind-Bending' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select '5fc21c07-f522-4767-ab12-bdd457111c7f', id from moods where name='Late Night' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'a72d339b-4d40-4549-893a-b3776a9c3998', id from moods where name='Want to Cry' limit 1 on conflict do nothing;
insert into content_moods (content_id, mood_id) select 'a72d339b-4d40-4549-893a-b3776a9c3998', id from moods where name='Edge of My Seat' limit 1 on conflict do nothing;

-- ═══════════════════════════════════════════════════════════════
-- DONE. The feed's clips + curators are now real, FK-linked rows.
-- Fires / saves / follows can now persist against real IDs.
-- To wipe everything for launch: run supabase/RESET_demo_data.sql
-- ═══════════════════════════════════════════════════════════════
