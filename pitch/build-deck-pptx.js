/* Build ShowShak-Pitch-Deck.pptx from the deck content (native, editable PowerPoint).
   Regenerate:  npm install pptxgenjs --no-save   then   node pitch/build-deck-pptx.js
   Output: ShowShak-Pitch-Deck.pptx in the repo root. */
'use strict';
const PptxGenJS = require('pptxgenjs');
const path = require('path');

const BG='0B0B0F', CARD='14141C', BORDER='2A2A36', RED='EA3B32', WHITE='FFFFFF', GRAY='A0A0B8', GRAY2='5A5A72';
const FONT='Arial', DISPLAY='Arial';
const LX=0.9, CW=11.53;            // left margin, content width (13.33 wide)
const ASSETS = path.join(__dirname, 'assets');
const BGIMG = path.join(ASSETS, 'deck-bg.png');   // dark + red radial-glow background
const LOGO  = path.join(ASSETS, 'logo.png');      // rounded ShowShak mark (transparent)

const pptx = new PptxGenJS();
pptx.defineLayout({ name:'SS', width:13.333, height:7.5 });
pptx.layout = 'SS';
pptx.author = 'ShowShak';
pptx.title = 'ShowShak — Investor Deck';

function slide(){
  const s = pptx.addSlide();
  s.background = { color: BG };                              // solid dark fallback — no white flash, ever
  s.addImage({ path: BGIMG, x:0, y:0, w:13.333, h:7.5 });   // full-bleed gradient as a real image shape (renders in every viewer), behind all content
  return s;
}
function kicker(s, t){ s.addText(t.toUpperCase(), { x:LX, y:0.62, w:CW, h:0.3, fontFace:FONT, fontSize:11, bold:true, color:RED, charSpacing:3, align:'left' }); }
function headline(s, t, y){ s.addText(t, { x:LX, y:y||1.05, w:CW, h:1.5, fontFace:DISPLAY, fontSize:38, bold:true, color:WHITE, align:'left', lineSpacingMultiple:0.95 }); }
function lead(s, runs, y, h){ s.addText(runs, { x:LX, y, w:CW, h:h||1.1, fontFace:FONT, fontSize:16, color:GRAY, align:'left', valign:'top', lineSpacingMultiple:1.15 }); }
function foot(s, t){ s.addText(t, { x:LX, y:6.95, w:CW, h:0.4, fontFace:FONT, fontSize:8.5, color:GRAY2, align:'left' }); }
function pageNum(s, n){ s.addText(n, { x:12.4, y:6.95, w:0.6, h:0.3, fontFace:FONT, fontSize:9, color:GRAY2, align:'right' }); }
function card(s, x, y, w, h, o){
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius:0.1, fill:{ color:CARD }, line:{ color:BORDER, width:0.75 } });
  let ty = y+0.22;
  if(o.big){ s.addText(o.big, { x:x+0.26, y:ty, w:w-0.5, h:0.7, fontFace:DISPLAY, fontSize:30, bold:true, color:o.bigColor||RED, align:'left' }); ty+=0.82; }
  if(o.title){ s.addText(o.title, { x:x+0.26, y:ty, w:w-0.5, h:0.4, fontFace:FONT, fontSize:15, bold:true, color:WHITE, align:'left' }); ty+=0.46; }
  if(o.body){ s.addText(o.body, { x:x+0.26, y:ty, w:w-0.5, h:h-(ty-y)-0.18, fontFace:FONT, fontSize:11.5, color:GRAY, align:'left', valign:'top', lineSpacingMultiple:1.08 }); }
}

/* 1 — COVER */
(()=>{ const s=slide();
  s.addImage({ path:LOGO, x:6.066, y:0.95, w:1.2, h:1.2 });
  s.addText([{text:'SHOW',options:{color:WHITE}},{text:'SHAK',options:{color:RED}}],
    { x:0, y:2.45, w:13.333, h:1.3, fontFace:DISPLAY, fontSize:60, bold:true, align:'center', charSpacing:2 });
  s.addText([{text:'DISCOVER  ·  ',options:{color:GRAY}},{text:'TRUST',options:{color:RED}},{text:'  ·  WATCH IT',options:{color:GRAY}}],
    { x:0, y:3.85, w:13.333, h:0.4, fontFace:FONT, fontSize:15, bold:true, charSpacing:4, align:'center' });
  s.addText('The trust layer for what to watch — curators clip what\u2019s worth your time, you tap Watch It, you land on the right platform.',
    { x:2.67, y:4.5, w:8.0, h:1.0, fontFace:FONT, fontSize:15, color:GRAY, align:'center', lineSpacingMultiple:1.2 });
  s.addText('PRE-SEED  ·  INDIA 2026', { x:0, y:6.85, w:13.333, h:0.3, fontFace:FONT, fontSize:11, color:GRAY2, charSpacing:3, align:'center' });
})();

