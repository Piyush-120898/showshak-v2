/* Verification: SSData projections must EXACTLY equal the original
   hardcoded arrays copied verbatim from each page. Run: node data/_verify.js
   This file is a dev tool, not shipped to the browser. */
const SSData = require('./showshak-data.js');

/* ── GROUND TRUTH (verbatim copies from each page) ───────────── */

// FEED — showshak-feed.html  (const SHOWS)
const SHOWS = [
  { id:1, title:'SACRED GAMES', year:2018, genre:['Crime','Thriller'], lang:'Hindi', runtime:'55 min/ep', season:'S1 · 8 Episodes', synopsis:'A link in their pasts leads Mumbai crime boss Ganesh Gaitonde to police officer Sartaj Singh.', caption:'This is how you <em>open</em> a series. Zero warning. Zero mercy.', creator:{ name:'cinephile_arj', letter:'A', bg:'#E8373E' }, litCount: 1240, platforms:[{ name:'Netflix', color:'#E50914', label:'N', sub:'Included in your plan', included:true }], platLabel:'Netflix', platColor:'#E50914', platRgb:'229,9,20', bg:'linear-gradient(160deg, #1a0505 0%, #2d0808 30%, #0d0d0d 70%, #000 100%)' },
  { id:2, title:'THE BEAR', year:2022, genre:['Drama','Comedy'], lang:'English', runtime:'34 min/ep', season:'S1–3 · Available', synopsis:'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.', caption:'The kitchen scene in episode 7 will destroy you. <em>Watch it.</em>', creator:{ name:'streamjunkie_sk', letter:'S', bg:'#FF6B35' }, litCount: 876, platforms:[{ name:'Disney+', color:'#0E3BD4', label:'D+', sub:'Included in your plan', included:true },{ name:'Hulu', color:'#1CE783', label:'H', sub:'Not in your plan', included:false }], platLabel:'Disney+', platColor:'#0E3BD4', platRgb:'14,59,212', bg:'linear-gradient(160deg, #050510 0%, #0a0a20 30%, #080808 70%, #000 100%)' },
  { id:3, title:'MIRZAPUR', year:2018, genre:['Action','Crime'], lang:'Hindi', runtime:'45–60 min/ep', season:'S1–3 · Available', synopsis:"A drug baron's son forces two brothers into the world of crime and violence in eastern UP.", caption:'No one escapes Mirzapur. Literally <em>no one.</em>', creator:{ name:'binge_with_priya', letter:'P', bg:'#9B59B6' }, litCount: 2100, platforms:[{ name:'Prime Video', color:'#00A8E0', label:'P', sub:'Included in your plan', included:true }], platLabel:'Prime Video', platColor:'#00A8E0', platRgb:'0,168,224', bg:'linear-gradient(160deg, #0a0510 0%, #150820 30%, #0a0505 70%, #000 100%)' },
  { id:4, title:'STRANGER THINGS', year:2016, genre:['Sci-Fi','Horror'], lang:'English', runtime:'51 min/ep', season:'S1–4 · Available', synopsis:'When a boy vanishes, a small town uncovers a mystery involving secret experiments and terrifying forces.', caption:'Started as nostalgia. Became <em>obsession.</em> S4 Vol 2 is cinema.', creator:{ name:'netflixnerd_rv', letter:'R', bg:'#3498DB' }, litCount: 3400, platforms:[{ name:'Netflix', color:'#E50914', label:'N', sub:'Included in your plan', included:true }], platLabel:'Netflix', platColor:'#E50914', platRgb:'229,9,20', bg:'linear-gradient(160deg, #020510 0%, #050a1a 30%, #050205 70%, #000 100%)' },
  { id:5, title:'PANCHAYAT', year:2020, genre:['Comedy','Drama'], lang:'Hindi', runtime:'28–40 min/ep', season:'S1–3 · Available', synopsis:'A city boy reluctantly joins as a government officer in a remote village.', caption:'This show will make you quit your job and move to a village. <em>Not joking.</em>', creator:{ name:'desi_binge', letter:'D', bg:'#27AE60' }, litCount: 5200, platforms:[{ name:'Prime Video', color:'#00A8E0', label:'P', sub:'Included in your plan', included:true }], platLabel:'Prime Video', platColor:'#00A8E0', platRgb:'0,168,224', bg:'linear-gradient(160deg, #021005 0%, #041a08 30%, #020802 70%, #000 100%)' },
  { id:6, title:'SQUID GAME', year:2021, genre:['Thriller','Drama'], lang:'Korean', runtime:'32–63 min/ep', season:'S1–2 · Available', synopsis:"Hundreds of cash-strapped contestants compete in deadly children's games for an enormous cash prize.", caption:'Episode 6. Front Man reveal. You will <em>not</em> be okay.', creator:{ name:'kdrama_world', letter:'K', bg:'#E74C3C' }, litCount: 7800, platforms:[{ name:'Netflix', color:'#E50914', label:'N', sub:'Included in your plan', included:true }], platLabel:'Netflix', platColor:'#E50914', platRgb:'229,9,20', bg:'linear-gradient(160deg, #100008 0%, #1a0010 30%, #080005 70%, #000 100%)' },
  { id:7, title:'SCAM 1992', year:2020, genre:['Crime','Drama'], lang:'Hindi', runtime:'40–55 min/ep', season:'S1 · 10 Episodes', synopsis:'The rise and fall of Harshad Mehta — the man who took the Indian stock market by storm.', caption:'Highest rated Indian show ever. One curator. One verdict. <em>Watch it.</em>', creator:{ name:'cinephile_arj', letter:'A', bg:'#E8373E' }, litCount: 4300, platforms:[{ name:'SonyLIV', color:'#002868', label:'S', sub:'Not in your plan', included:false }], platLabel:'SonyLIV', platColor:'#002868', platRgb:'0,40,104', bg:'linear-gradient(160deg, #080500 0%, #140c00 30%, #050300 70%, #000 100%)' },
  { id:8, title:'THE LAST OF US', year:2023, genre:['Drama','Sci-Fi'], lang:'English', runtime:'44–75 min/ep', season:'S1–2 · Available', synopsis:'Joel smuggles a teenage girl across post-apocalyptic America.', caption:'Episode 3 broke the internet. Broke <em>me</em>. Watch immediately.', creator:{ name:'hbo_stan_official', letter:'H', bg:'#5C2D91' }, litCount: 6100, platforms:[{ name:'HBO Max', color:'#5C2D91', label:'HBO', sub:'Not in your plan', included:false },{ name:'JioHotstar', color:'#FF6A00', label:'JH', sub:'Included in your plan', included:true }], platLabel:'JioHotstar', platColor:'#FF6A00', platRgb:'255,106,0', bg:'linear-gradient(160deg, #030805 0%, #050e08 30%, #020503 70%, #000 100%)' },
];

