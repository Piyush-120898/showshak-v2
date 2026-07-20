'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'supabase', 'functions');
const webhook = fs.readFileSync(path.join(root, 'mux-webhook', 'index.ts'), 'utf8');
const takedown = fs.readFileSync(path.join(root, 'submit-takedown', 'index.ts'), 'utf8');
const feedback = fs.readFileSync(path.join(root, 'submit-feedback', 'index.ts'), 'utf8');
const muxUpload = fs.readFileSync(path.join(root, 'mux-upload-url', 'index.ts'), 'utf8');
const deleteClip = fs.readFileSync(path.join(root, 'delete-clip', 'index.ts'), 'utf8');
const tmdb = fs.readFileSync(path.join(root, 'tmdb-providers', 'index.ts'), 'utf8');

let failures = 0;
function check(condition, message) {
  if (!condition) {
    failures++;
    console.error('  x ' + message);
  } else {
    console.log('  ok ' + message);
  }
}

check(webhook.includes('response.status !== 404'), 'Mux deletes are retry-idempotent');
check((webhook.match(/return new Response\("database retry", \{ status: 500 \}\)/g) || []).length >= 7,
  'database read/write failures return retriable 5xx responses');
check(webhook.indexOf('const assetUpdate = await db.from("content_assets")') <
      webhook.lastIndexOf('status: "live"'),
  'asset ownership mapping is persisted before the live transition');
check(webhook.includes('orphan clip cleanup failed'), 'failed trim-state writes clean up the new Mux clip');

check(takedown.includes('const LEGAL_FALLBACK_EMAIL = "copyright@showshak.com"'),
  'legal availability failures return the documented fallback email');
check(takedown.includes('Deno.env.get("RATE_SALT") || ""'), 'rate subjects require a configured secret salt');
check(takedown.includes('.rpc("ss_rate_consume"'), 'takedown uses the fixed server-owned limiter policy');
check(takedown.includes('Number.isFinite(raw)') && takedown.includes('Math.min(86400'),
  'Retry-After is finite and bounded');
check(takedown.includes('{ "Retry-After": String(retryAfter) }'), '429 responses include Retry-After');
check(takedown.indexOf('const verdict = wellFormed(notice)') < takedown.indexOf('.rpc("ss_rate_consume"'),
  'malformed legal notices do not consume quota');
check(takedown.includes('`${salt}|email|${email.trim().toLowerCase()}`'),
  'takedown intake has a privacy-safe email limiter fallback');

check(feedback.includes('MAX_BODY_BYTES = 16 * 1024'), 'feedback bodies are bounded before insertion');
check(feedback.includes('.rpc("ss_rate_consume"'), 'feedback uses the server-owned limiter');
check(feedback.includes('.from("feedback").insert'), 'feedback inserts only through the Edge function');
check(muxUpload.includes('await service\n    .from("users")'), 'upload authorization reads private profile fields server-side');
check(deleteClip.includes('await service.from("users")'), 'delete authorization reads private profile fields server-side');
check(deleteClip.includes('response.ok || response.status === 404') && deleteClip.includes('mux_cleanup_failed'),
  'delete retries failed Mux cleanup while treating missing assets idempotently');
check(tmdb.includes('await db\n      .from("users")'), 'TMDB authorization reads private profile fields server-side');

if (failures) process.exit(1);
console.log('\nALL PASSED');