/* 2 — PROBLEM */
(()=>{ const s=slide(); kicker(s,'The Problem'); headline(s,'Infinite content.\nZero conviction.');
  const cols=[ ['16 min','an Indian viewer burns browsing, not watching \u2014 every single session'],
               ['69%','of Indian OTT subscribers are frustrated just trying to find something to watch'],
               ['148M','paying subscriptions split across 15+ platforms & 13+ languages \u2014 the fragmentation behind the paralysis'] ];
  cols.forEach((c,i)=>{ const x=LX+i*3.95;
    s.addText(c[0], { x, y:3.0, w:3.7, h:0.8, fontFace:DISPLAY, fontSize:42, bold:true, color:WHITE, align:'left' });
    s.addText(c[1], { x, y:3.85, w:3.7, h:1.1, fontFace:FONT, fontSize:12.5, color:GRAY, align:'left', valign:'top', lineSpacingMultiple:1.1 });
  });
  lead(s, 'Algorithms guess. Search needs a title you don\u2019t have. So the decision falls back to the oldest instinct there is \u2014 asking someone whose taste you trust.', 5.25);
  foot(s,'Sources: LiveMint 2025 (India\u2019s 16-minute discovery problem); Accenture OTT survey (India); FICCI-EY & Ormax 2026.'); pageNum(s,'02');
})();

/* 3 — SOLUTION */
(()=>{ const s=slide(); kicker(s,'The Solution'); headline(s,'The person you trust,\nat the scale of a feed.');
  lead(s, [{text:'A curator clips a show. You feel it. You trust them. You tap ',options:{color:GRAY}},{text:'Watch It',options:{color:RED,bold:true}},{text:' \u2014 and land on the right platform in one move.',options:{color:GRAY}}], 3.0, 0.9);
  const b=[ ['Creator first.',' You connect with a curator\u2019s taste before the title \u2014 so trust leads the decision.'],
            ['One action.',' Every clip builds to a single tap, at the emotional peak.'],
            ['The bridge.',' We carry people to Netflix, Prime, JioHotstar \u2014 the trusted top of the funnel for all of them.'] ];
  b.forEach((r,i)=>{ const y=4.15+i*0.78;
    s.addShape(pptx.ShapeType.ellipse,{x:LX,y:y+0.12,w:0.12,h:0.12,fill:{color:RED}});
    s.addText([{text:r[0],options:{color:WHITE,bold:true}},{text:r[1],options:{color:GRAY}}],{x:LX+0.32,y,w:CW-0.4,h:0.7,fontFace:FONT,fontSize:15,align:'left',valign:'top',lineSpacingMultiple:1.1});
  });
  pageNum(s,'03');
})();