// DISCOVER — showshak-discover.html  (const CLIPS)
const CLIPS = [
  { id:1, caption:'This is how you <em>open</em> a series. Zero warning. Zero mercy.', genre:['Crime','Thriller'], lang:'Hindi', platLabel:'Netflix', platColor:'#E50914', platAbbr:'N', platRgb:'229,9,20', creator:{ name:'cinephile_arj', letter:'A', bg:'#E8373E' }, fires:1240, bg:'linear-gradient(160deg, #1a0505 0%, #2d0808 30%, #0d0d0d 70%, #000 100%)', mood:['Edge of My Seat','Late Night'] },
  { id:2, caption:'The kitchen scene in episode 7 will <em>destroy</em> you.', genre:['Drama','Comedy'], lang:'English', platLabel:'Disney+', platColor:'#0E3BD4', platAbbr:'D+', platRgb:'14,59,212', creator:{ name:'streamjunkie_sk', letter:'S', bg:'#FF6B35' }, fires:876, bg:'linear-gradient(160deg, #050510 0%, #0a0a20 30%, #080808 70%, #000 100%)', mood:['Want to Cry','Edge of My Seat'] },
  { id:3, caption:'No one escapes. Literally <em>no one.</em>', genre:['Action','Crime'], lang:'Hindi', platLabel:'Prime Video', platColor:'#00A8E0', platAbbr:'P', platRgb:'0,168,224', creator:{ name:'binge_with_priya', letter:'P', bg:'#9B59B6' }, fires:2100, bg:'linear-gradient(160deg, #0a0510 0%, #150820 30%, #0a0505 70%, #000 100%)', mood:['Edge of My Seat','Late Night'] },
  { id:4, caption:'Started as nostalgia. Became <em>obsession.</em>', genre:['Sci-Fi','Horror'], lang:'English', platLabel:'Netflix', platColor:'#E50914', platAbbr:'N', platRgb:'229,9,20', creator:{ name:'netflixnerd_rv', letter:'R', bg:'#3498DB' }, fires:3400, bg:'linear-gradient(160deg, #020510 0%, #050a1a 30%, #050205 70%, #000 100%)', mood:['Mind-Bending','Edge of My Seat'] },
  { id:5, caption:'Will make you quit your job and move to a village. <em>Not joking.</em>', genre:['Comedy','Drama'], lang:'Hindi', platLabel:'Prime Video', platColor:'#00A8E0', platAbbr:'P', platRgb:'0,168,224', creator:{ name:'desi_binge', letter:'D', bg:'#27AE60' }, fires:5200, bg:'linear-gradient(160deg, #021005 0%, #041a08 30%, #020802 70%, #000 100%)', mood:['Feel Good','Family Night'] },
  { id:6, caption:'Episode 6. Front Man reveal. You will <em>not</em> be okay.', genre:['Thriller','Drama'], lang:'Korean', platLabel:'Netflix', platColor:'#E50914', platAbbr:'N', platRgb:'229,9,20', creator:{ name:'kdrama_world', letter:'K', bg:'#E74C3C' }, fires:7800, bg:'linear-gradient(160deg, #100008 0%, #1a0010 30%, #080005 70%, #000 100%)', mood:['Edge of My Seat','Want to Cry'] },
  { id:7, caption:'Highest rated Indian show ever. One curator. One verdict. <em>Watch it.</em>', genre:['Crime','Drama'], lang:'Hindi', platLabel:'SonyLIV', platColor:'#002868', platAbbr:'S', platRgb:'0,40,104', creator:{ name:'cinephile_arj', letter:'A', bg:'#E8373E' }, fires:4300, bg:'linear-gradient(160deg, #080500 0%, #140c00 30%, #050300 70%, #000 100%)', mood:['Mind-Bending','Late Night'] },
  { id:8, caption:'Episode 3 broke the internet. Broke <em>me</em>. Watch immediately.', genre:['Drama','Sci-Fi'], lang:'English', platLabel:'JioHotstar', platColor:'#FF6A00', platAbbr:'JH', platRgb:'255,106,0', creator:{ name:'hbo_stan_official', letter:'H', bg:'#5C2D91' }, fires:6100, bg:'linear-gradient(160deg, #030805 0%, #050e08 30%, #020503 70%, #000 100%)', mood:['Want to Cry','Edge of My Seat'] },
];

