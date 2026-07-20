'use strict';

// Static regression guard for the additive migration. Database exploit tests
// still run against staging; this catches accidental ACL/allowlist regressions
// before a migration is copied into the SQL editor.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '0041_security_boundary.sql'),
  'utf8'
);
const sharedRuntime = fs.readFileSync(
  path.join(__dirname, '..', '..', 'showshak-web', 'showshak-shared.js'),
  'utf8'
);

const deleteClipStart = sharedRuntime.indexOf('async function ssDeleteClip(clipId)');
const deleteClipEnd = sharedRuntime.indexOf('window.ssDeleteClip = ssDeleteClip', deleteClipStart);
assert.notStrictEqual(deleteClipStart, -1, 'ssDeleteClip must remain defined');
assert.notStrictEqual(deleteClipEnd, -1, 'ssDeleteClip must remain exported');
const deleteClipSource = sharedRuntime.slice(deleteClipStart, deleteClipEnd);

assert.match(deleteClipSource, /\.functions\.invoke\(\s*['"]delete-clip['"]/);
assert.match(deleteClipSource, /body:\s*\{\s*contentId:\s*String\(clipId\)\s*\}/);
assert.doesNotMatch(deleteClipSource, /\.from\(\s*['"]content['"]\s*\)/);
assert.doesNotMatch(deleteClipSource, /\.update\s*\(/);

assert.match(sql, /create or replace function public\.ss_guard_users_write\(\)/);
assert.match(sql, /new\.is_admin is distinct from old\.is_admin/);
assert.match(sql, /create or replace view public\.public_profiles/);
assert.match(sql, /create or replace function public\.ss_get_my_profile\(\)/);
assert.match(sql, /create or replace function public\.ss_update_my_profile\(payload jsonb\)/);
assert.match(sql, /profile field is not editable/);
assert.match(sql, /metadata field is not editable/);
assert.match(sql, /create or replace function public\.ss_record_consent/);
assert.match(sql, /'consent_ok', true/);
assert.match(sql, /revoke insert, update on table public\.users from authenticated/);
assert.match(sql, /revoke select on table public\.users from public, anon, authenticated/);
assert.match(sql, /grant select \(id, username, name, bio, avatar_url, role, verified, genres,/);
assert.match(sql, /create unique index if not exists idx_users_username_ci/);
assert.match(sql, /case-insensitive username collision must be resolved before 0041/);
assert.match(sql, /create or replace function public\.handle_new_user\(\)/);
assert.match(sql, /exception when unique_violation/);
assert.match(sql, /revoke select on table public\.users from public, anon, authenticated/);
assert.match(sql, /create or replace function public\.ss_rate_consume\(p_bucket text, p_subject text\)/);
assert.match(sql, /pg_advisory_xact_lock/);
assert.match(sql, /revoke all on function public\.ss_rate_consume\(text, text\) from public, anon, authenticated/);
assert.match(sql, /create table if not exists public\.content_assets/);
assert.match(sql, /insert into public\.content_assets \(/);
assert.match(sql, /create or replace function public\.ss_guard_content_write\(\)/);
assert.match(sql, /create or replace function public\.sync_fires_count\(\)/);
assert.match(sql, /create or replace function public\.sync_views_count\(\)/);
assert.match(sql, /set_config\('app\.ss_privileged_write', coalesce\(v_previous, 'off'\), true\)/);
assert.match(sql, /new\.status is distinct from old\.status/);
assert.match(sql, /new\.deleted_at is distinct from old\.deleted_at/);
assert.match(sql, /new\.mux_asset_id is distinct from old\.mux_asset_id/);
assert.match(sql, /new\.fires_count is distinct from old\.fires_count/);
assert.match(
  sql,
  /create trigger ss_guard_content_write\s+before insert or update on public\.content\s+for each row execute function public\.ss_guard_content_write\(\)/
);
assert.match(sql, /create or replace function public\.ss_sync_content_asset_lifecycle\(\)/);
assert.match(sql, /update public\.content_assets set\s+lifecycle = case/);
assert.match(sql, /upload_id = coalesce\(upload_id, nullif\(new\.meta->>'mux_upload_id', ''\)\)/);
assert.match(
  sql,
  /create trigger ss_sync_content_asset_lifecycle\s+after update of status, deleted_at, meta on public\.content\s+for each row execute function public\.ss_sync_content_asset_lifecycle\(\)/
);
assert.match(sql, /create or replace function public\.ss_guard_event_insert\(\)/);
assert.match(sql, /v_watch_ms := \(to_jsonb\(new\)->>'watch_ms'\)::integer/);
assert.match(sql, /v_headers := v_headers_raw::jsonb/);
assert.match(sql, /revoke insert on table public\.feedback from public, anon, authenticated/);
assert.match(sql, /create or replace function public\.find_or_create_title/);
assert.match(sql, /'avatars', 'avatars', true, 5 \* 1024 \* 1024/);
assert.match(sql, /'review-clips', 'review-clips', false, 300 \* 1024 \* 1024/);
assert.match(sql, /v_terms is not true/);
assert.match(sql, /split_part\(v_reference, '\/', 1\) <> v_uid::text/);

console.log('security-boundary-static: PASS');