/* 4 — WHY NOW */
(()=>{ const s=slide(); kicker(s,'Why Now'); headline(s,'The moment is here.');
  const c=[ ['148M','Choice broke','148M paying streaming subscriptions in India, fragmented across 15+ platforms and 13+ languages. Deciding what to watch is genuinely overwhelming.'],
            ['67%','Trust moved to people','Trust in creators hit 67% \u2014 and viewers 18\u201334 now rank creator recommendations their single most trusted source, surpassing search for the first time.'],
            ['AI race','The giant confirmed it','JioHotstar + OpenAI shipped ChatGPT discovery to fix \u201cwhat to watch.\u201d The #1 player is paying to solve our exact problem \u2014 with a machine guess, where we bring human trust.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*3.95, 2.55, 3.7, 2.95, { big:cc[0], title:cc[1], body:cc[2] }); });
  lead(s, [{text:'India drove nearly ',options:{color:GRAY}},{text:'half of the world\u2019s subscription-app install growth',options:{color:WHITE,bold:true}},{text:' in 2026. The demand is here, now.',options:{color:GRAY}}], 5.75, 0.8);
  foot(s,'Sources: Ormax 2025; Nielsen 2026; Variety / Financial Express 2026; AppsFlyer State of Subscriptions 2026 (India subcontinent = 49% of global net paid-install growth).'); pageNum(s,'04');
})();

/* 5 — MARKET */
(()=>{ const s=slide(); kicker(s,'Market'); headline(s,'The budget behind\nevery \u201cWatch It.\u201d');
  const rows=[ ['India promotion economy  ·  ~\u20B96,000\u201310,000 cr/yr','streaming marketing + subscriber acquisition + film P&A + influencer (~$0.7\u20131.2B)',5.6,0.10],
               ['Serviceable  ·  ~\u20B92,000\u20134,000 cr','the trust-discovery slice we can serve (~$240\u2013480M)',4.4,0.17],
               ['Our target  ·  \u20B9200\u2013400 cr','~10% of the serviceable market at maturity',3.1,0.26] ];
  rows.forEach((r,i)=>{ const y=3.0+i*0.95; const x=LX+(5.8-r[2])/2;
    s.addShape(pptx.ShapeType.roundRect,{x,y,w:r[2],h:0.8,rectRadius:0.08,fill:{color:RED,transparency:Math.round((1-r[3])*100)},line:{color:RED,width:0.75}});
    s.addText(r[0],{x,y:y+0.12,w:r[2],h:0.35,fontFace:DISPLAY,fontSize:14,bold:true,color:WHITE,align:'center'});
    s.addText(r[1],{x:x-0.3,y:y+0.46,w:r[2]+0.6,h:0.3,fontFace:FONT,fontSize:9.5,color:GRAY,align:'center'});
  });
  s.addText('Studios and platforms spend relentlessly to make people watch. One tentpole now spends $100M+ on marketing alone.',{x:7.1,y:3.1,w:5.3,h:1.2,fontFace:FONT,fontSize:15,color:GRAY,valign:'top',lineSpacingMultiple:1.15});
  s.addText([{text:'Same buckets, worldwide \u2192 ~$50B+/yr.',options:{color:WHITE,bold:true}},{text:' India is the beachhead; the playground is global.',options:{color:GRAY}}],{x:7.1,y:4.5,w:5.3,h:1.2,fontFace:FONT,fontSize:14,valign:'top',lineSpacingMultiple:1.15});
  foot(s,'Bottom-up, triangulated: FICCI-EY 2026, WPP Media 2026, Kofluence 2026, Netflix & studio marketing disclosures. Ranges, not point estimates.'); pageNum(s,'05');
})();

/* 6 — CATEGORY */
(()=>{ const s=slide(); kicker(s,'The Category'); headline(s,'The trust network\nfor what to watch.');
  const px=LX, py=2.55, pw=7.4, ph=3.7;
  s.addShape(pptx.ShapeType.roundRect,{x:px,y:py,w:pw,h:ph,rectRadius:0.1,fill:{color:CARD},line:{color:BORDER,width:0.75}});
  s.addText('Cross-platform neutrality \u2192',{x:px,y:py+ph-0.32,w:pw,h:0.3,fontFace:FONT,fontSize:9,color:GRAY2,align:'center',charSpacing:2});
  s.addText('Human taste & trust \u2192',{x:px-2.2,y:py+ph/2-0.15,w:4.4,h:0.3,fontFace:FONT,fontSize:9,color:GRAY2,align:'center',charSpacing:2,rotate:270});
  const dots=[ [0.26,0.76,'Netflix · Prime\n(walled gardens)',false],[0.72,0.72,'JustWatch · Reelgood\n(where-to-watch data)',false],
               [0.34,0.52,'OTTplay · aggregators\n(bundles + search)',false],[0.44,0.33,'TikTok · Reels\n(taste, no intent)',false],
               [0.80,0.19,'ShowShak',true] ];
  dots.forEach(d=>{ const cx=px+d[0]*pw, cy=py+d[1]*ph; const sz=d[3]?0.22:0.13;
    s.addShape(pptx.ShapeType.ellipse,{x:cx-sz/2,y:cy-sz/2,w:sz,h:sz,fill:{color:d[3]?RED:GRAY2}});
    s.addText(d[2],{x:cx-0.95,y:cy+0.14,w:1.9,h:0.5,fontFace:FONT,fontSize:9.5,bold:d[3],color:d[3]?WHITE:GRAY,align:'center',lineSpacingMultiple:1.0});
  });
  s.addText('JustWatch turned where-to-watch data into a profitable, studio-funded business. Letterboxd turned film taste into a 29M-strong culture. We sit where they meet \u2014 taste plus action, across every platform.',
    {x:8.6,y:2.7,w:3.8,h:3.2,fontFace:FONT,fontSize:14,color:GRAY,valign:'top',lineSpacingMultiple:1.2});
  foot(s,'JustWatch: 60M+ users/mo, profitable since 2016. Letterboxd: ~29M users, 2026 (TIME / Tiny).'); pageNum(s,'06');
})();

/* 7 — PRODUCT */
(()=>{ const s=slide(); kicker(s,'Product · Live Today'); headline(s,'Familiar to use.\nImpossible to fake.');
  const c=[ ['\uD83D\uDD25 Fire','The like, reimagined \u2014 \u201cthis is lit.\u201d A reflex, never a public scoreboard.'],
            ['The clip','The curator\u2019s pitch leads; the title reveals only at the moment of decision.'],
            ['Watch It','One tap to the right platform, in your region. Private. Instant.'],
            ['Follow & Stacks','Build a roster of curators you trust, and collect what\u2019s next.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*2.93, 2.7, 2.73, 2.35, { title:cc[0], body:cc[1] }); });
  lead(s, [{text:'Shipped and live as an installable app',options:{color:WHITE,bold:true}},{text:' \u2014 real curators, real clips, real Watch-It taps, rigorously tested. The engineering risk is already behind us.',options:{color:GRAY}}], 5.5, 0.9);
  pageNum(s,'07');
})();

/* 8 — BUSINESS MODEL */
(()=>{ const s=slide(); kicker(s,'Business Model'); headline(s,'We sell intent \u2014\nat the moment of taste.');
  const r=[ ['1','Promoted clips · native title marketing','Studios fund curators to clip new titles. Looks organic, demand-independent, recurring with every release.','CORE'],
            ['2','Performance acquisition for streamers','Pre-sold subscribers at peak desire \u2014 delivered warmer and cheaper than a streamer\u2019s own cold ads.','HEADLINE'],
            ['3','Cross-platform taste intelligence','Each platform\u2019s mirror of the open market. High-margin, compounding, and ours alone to hold.','MOAT'],
            ['4','Premium + curator monetization','Power-user tools and creator revenue \u2014 diversified, recurring, first-party.','LATER'] ];
  r.forEach((rr,i)=>{ const y=2.65+i*0.92;
    s.addShape(pptx.ShapeType.roundRect,{x:LX,y,w:CW,h:0.78,rectRadius:0.08,fill:{color:CARD},line:{color:BORDER,width:0.75}});
    s.addText(rr[0],{x:LX+0.2,y:y+0.1,w:0.5,h:0.55,fontFace:DISPLAY,fontSize:26,bold:true,color:RED,align:'left',valign:'middle'});
    s.addText(rr[1],{x:LX+0.85,y:y+0.1,w:7.0,h:0.32,fontFace:FONT,fontSize:14,bold:true,color:WHITE,align:'left'});
    s.addText(rr[2],{x:LX+0.85,y:y+0.42,w:8.4,h:0.32,fontFace:FONT,fontSize:10.5,color:GRAY,align:'left'});
    s.addText(rr[3],{x:LX+CW-1.7,y:y+0.24,w:1.5,h:0.3,fontFace:FONT,fontSize:9,color:GRAY2,align:'right',charSpacing:2});
  });
  foot(s,'Subscriber-acquisition cost runs into the tens of dollars (Netflix ~$89, US benchmark \u2014 Spyro-Soft 2026); India\u2019s is lower, but the cheaper-channel logic holds. Healthy LTV:CAC \u2265 3:1.'); pageNum(s,'08');
})();

/* 9 — MOAT */
(()=>{ const s=slide(); kicker(s,'Defensibility'); headline(s,'Built to compound.');
  const c=[ ['Neutrality is the moat','Only a layer above every platform can hold cross-platform taste. A streamer that promotes rivals stops being itself \u2014 so this stays ours.'],
            ['The taste graph deepens','Every fire, follow and Watch-It widens a dataset no single platform can see. Time makes the lead bigger.'],
            ['Trust is earned, not bought','Our wedge is a behaviour \u2014 connect with the curator, then the title. That bond compounds with every honest recommendation.'],
            ['We start with zero permission','Watch It runs on public links and open availability data. We launch, grow, and prove conversion on our own.'] ];
  c.forEach((cc,i)=>{ const x=LX+(i%2)*5.85, y=2.55+Math.floor(i/2)*2.15; card(s,x,y,5.65,1.95,{title:cc[0],body:cc[1]}); });
  pageNum(s,'09');
})();

/* 10 — GO-TO-MARKET */
(()=>{ const s=slide(); kicker(s,'Go-to-Market'); headline(s,'Win the hardest\nmarket first.');
  const b=[ ['India is the beachhead.',' The most fragmented streaming market on earth \u2014 the sharpest pain, the hungriest curators, the fastest proof.'],
            ['Seed the loop.',' Hand-pick a founding cohort, then grow to 50\u2013100 curators posting weekly \u2014 the clips that make viewers return for the people, not a feed.'],
            ['The organic rail becomes the paid rail.',' Curators clip what\u2019s trending today; that same placement becomes paid promoted marketing as conversion is proven.'],
            ['First revenue: regional platforms + film launches.',' The services and constant slate of releases that need discovery most \u2014 and spend on it daily.'] ];
  b.forEach((r,i)=>{ const y=2.9+i*0.95;
    s.addShape(pptx.ShapeType.ellipse,{x:LX,y:y+0.1,w:0.13,h:0.13,fill:{color:RED}});
    s.addText([{text:r[0],options:{color:WHITE,bold:true}},{text:r[1],options:{color:GRAY}}],{x:LX+0.34,y,w:CW-0.4,h:0.85,fontFace:FONT,fontSize:14.5,align:'left',valign:'top',lineSpacingMultiple:1.1});
  });
  pageNum(s,'10');
})();

/* 11 — TEAM */
(()=>{ const s=slide(); kicker(s,'Team'); headline(s,'Built by the buyer.');
  card(s, LX, 2.7, 5.65, 2.4, { title:'Piyush Gupta \u2014 Founder', body:'B.Tech (IT) and a performance marketer \u2014 managed \u20B91 cr+ in Google Ads spend driving leads and sales for businesses, then built this entire live, rigorously tested product solo.' });
  card(s, LX+5.85, 2.7, 5.65, 2.4, { title:'Bringing on', body:'Streaming-industry partnerships to turn Watch-It proof into platform revenue, and senior engineering for multi-region scale.' });
  lead(s, [{text:'ShowShak\u2019s customer is a performance marketer buying attention. ',options:{color:GRAY}},{text:'I\u2019ve been that buyer \u2014 I know exactly what converts and what they\u2019ll pay for.',options:{color:WHITE,bold:true}}], 5.5, 0.9);
  pageNum(s,'11');
})();

/* 12 — THE ASK */
(()=>{ const s=slide(); kicker(s,'The Ask');
  s.addText([{text:'Raising ',options:{color:WHITE}},{text:'\u20B91 crore',options:{color:RED}},{text:' pre-seed\nto prove the loop.',options:{color:WHITE}}],
    { x:LX, y:1.15, w:CW, h:1.5, fontFace:DISPLAY, fontSize:36, bold:true, align:'left', lineSpacingMultiple:1.0 });
  lead(s, [{text:'It takes us to one clear milestone \u2014 ',options:{color:GRAY}},{text:'50\u2013100 curators posting weekly and 2,000\u20133,000 viewers returning because they trust them',options:{color:WHITE,bold:true}},{text:' \u2014 and the ',options:{color:GRAY}},{text:'Watch-It conversion data',options:{color:WHITE,bold:true}},{text:' that opens our first deal conversations with the OTT platforms.',options:{color:GRAY}}], 3.0, 1.3);
  const c=[ ['Curators & content','Seed and support the founding curator cohort \u2014 the supply that makes an audience return.'],
            ['Legal & entity','Counsel, operating entity, safe-harbour hardening \u2014 the clearance to go fully public.'],
            ['Team','Partnerships + senior engineering \u2014 turn the beta into a measurable, fundable loop.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*3.95, 4.7, 3.7, 1.85, { title:cc[0], body:cc[1] }); });
  pageNum(s,'12');
})();

/* 13 — CLOSE */
(()=>{ const s=slide();
  s.addImage({ path:LOGO, x:6.116, y:1.45, w:1.1, h:1.1 });
  s.addText([{text:'SHOW',options:{color:WHITE}},{text:'SHAK',options:{color:RED}}],
    { x:0, y:2.85, w:13.333, h:1.2, fontFace:DISPLAY, fontSize:54, bold:true, align:'center', charSpacing:2 });
  s.addText('The trusted bridge to everything you watch.',{ x:2.67, y:4.3, w:8.0, h:0.8, fontFace:FONT, fontSize:22, color:WHITE, align:'center' });
  s.addText('hello@showshak.com',{ x:0, y:6.85, w:13.333, h:0.3, fontFace:FONT, fontSize:12, color:GRAY2, charSpacing:2, align:'center' });
})();

const out = path.join(__dirname, '..', 'ShowShak-Pitch-Deck.pptx');
pptx.writeFile({ fileName: out }).then(f=>console.log('PPTX written:', f)).catch(e=>{console.error(e);process.exit(1);});