// DISCOVER — derived CURATORS (verbatim builder)
const CURATOR_META = {
  cinephile_arj:     { name:'Arjun Mehta',      verified:true,  bio:'World cinema & Indian streaming' },
  streamjunkie_sk:   { name:'Sahil Kapoor',     verified:true,  bio:'Prestige drama obsessive' },
  binge_with_priya:  { name:'Priya Nair',       verified:false, bio:'Crime & thriller binges' },
  netflixnerd_rv:    { name:'Rohan Verma',      verified:false, bio:'Sci-fi, horror & the weird' },
  desi_binge:        { name:'Desi Binge',       verified:true,  bio:'Feel-good desi picks' },
  kdrama_world:      { name:'Kim Da-eun',       verified:true,  bio:'Your K-drama plug' },
  hbo_stan_official: { name:'HBO Stan',         verified:true,  bio:'Prestige TV, no compromises' },
};
const CURATORS = (() => {
  const map = {};
  CLIPS.forEach(c => {
    const u = c.creator.name;
    if (!map[u]) {
      const meta = CURATOR_META[u] || {};
      map[u] = { username:u, name:meta.name||u, letter:c.creator.letter, bg:c.creator.bg, verified:!!meta.verified, bio:meta.bio||'Curator on ShowShak', isCurator:true, clipCount:0, totalFires:0 };
    }
    map[u].clipCount += 1;
    map[u].totalFires += c.fires;
  });
  return Object.values(map);
})();

const DISC_PLATFORMS = [
  { name:'Netflix',     color:'#E50914', abbr:'N',   rgb:'229,9,20'   },
  { name:'Prime Video', color:'#00A8E0', abbr:'P',   rgb:'0,168,224'  },
  { name:'Disney+',     color:'#0E3BD4', abbr:'D+',  rgb:'14,59,212'  },
  { name:'JioHotstar',  color:'#FF6A00', abbr:'JH',  rgb:'255,106,0'  },
  { name:'Apple TV+',   color:'#111111', abbr:'▶',   rgb:'80,80,80'   },
  { name:'SonyLIV',     color:'#002868', abbr:'S',   rgb:'0,40,104'   },
  { name:'HBO Max',     color:'#5C2D91', abbr:'HBO', rgb:'92,45,145'  },
  { name:'Zee5',        color:'#6B1DF5', abbr:'Z5',  rgb:'107,29,245' },
];

