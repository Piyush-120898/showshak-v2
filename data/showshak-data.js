/* ═══════════════════════════════════════════════════════════════
   SHOWSHAK — CENTRAL MOCK DATA  (single source of truth)
   ─────────────────────────────────────────────────────────────
   WHY THIS FILE EXISTS
   Until now every page hard-coded its OWN copy of the same clips
   (feed = SHOWS, discover = CLIPS, watchlist = ALL_CLIPS, upload =
   SHOW_CATALOG). Same 8 clips, four drifting shapes. This file holds
   ONE normalized core and rebuilds each page's exact array from it.

   HOW IT MAPS TO THE REAL DATABASE (see backend-schema.md)
     SS.platforms  → platforms / availability lookup (JustWatch/TMDB)
     SS.curators   → users  (role = 'curator')
     SS.clips      → clips  (+ joins to titles & users)
     SS.catalog    → titles (the TMDB search catalog)
   When the backend lands, these arrays are replaced by API responses;
   the projection functions below become the client-side mappers, so
   the pages NEVER change again. Swap the source, keep the shape.

   USAGE (browser): include BEFORE the page's own <script>:
     <script src="data/showshak-data.js"></script>
     ...then:  const SHOWS = SSData.feedShows();
   USAGE (node, for the verification script):
     const SSData = require('./data/showshak-data.js');
═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  /* ════════════════════════════════════════════════
     CORE 1 — PLATFORMS  (the streaming services)
     One record per service. color/abbr/rgb are the
     prototype's stand-in for a real logo asset.
  ════════════════════════════════════════════════ */
  const PLATFORMS = {
    'Netflix':     { color: '#E50914', abbr: 'N',   rgb: '229,9,20'   },
    'Prime Video': { color: '#00A8E0', abbr: 'P',   rgb: '0,168,224'  },
    'Disney+':     { color: '#0E3BD4', abbr: 'D+',  rgb: '14,59,212'  },
    'JioHotstar':  { color: '#FF6A00', abbr: 'JH',  rgb: '255,106,0'  },
    'Apple TV+':   { color: '#111111', abbr: '▶',   rgb: '80,80,80'   },
    'SonyLIV':     { color: '#002868', abbr: 'S',   rgb: '0,40,104'   },
    'HBO Max':     { color: '#5C2D91', abbr: 'HBO', rgb: '92,45,145'  },
    'Zee5':        { color: '#6B1DF5', abbr: 'Z5',  rgb: '107,29,245' },
    'Hulu':        { color: '#1CE783', abbr: 'H',   rgb: '28,231,131' },
  };

  // The order/subset shown as filter chips on Discover. Major India platforms
  // only — no duplicates, and no services not available in India (Disney+ is
  // merged into JioHotstar here; HBO Max / Hulu aren't in India).
  const PLATFORM_FILTER_ORDER = [
    'Netflix', 'Prime Video', 'JioHotstar',
    'SonyLIV', 'Zee5', 'Apple TV+',
  ];

  /* ════════════════════════════════════════════════
     CORE 2 — CURATORS  (users with role = 'curator')
     letter/bg = avatar placeholder; name/verified/bio = profile.
  ════════════════════════════════════════════════ */
  const CURATORS = {
    cinephile_arj:     { name: 'Arjun Mehta',  letter: 'A', bg: '#E8373E', verified: true,  bio: 'World cinema & Indian streaming' },
    streamjunkie_sk:   { name: 'Sahil Kapoor', letter: 'S', bg: '#FF6B35', verified: true,  bio: 'Prestige drama obsessive' },
    binge_with_priya:  { name: 'Priya Nair',   letter: 'P', bg: '#9B59B6', verified: false, bio: 'Crime & thriller binges' },
    netflixnerd_rv:    { name: 'Rohan Verma',  letter: 'R', bg: '#3498DB', verified: false, bio: 'Sci-fi, horror & the weird' },
    desi_binge:        { name: 'Desi Binge',   letter: 'D', bg: '#27AE60', verified: true,  bio: 'Feel-good desi picks' },
    kdrama_world:      { name: 'Kim Da-eun',   letter: 'K', bg: '#E74C3C', verified: true,  bio: 'Your K-drama plug' },
    hbo_stan_official: { name: 'HBO Stan',     letter: 'H', bg: '#5C2D91', verified: true,  bio: 'Prestige TV, no compromises' },
  };

  /* ════════════════════════════════════════════════
     CORE 3 — CLIPS  (the 8 canonical clips)
     Per clip we store EVERYTHING any page needs:
       - feedCaption vs discoverCaption (Discover hides the title,
         so its caption is sometimes shorter / title-free)
       - availability[]: ordered {platform, included} for the feed's
         "Watch on" list. `platform` is the PRIMARY (Watch It button),
         authored explicitly because it is not always availability[0]
         (e.g. The Last of Us → JioHotstar, listed 2nd).
       - gradient: the feed/discover poster placeholder (identical on
         both). The watchlist's 3-stop variant is DERIVED from it.
  ════════════════════════════════════════════════ */
  const CLIPS = [
    {
      id: 1, title: 'SACRED GAMES', curator: 'cinephile_arj',
      year: 2018, genre: ['Crime', 'Thriller'], lang: 'Hindi',
      runtime: '55 min/ep', season: 'S1 · 8 Episodes',
      synopsis: 'A link in their pasts leads Mumbai crime boss Ganesh Gaitonde to police officer Sartaj Singh.',
      feedCaption: 'This is how you <em>open</em> a series. Zero warning. Zero mercy.',
      discoverCaption: 'This is how you <em>open</em> a series. Zero warning. Zero mercy.',
      fires: 1240, platform: 'Netflix', availability: [{ platform: 'Netflix', included: true }],
      mood: ['Edge of My Seat', 'Late Night'],
      gradient: 'linear-gradient(160deg, #1a0505 0%, #2d0808 30%, #0d0d0d 70%, #000 100%)',
    },
    {
      id: 2, title: 'THE BEAR', curator: 'streamjunkie_sk',
      year: 2022, genre: ['Drama', 'Comedy'], lang: 'English',
      runtime: '34 min/ep', season: 'S1–3 · Available',
      synopsis: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.',
      feedCaption: 'The kitchen scene in episode 7 will destroy you. <em>Watch it.</em>',
      discoverCaption: 'The kitchen scene in episode 7 will <em>destroy</em> you.',
      fires: 876, platform: 'Disney+',
      availability: [{ platform: 'Disney+', included: true }, { platform: 'Hulu', included: false }],
      mood: ['Want to Cry', 'Edge of My Seat'],
      gradient: 'linear-gradient(160deg, #050510 0%, #0a0a20 30%, #080808 70%, #000 100%)',
    },
    {
      id: 3, title: 'MIRZAPUR', curator: 'binge_with_priya',
      year: 2018, genre: ['Action', 'Crime'], lang: 'Hindi',
      runtime: '45–60 min/ep', season: 'S1–3 · Available',
      synopsis: "A drug baron's son forces two brothers into the world of crime and violence in eastern UP.",
      feedCaption: 'No one escapes Mirzapur. Literally <em>no one.</em>',
      discoverCaption: 'No one escapes. Literally <em>no one.</em>',
      fires: 2100, platform: 'Prime Video', availability: [{ platform: 'Prime Video', included: true }],
      mood: ['Edge of My Seat', 'Late Night'],
      gradient: 'linear-gradient(160deg, #0a0510 0%, #150820 30%, #0a0505 70%, #000 100%)',
    },
    {
      id: 4, title: 'STRANGER THINGS', curator: 'netflixnerd_rv',
      year: 2016, genre: ['Sci-Fi', 'Horror'], lang: 'English',
      runtime: '51 min/ep', season: 'S1–4 · Available',
      synopsis: 'When a boy vanishes, a small town uncovers a mystery involving secret experiments and terrifying forces.',
      feedCaption: 'Started as nostalgia. Became <em>obsession.</em> S4 Vol 2 is cinema.',
      discoverCaption: 'Started as nostalgia. Became <em>obsession.</em>',
      fires: 3400, platform: 'Netflix', availability: [{ platform: 'Netflix', included: true }],
      mood: ['Mind-Bending', 'Edge of My Seat'],
      gradient: 'linear-gradient(160deg, #020510 0%, #050a1a 30%, #050205 70%, #000 100%)',
    },
    {
      id: 5, title: 'PANCHAYAT', curator: 'desi_binge',
      year: 2020, genre: ['Comedy', 'Drama'], lang: 'Hindi',
      runtime: '28–40 min/ep', season: 'S1–3 · Available',
      synopsis: 'A city boy reluctantly joins as a government officer in a remote village.',
      feedCaption: 'This show will make you quit your job and move to a village. <em>Not joking.</em>',
      discoverCaption: 'Will make you quit your job and move to a village. <em>Not joking.</em>',
      fires: 5200, platform: 'Prime Video', availability: [{ platform: 'Prime Video', included: true }],
      mood: ['Feel Good', 'Family Night'],
      gradient: 'linear-gradient(160deg, #021005 0%, #041a08 30%, #020802 70%, #000 100%)',
    },
    {
      id: 6, title: 'SQUID GAME', curator: 'kdrama_world',
      year: 2021, genre: ['Thriller', 'Drama'], lang: 'Korean',
      runtime: '32–63 min/ep', season: 'S1–2 · Available',
      synopsis: "Hundreds of cash-strapped contestants compete in deadly children's games for an enormous cash prize.",
      feedCaption: 'Episode 6. Front Man reveal. You will <em>not</em> be okay.',
      discoverCaption: 'Episode 6. Front Man reveal. You will <em>not</em> be okay.',
      fires: 7800, platform: 'Netflix', availability: [{ platform: 'Netflix', included: true }],
      mood: ['Edge of My Seat', 'Want to Cry'],
      gradient: 'linear-gradient(160deg, #100008 0%, #1a0010 30%, #080005 70%, #000 100%)',
    },
    {
      id: 7, title: 'SCAM 1992', curator: 'cinephile_arj',
      year: 2020, genre: ['Crime', 'Drama'], lang: 'Hindi',
      runtime: '40–55 min/ep', season: 'S1 · 10 Episodes',
      synopsis: 'The rise and fall of Harshad Mehta — the man who took the Indian stock market by storm.',
      feedCaption: 'Highest rated Indian show ever. One curator. One verdict. <em>Watch it.</em>',
      discoverCaption: 'Highest rated Indian show ever. One curator. One verdict. <em>Watch it.</em>',
      fires: 4300, platform: 'SonyLIV', availability: [{ platform: 'SonyLIV', included: false }],
      mood: ['Mind-Bending', 'Late Night'],
      gradient: 'linear-gradient(160deg, #080500 0%, #140c00 30%, #050300 70%, #000 100%)',
    },
    {
      id: 8, title: 'THE LAST OF US', curator: 'hbo_stan_official',
      year: 2023, genre: ['Drama', 'Sci-Fi'], lang: 'English',
      runtime: '44–75 min/ep', season: 'S1–2 · Available',
      synopsis: 'Joel smuggles a teenage girl across post-apocalyptic America.',
      feedCaption: 'Episode 3 broke the internet. Broke <em>me</em>. Watch immediately.',
      discoverCaption: 'Episode 3 broke the internet. Broke <em>me</em>. Watch immediately.',
      fires: 6100, platform: 'JioHotstar',
      availability: [{ platform: 'HBO Max', included: false }, { platform: 'JioHotstar', included: true }],
      mood: ['Want to Cry', 'Edge of My Seat'],
      gradient: 'linear-gradient(160deg, #030805 0%, #050e08 30%, #020503 70%, #000 100%)',
    },
  ];

  /* ════════════════════════════════════════════════
     CORE 4 — CATALOG  (the TMDB title-search stand-in)
     Deliberately INDEPENDENT of clips: it has titles with no clip
     yet (Breaking Bad, Dahaad) and its own poster gradients/genres
     (e.g. The Last of Us differs from its clip). Mirrors the real
     `titles` table that TMDB search will populate.
  ════════════════════════════════════════════════ */
  const CATALOG = [
    { name: 'Sacred Games',    year: 2018, genre: ['Crime', 'Thriller'], platform: 'Netflix',     bg: 'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)' },
    { name: 'The Bear',        year: 2022, genre: ['Drama', 'Comedy'],   platform: 'Disney+',     bg: 'linear-gradient(160deg,#050510,#0a0a20,#080808,#000)' },
    { name: 'Mirzapur',        year: 2018, genre: ['Action', 'Crime'],   platform: 'Prime Video', bg: 'linear-gradient(160deg,#0a0510,#150820,#0a0505,#000)' },
    { name: 'Stranger Things', year: 2016, genre: ['Sci-Fi', 'Horror'],  platform: 'Netflix',     bg: 'linear-gradient(160deg,#020510,#050a1a,#050205,#000)' },
    { name: 'Squid Game',      year: 2021, genre: ['Thriller', 'Drama'], platform: 'Netflix',     bg: 'linear-gradient(160deg,#100008,#1a0010,#080005,#000)' },
    { name: 'Panchayat',       year: 2020, genre: ['Comedy', 'Drama'],   platform: 'Prime Video', bg: 'linear-gradient(160deg,#021005,#041a08,#020802,#000)' },
    { name: 'Scam 1992',       year: 2020, genre: ['Crime', 'Drama'],    platform: 'SonyLIV',     bg: 'linear-gradient(160deg,#080500,#140c00,#050300,#000)' },
    { name: 'Breaking Bad',    year: 2008, genre: ['Crime', 'Drama'],    platform: 'Netflix',     bg: 'linear-gradient(160deg,#02100a,#041a10,#020805,#000)' },
    { name: 'The Last of Us',  year: 2023, genre: ['Drama', 'Horror'],   platform: 'JioHotstar',  bg: 'linear-gradient(160deg,#0a0803,#161005,#050300,#000)' },
    { name: 'Dahaad',          year: 2023, genre: ['Crime', 'Thriller'], platform: 'Prime Video', bg: 'linear-gradient(160deg,#10040a,#1a0610,#080205,#000)' },
  ];

  /* ════════════════════════════════════════════════
     CORE 5 — STATIC TAXONOMIES  (moods / vibes / prompts)
  ════════════════════════════════════════════════ */
  const MOODS = [
    { label: 'Edge of My Seat',       cls: 'mood-edge'       },
    { label: 'Feel Good',             cls: 'mood-feelgood'   },
    { label: 'Want to Cry',           cls: 'mood-cry'        },
    { label: 'Date Night',            cls: 'mood-date'       },
    { label: 'Mind-Bending',          cls: 'mood-mind'       },
    { label: 'Family Night',          cls: 'mood-family'     },
    { label: 'Late Night',            cls: 'mood-night'      },
    { label: 'Laugh Out Loud',        cls: 'mood-laugh'      },
    { label: 'Adrenaline Rush',       cls: 'mood-adrenaline' },
    { label: 'Cozy Comfort',          cls: 'mood-cozy'       },
    { label: 'Dark & Gritty',         cls: 'mood-dark'       },
    { label: 'Based on a True Story', cls: 'mood-true'       },
    { label: 'Nostalgia',             cls: 'mood-nostalgia'  },
    { label: 'Scare Me',              cls: 'mood-scare'      },
    { label: 'Hopeless Romantic',     cls: 'mood-romantic'   },
    { label: 'Thought-Provoking',     cls: 'mood-think'      },
  ];

  // Upload vibe picker (emoji + label). Mirrors MOODS labels 1:1.
  const VIBES = [
    ['🍿', 'Edge of My Seat'], ['☀️', 'Feel Good'], ['😭', 'Want to Cry'], ['❤️', 'Date Night'],
    ['🤯', 'Mind-Bending'], ['👨‍👩‍👧', 'Family Night'], ['🌙', 'Late Night'], ['😂', 'Laugh Out Loud'],
    ['🔥', 'Adrenaline Rush'], ['🛋️', 'Cozy Comfort'], ['🌑', 'Dark & Gritty'], ['📖', 'Based on a True Story'],
    ['🕰️', 'Nostalgia'], ['😱', 'Scare Me'], ['💘', 'Hopeless Romantic'], ['🧠', 'Thought-Provoking'],
  ];

  // Genres — the structured "what kind of show" signal, picked by the curator at
  // upload (distinct from MOODS/vibes, which are "how it feels").
  const GENRES = [
    'Action', 'Thriller', 'Crime', 'Drama', 'Comedy', 'Romance', 'Sci-Fi', 'Horror',
    'Mystery', 'Fantasy', 'Adventure', 'Documentary', 'Family', 'Anime', 'Historical', 'Reality',
  ];

  const PITCH_PROMPTS = [
    'The scene that wrecked me was…',
    'I went in expecting nothing and…',
    'You will not be able to stop after episode…',
    'This is the one I force everyone to watch because…',
  ];

  /* ════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════ */
  function _plat(name) { return PLATFORMS[name] || { color: '#EA3B32', abbr: name.charAt(0), rgb: '234,59,50' }; }

  function _creatorObj(username) {
    const c = CURATORS[username] || {};
    return { name: username, letter: c.letter, bg: c.bg };
  }

  // Watchlist's 3-stop poster: first three colours of the feed gradient,
  // re-stopped at 0% / 35% / 100% with no inner spaces.
  function _watchlistGradient(fullGradient) {
    const hex = fullGradient.match(/#[0-9a-fA-F]{3,6}/g) || [];
    return `linear-gradient(160deg,${hex[0]} 0%,${hex[1]} 35%,${hex[2]} 100%)`;
  }

  /* ════════════════════════════════════════════════
     PROJECTIONS — rebuild each page's exact array shape
  ════════════════════════════════════════════════ */

  // FEED → SHOWS
  function feedShows() {
    return CLIPS.map(c => {
      const p = _plat(c.platform);
      return {
        id: c.id, title: c.title,
        year: c.year, genre: c.genre.slice(), lang: c.lang,
        runtime: c.runtime, season: c.season,
        synopsis: c.synopsis,
        caption: c.feedCaption,
        creator: _creatorObj(c.curator),
        litCount: c.fires,
        platforms: c.availability.map(a => {
          const ap = _plat(a.platform);
          return {
            name: a.platform, color: ap.color, label: ap.abbr,
            sub: a.included ? 'Included in your plan' : 'Not in your plan',
            included: a.included,
          };
        }),
        platLabel: c.platform, platColor: p.color, platRgb: p.rgb,
        bg: c.gradient,
      };
    });
  }

  // DISCOVER → CLIPS
  function discoverClips() {
    return CLIPS.map(c => {
      const p = _plat(c.platform);
      return {
        id: c.id, caption: c.discoverCaption,
        genre: c.genre.slice(), lang: c.lang,
        platLabel: c.platform, platColor: p.color, platAbbr: p.abbr, platRgb: p.rgb,
        creator: _creatorObj(c.curator),
        fires: c.fires, bg: c.gradient, mood: c.mood.slice(),
      };
    });
  }

  // DISCOVER → CURATORS  (derived from clips, exactly like the old builder)
  function discoverCurators() {
    const map = {};
    CLIPS.forEach(c => {
      const u = c.curator;
      if (!map[u]) {
        const meta = CURATORS[u] || {};
        map[u] = {
          username: u, name: meta.name || u,
          letter: (CURATORS[u] || {}).letter, bg: (CURATORS[u] || {}).bg,
          verified: !!meta.verified, bio: meta.bio || 'Curator on ShowShak',
          isCurator: true, clipCount: 0, totalFires: 0,
        };
      }
      map[u].clipCount += 1;
      map[u].totalFires += c.fires;
    });
    return Object.values(map);
  }

  // DISCOVER → PLATFORMS (filter chips)
  function discoverPlatforms() {
    return PLATFORM_FILTER_ORDER.map(name => {
      const p = _plat(name);
      return { name: name, color: p.color, abbr: p.abbr, rgb: p.rgb };
    });
  }

  // WATCHLIST → ALL_CLIPS
  function watchlistClips() {
    return CLIPS.map(c => {
      const p = _plat(c.platform);
      const cur = CURATORS[c.curator] || {};
      return {
        id: c.id, creator: c.curator, creatorLetter: cur.letter, creatorBg: cur.bg,
        genre: c.genre.slice(), lang: c.lang, fires: c.fires,
        platColor: p.color, platAbbr: p.abbr,
        bg: _watchlistGradient(c.gradient),
      };
    });
  }

  // UPLOAD → SHOW_CATALOG
  function uploadCatalog() {
    return CATALOG.map(t => {
      const p = _plat(t.platform);
      return {
        name: t.name, year: t.year, genre: t.genre.slice(),
        platLabel: t.platform, platColor: p.color, platAbbr: p.abbr, platRgb: p.rgb,
        bg: t.bg,
      };
    });
  }

  /* ════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════ */
  const SSData = {
    // raw core (read-only-ish; treat as the "database")
    platforms: PLATFORMS,
    curators: CURATORS,
    clips: CLIPS,
    catalog: CATALOG,
    moods: MOODS,
    vibes: VIBES,
    genres: GENRES,
    pitchPrompts: PITCH_PROMPTS,
    platformFilterOrder: PLATFORM_FILTER_ORDER,
    // projections (page-shaped)
    feedShows: feedShows,
    discoverClips: discoverClips,
    discoverCurators: discoverCurators,
    discoverPlatforms: discoverPlatforms,
    watchlistClips: watchlistClips,
    uploadCatalog: uploadCatalog,
  };

  global.SSData = SSData;
  if (typeof module !== 'undefined' && module.exports) module.exports = SSData;

})(typeof window !== 'undefined' ? window : globalThis);
