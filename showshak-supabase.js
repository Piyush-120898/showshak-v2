/* ═══════════════════════════════════════════════════════════════
   SHOWSHAK — SUPABASE CONNECTION  (the bridge to the real database)
   ───────────────────────────────────────────────────────────────
   This file creates ONE shared connection to our Supabase backend
   and exposes it to every page as  window.ssDB.

   Include it on a page BEFORE that page's own script, and AFTER the
   supabase-js library:

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="showshak-supabase.js"></script>

   ── Is it safe that the key is here in plain text? ──
   YES. The "anon public" key is meant to live in frontend code — it
   only lets the browser make REQUESTS. What you can actually READ or
   WRITE is controlled by Row-Level Security (RLS) rules in the
   database. The key is the doorbell; RLS is the lock.
   (We NEVER put the service_role/secret key here — that one stays
   server-side only.)
═══════════════════════════════════════════════════════════════ */

const SS_SUPABASE_URL  = 'https://koqfxgrlwczlizfopmwa.supabase.co';
const SS_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvcWZ4Z3Jsd2N6bGl6Zm9wbXdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MDk5NDksImV4cCI6MjA5NjQ4NTk0OX0.nf2T1PPJBYccfqR8xCV_hUtdEv5Zs5j5CLneWqPUYB0';

/* Create the shared client. `window.supabase` comes from the CDN
   library loaded just before this file. */
(function _initSupabase() {
  if (!window.supabase || !window.supabase.createClient) {
    console.error('ShowShak: supabase-js library not loaded before showshak-supabase.js');
    return;
  }
  // window.ssDB is how every page talks to the backend from now on.
  window.ssDB = window.supabase.createClient(SS_SUPABASE_URL, SS_SUPABASE_ANON);
  console.log('ShowShak: connected to Supabase ✓');
})();