// WATCHLIST — showshak-watchlist.html  (const ALL_CLIPS)
const ALL_CLIPS = [
  { id:1, creator:'cinephile_arj',    creatorLetter:'A', creatorBg:'#E8373E', genre:['Crime','Thriller'], lang:'Hindi',   fires:1240, platColor:'#E50914', platAbbr:'N',  bg:'linear-gradient(160deg,#1a0505 0%,#2d0808 35%,#0d0d0d 100%)' },
  { id:2, creator:'streamjunkie_sk',  creatorLetter:'S', creatorBg:'#FF6B35', genre:['Drama','Comedy'],   lang:'English', fires:876,  platColor:'#0E3BD4', platAbbr:'D+', bg:'linear-gradient(160deg,#050510 0%,#0a0a20 35%,#080808 100%)' },
  { id:3, creator:'binge_with_priya', creatorLetter:'P', creatorBg:'#9B59B6', genre:['Action','Crime'],   lang:'Hindi',   fires:2100, platColor:'#00A8E0', platAbbr:'P',  bg:'linear-gradient(160deg,#0a0510 0%,#150820 35%,#0a0505 100%)' },
  { id:4, creator:'netflixnerd_rv',   creatorLetter:'R', creatorBg:'#3498DB', genre:['Sci-Fi','Horror'],  lang:'English', fires:3400, platColor:'#E50914', platAbbr:'N',  bg:'linear-gradient(160deg,#020510 0%,#050a1a 35%,#050205 100%)' },
  { id:5, creator:'desi_binge',       creatorLetter:'D', creatorBg:'#27AE60', genre:['Comedy','Drama'],   lang:'Hindi',   fires:5200, platColor:'#00A8E0', platAbbr:'P',  bg:'linear-gradient(160deg,#021005 0%,#041a08 35%,#020802 100%)' },
  { id:6, creator:'kdrama_world',     creatorLetter:'K', creatorBg:'#E74C3C', genre:['Thriller','Drama'], lang:'Korean',  fires:7800, platColor:'#E50914', platAbbr:'N',  bg:'linear-gradient(160deg,#100008 0%,#1a0010 35%,#080005 100%)' },
  { id:7, creator:'cinephile_arj',    creatorLetter:'A', creatorBg:'#E8373E', genre:['Crime','Drama'],    lang:'Hindi',   fires:4300, platColor:'#002868', platAbbr:'S',  bg:'linear-gradient(160deg,#080500 0%,#140c00 35%,#050300 100%)' },
  { id:8, creator:'hbo_stan_official',creatorLetter:'H', creatorBg:'#5C2D91', genre:['Drama','Sci-Fi'],   lang:'English', fires:6100, platColor:'#FF6A00', platAbbr:'JH', bg:'linear-gradient(160deg,#030805 0%,#050e08 35%,#020503 100%)' },
];

// UPLOAD — showshak-upload.html  (const SHOW_CATALOG)
const SHOW_CATALOG = [
  { name:'Sacred Games',    year:2018, genre:['Crime','Thriller'], platLabel:'Netflix',     platColor:'#E50914', platAbbr:'N',  platRgb:'229,9,20',  bg:'linear-gradient(160deg,#1a0505,#2d0808,#0d0d0d,#000)' },
  { name:'The Bear',        year:2022, genre:['Drama','Comedy'],   platLabel:'Disney+',     platColor:'#0E3BD4', platAbbr:'D+', platRgb:'14,59,212', bg:'linear-gradient(160deg,#050510,#0a0a20,#080808,#000)' },
  { name:'Mirzapur',        year:2018, genre:['Action','Crime'],   platLabel:'Prime Video', platColor:'#00A8E0', platAbbr:'P',  platRgb:'0,168,224', bg:'linear-gradient(160deg,#0a0510,#150820,#0a0505,#000)' },
  { name:'Stranger Things', year:2016, genre:['Sci-Fi','Horror'],  platLabel:'Netflix',     platColor:'#E50914', platAbbr:'N',  platRgb:'229,9,20',  bg:'linear-gradient(160deg,#020510,#050a1a,#050205,#000)' },
  { name:'Squid Game',      year:2021, genre:['Thriller','Drama'], platLabel:'Netflix',     platColor:'#E50914', platAbbr:'N',  platRgb:'229,9,20',  bg:'linear-gradient(160deg,#100008,#1a0010,#080005,#000)' },
  { name:'Panchayat',       year:2020, genre:['Comedy','Drama'],   platLabel:'Prime Video', platColor:'#00A8E0', platAbbr:'P',  platRgb:'0,168,224', bg:'linear-gradient(160deg,#021005,#041a08,#020802,#000)' },
  { name:'Scam 1992',       year:2020, genre:['Crime','Drama'],    platLabel:'SonyLIV',     platColor:'#002868', platAbbr:'S',  platRgb:'0,40,104',  bg:'linear-gradient(160deg,#080500,#140c00,#050300,#000)' },
  { name:'Breaking Bad',    year:2008, genre:['Crime','Drama'],    platLabel:'Netflix',     platColor:'#E50914', platAbbr:'N',  platRgb:'229,9,20',  bg:'linear-gradient(160deg,#02100a,#041a10,#020805,#000)' },
  { name:'The Last of Us',  year:2023, genre:['Drama','Horror'],   platLabel:'JioHotstar',  platColor:'#FF6A00', platAbbr:'JH', platRgb:'255,106,0', bg:'linear-gradient(160deg,#0a0803,#161005,#050300,#000)' },
  { name:'Dahaad',          year:2023, genre:['Crime','Thriller'], platLabel:'Prime Video', platColor:'#00A8E0', platAbbr:'P',  platRgb:'0,168,224', bg:'linear-gradient(160deg,#10040a,#1a0610,#080205,#000)' },
];

const VIBES = [
  ['🍿','Edge of My Seat'], ['☀️','Feel Good'], ['😭','Want to Cry'], ['❤️','Date Night'],
  ['🤯','Mind-Bending'], ['👨‍👩‍👧','Family Night'], ['🌙','Late Night'], ['😂','Laugh Out Loud'],
];
const PITCH_PROMPTS = [
  'The scene that wrecked me was…',
  'I went in expecting nothing and…',
  'You will not be able to stop after episode…',
  'This is the one I force everyone to watch because…',
];
const MOODS = [
  { label:'Edge of My Seat', cls:'mood-edge'     },
  { label:'Feel Good',       cls:'mood-feelgood' },
  { label:'Want to Cry',     cls:'mood-cry'      },
  { label:'Date Night',      cls:'mood-date'     },
  { label:'Mind-Bending',    cls:'mood-mind'     },
  { label:'Family Night',    cls:'mood-family'   },
  { label:'Late Night',      cls:'mood-night'    },
  { label:'Laugh Out Loud',  cls:'mood-laugh'    },
];

/* ── COMPARE ─────────────────────────────────────────────────── */
let failures = 0;
function check(name, expected, actual) {
  const e = JSON.stringify(expected);
  const a = JSON.stringify(actual);
  if (e === a) {
    console.log(`  ✓ ${name}  (${Array.isArray(expected) ? expected.length + ' items' : 'ok'})`);
  } else {
    failures++;
    console.log(`  ✗ ${name}  — MISMATCH`);
    // find first differing index for arrays
    if (Array.isArray(expected) && Array.isArray(actual)) {
      const n = Math.max(expected.length, actual.length);
      for (let i = 0; i < n; i++) {
        const ei = JSON.stringify(expected[i]);
        const ai = JSON.stringify(actual[i]);
        if (ei !== ai) {
          console.log(`      first diff at index ${i}:`);
          console.log(`      expected: ${ei}`);
          console.log(`      actual:   ${ai}`);
          break;
        }
      }
    } else {
      console.log(`      expected: ${e}`);
      console.log(`      actual:   ${a}`);
    }
  }
}

console.log('\nShowShak data centralization — byte-exact verification\n');
check('FEED  SHOWS',            SHOWS,         SSData.feedShows());
check('DISC  CLIPS',            CLIPS,         SSData.discoverClips());
check('DISC  CURATORS',         CURATORS,      SSData.discoverCurators());
check('DISC  PLATFORMS',        DISC_PLATFORMS,SSData.discoverPlatforms());
check('WL    ALL_CLIPS',        ALL_CLIPS,     SSData.watchlistClips());
check('UP    SHOW_CATALOG',     SHOW_CATALOG,  SSData.uploadCatalog());
check('STATIC MOODS',           MOODS,         SSData.moods);
check('STATIC VIBES',           VIBES,         SSData.vibes);
check('STATIC PITCH_PROMPTS',   PITCH_PROMPTS, SSData.pitchPrompts);

console.log('');
if (failures) { console.log(`RESULT: ${failures} mismatch(es) ✗\n`); process.exit(1); }
else          { console.log('RESULT: ALL PROJECTIONS BYTE-EXACT ✓\n'); }
