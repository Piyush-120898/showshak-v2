/* Build ShowShak-Pitch-Deck-v2.pptx — grounded, beta-ready deck.
   Regenerate:  npm install pptxgenjs --no-save   then   node pitch/build-deck-v2-pptx.js
   Output: ShowShak-Pitch-Deck-v2.pptx in the repo root.
   NOTE: text in [brackets], rendered in red, are FILL-AFTER-BETA slots. Replace with real
   numbers from the Chandigarh/Tricity beta before sending. See pitch/showshak-deck-v2-copy.md. */
'use strict';
const PptxGenJS = require('pptxgenjs');
const path = require('path');

const BG='0B0B0F', CARD='14141C', BORDER='2A2A36', RED='EA3B32', WHITE='FFFFFF', GRAY='A0A0B8', GRAY2='5A5A72', FILL='F5A623';
const FONT='Arial', DISPLAY='Arial';
const LX=0.9, CW=11.53;
const ASSETS = path.join(__dirname, 'assets');
const BGIMG = path.join(ASSETS, 'deck-bg.png');
const LOGO  = path.join(ASSETS, 'logo.png');

const pptx = new PptxGenJS();
pptx.defineLayout({ name:'SS', width:13.333, height:7.5 });
pptx.layout = 'SS';
pptx.author = 'ShowShak';
pptx.title = 'ShowShak — Investor Deck v2';

function slide(){
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addImage({ path: BGIMG, x:0, y:0, w:13.333, h:7.5 });
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
    { x:0, y:3.85, w:13.333, h:0.4, fontFace:FONT, fontSize:15, bold:true, charSpacing:1.5, align:'center' });
  s.addText('The trust layer for what to watch.',
    { x:2.67, y:4.55, w:8.0, h:0.6, fontFace:FONT, fontSize:18, color:GRAY, align:'center' });
  s.addText('PRE-SEED  ·  INDIA 2026', { x:0, y:6.85, w:13.333, h:0.3, fontFace:FONT, fontSize:11, color:GRAY2, charSpacing:3, align:'center' });
})();

/* 2 — PROBLEM */
(()=>{ const s=slide(); kicker(s,'The Problem'); headline(s,'Infinite content.\nZero conviction.');
  const steps=['See a clip\non Instagram','Open a\nbrowser','Google\n“where to watch”','Open the OTT\napp & search','Lose the\nimpulse'];
  const bw=2.0, gap=0.3, y=3.25, h=1.15;
  steps.forEach((t,i)=>{ const x=LX+i*(bw+gap); const last=i===steps.length-1;
    s.addShape(pptx.ShapeType.roundRect,{x,y,w:bw,h,rectRadius:0.08,fill:{color:last?'241318':CARD},line:{color:last?RED:BORDER,width:0.75}});
    s.addText(t,{x:x+0.1,y:y+0.1,w:bw-0.2,h:h-0.2,fontFace:FONT,fontSize:12,bold:true,color:last?RED:WHITE,align:'center',valign:'middle',lineSpacingMultiple:1.05});
    if(i<steps.length-1){ s.addText('→',{x:x+bw-0.02,y,w:gap+0.04,h,fontFace:FONT,fontSize:18,color:GRAY2,align:'center',valign:'middle'}); }
  });
  s.addText([{text:'Entertainment is an impulse. ',options:{color:WHITE,bold:true}},{text:'The 6-step hunt for “where to watch” kills it — ~16 minutes lost every single session.',options:{color:GRAY}}],
    { x:LX, y:4.9, w:CW, h:0.9, fontFace:FONT, fontSize:17, align:'left', valign:'top', lineSpacingMultiple:1.2 });
  lead(s, 'So the decision falls back to the oldest instinct there is — asking someone whose taste you trust.', 5.8, 0.7);
  foot(s,'Source: LiveMint 2025 — India’s 16-minute discovery problem; Accenture OTT survey (India).'); pageNum(s,'02');
})();

/* 3 — SOLUTION */
(()=>{ const s=slide(); kicker(s,'The Solution'); headline(s,'The person you trust,\nat the scale of a feed.');
  lead(s, [{text:'A curator clips a show. You feel it. You trust them. You tap ',options:{color:GRAY}},{text:'Watch It',options:{color:RED,bold:true}},{text:' — and land on the right platform in one move.',options:{color:GRAY}}], 3.0, 0.9);
  const b=[ ['Creator first.',' You bond with a curator’s taste before the title — so trust leads the decision.'],
            ['One tap.',' Every clip builds to a single action at the emotional peak — the app opens on the right platform.'],
            ['The bridge.',' We carry people to Netflix, Prime, JioHotstar — the trusted top of the funnel for all of them.'] ];
  b.forEach((r,i)=>{ const y=4.15+i*0.78;
    s.addShape(pptx.ShapeType.ellipse,{x:LX,y:y+0.12,w:0.12,h:0.12,fill:{color:RED}});
    s.addText([{text:r[0],options:{color:WHITE,bold:true}},{text:r[1],options:{color:GRAY}}],{x:LX+0.32,y,w:CW-0.4,h:0.7,fontFace:FONT,fontSize:15,align:'left',valign:'top',lineSpacingMultiple:1.1});
  });
  pageNum(s,'03');
})();

/* 4 — PRODUCT · LIVE TODAY */
(()=>{ const s=slide(); kicker(s,'Product · Live Today'); headline(s,'Not a mockup.\nA working product.');
  const c=[ ['Title-hidden clips','The show reveals only at Watch It — you bond with the curator’s taste, not the poster.'],
            ['Watch It','One tap to the right platform in your region — works with zero platform deals.'],
            ['Stacks','Private, shared, and 6-person collaborative watchlists.'],
            ['Real video','A real short-form video pipeline, live in the product today — not embeds.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*2.93, 2.6, 2.73, 2.15, { title:cc[0], body:cc[1] }); });
  lead(s, [{text:'A live web app — real video, deep-links to any platform with zero partnerships, ',options:{color:GRAY}},{text:'and built to scale.',options:{color:WHITE,bold:true}}], 5.05, 0.7);
  s.addText([{text:'Live in open beta — ',options:{color:GRAY,italic:true}},{text:'[N curators · N clips]',options:{color:FILL,bold:true}}], { x:LX, y:5.75, w:CW, h:0.4, fontFace:FONT, fontSize:14, align:'left' });
  pageNum(s,'04');
})();

/* 5 — COLLABORATIVE STACKS */
(()=>{ const s=slide(); kicker(s,'The Habit'); headline(s,'Watching isn’t solo.\nIt’s a group chat.');
  const c=[ ['6 friends, one watchlist','Real-time, attributed. A shared stack up to six people co-build — the plan for what to watch together, in one place.'],
            ['Private → Shared → Collaborative','Save it for yourself, show your taste, or build it with your squad. Enforced at the database, not the UI.'],
            ['Growth built in','Every collaborative stack pulls in up to 5 more people — the loop is the feature.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*3.87, 2.7, 3.62, 2.5, { title:cc[0], body:cc[1] }); });
  lead(s, [{text:'The answer to the one question this category lives or dies on: ',options:{color:GRAY}},{text:'is it a habit, or a utility?',options:{color:WHITE,bold:true}}], 5.55, 0.8);
  pageNum(s,'05');
})();

/* 6 — TRACTION · BETA SIGNAL */
(()=>{ const s=slide(); kicker(s,'Traction · Beta Signal'); headline(s,'Small, honest, and\nmoving.');
  const c=[ ['[N]','Curators posting weekly'],
            ['[N] · +[X]%','Returning users, week-over-week'],
            ['[N] · [X]%','Watch-It taps · tap-through'],
            ['[X]%','Return within 48h of a curator they follow posting'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*2.93, 2.7, 2.73, 2.1, { big:cc[0], bigColor:FILL, body:cc[1] }); });
  lead(s, [{text:'The 48-hour return is the number that proves habit',options:{color:WHITE,bold:true}},{text:' — it’s what separates us from every “what-to-watch” app that died a utility.',options:{color:GRAY}}], 5.15, 0.8);
  foot(s,'Fill all [bracketed] values from the Chandigarh / Tricity college beta. Show the growth rate when absolute numbers are small.'); pageNum(s,'06');
})();

/* 7 — WHY NOW */
(()=>{ const s=slide(); kicker(s,'Why Now'); headline(s,'JioHotstar is solving this\nwith AI. We use humans.');
  s.addText([{text:'The #1 streamer + OpenAI shipped ChatGPT discovery to fix “what to watch” — a machine guess. ',options:{color:GRAY}},{text:'We bring the one thing a machine can’t: a person you trust.',options:{color:WHITE,bold:true}}],
    { x:LX, y:3.15, w:CW, h:1.2, fontFace:FONT, fontSize:18, align:'left', valign:'top', lineSpacingMultiple:1.2 });
  const chips=[ ['148M','fragmented paid subs across 15+ platforms'],
               ['67%','of 18–34s trust creators over search'],
               ['~50%','of the world’s 2026 subscription-app install growth was India'] ];
  chips.forEach((c,i)=>{ const x=LX+i*3.95;
    s.addText(c[0],{x,y:4.75,w:3.7,h:0.65,fontFace:DISPLAY,fontSize:34,bold:true,color:RED,align:'left'});
    s.addText(c[1],{x,y:5.45,w:3.7,h:0.85,fontFace:FONT,fontSize:12.5,color:GRAY,align:'left',valign:'top',lineSpacingMultiple:1.1});
  });
  foot(s,'Sources: Ormax 2025; Nielsen 2026; Variety / Financial Express 2026; AppsFlyer State of Subscriptions 2026.'); pageNum(s,'07');
})();

/* 8 — CATEGORY & MOAT */
(()=>{ const s=slide(); kicker(s,'Category & Moat'); headline(s,'The trust network\nfor what to watch.');
  const px=LX, py=2.55, pw=7.4, ph=3.7;
  s.addShape(pptx.ShapeType.roundRect,{x:px,y:py,w:pw,h:ph,rectRadius:0.1,fill:{color:CARD},line:{color:BORDER,width:0.75}});
  s.addText('Cross-platform neutrality →',{x:px,y:py+ph-0.32,w:pw,h:0.3,fontFace:FONT,fontSize:9,color:GRAY2,align:'center',charSpacing:2});
  s.addText('Human taste & trust →',{x:px-2.2,y:py+ph/2-0.15,w:4.4,h:0.3,fontFace:FONT,fontSize:9,color:GRAY2,align:'center',charSpacing:2,rotate:270});
  const dots=[ [0.26,0.76,'Netflix · Prime\n(walled gardens)',false],[0.72,0.72,'JustWatch · Reelgood\n(where-to-watch data)',false],
               [0.34,0.52,'OTTplay · aggregators\n(bundles + search)',false],[0.44,0.33,'TikTok · Reels\n(taste, no intent)',false],
               [0.80,0.19,'ShowShak',true] ];
  dots.forEach(d=>{ const cx=px+d[0]*pw, cy=py+d[1]*ph; const sz=d[3]?0.22:0.13;
    s.addShape(pptx.ShapeType.ellipse,{x:cx-sz/2,y:cy-sz/2,w:sz,h:sz,fill:{color:d[3]?RED:GRAY2}});
    s.addText(d[2],{x:cx-0.95,y:cy+0.14,w:1.9,h:0.5,fontFace:FONT,fontSize:9.5,bold:d[3],color:d[3]?WHITE:GRAY,align:'center',lineSpacingMultiple:1.0});
  });
  s.addText([{text:'JustWatch proved the money. Letterboxd proved the culture. We sit where they meet — taste plus action, across every platform.\n\n',options:{color:GRAY}},{text:'A streamer that promotes rivals stops being itself — so neutrality stays ours.',options:{color:WHITE,bold:true}}],
    {x:8.6,y:2.7,w:3.8,h:3.4,fontFace:FONT,fontSize:14,valign:'top',lineSpacingMultiple:1.2});
  foot(s,'JustWatch: 60M+ users/mo, profitable since 2016. Letterboxd: ~29M users, 2026 (TIME / Tiny). We start with zero permission — Watch It runs on public availability data.'); pageNum(s,'08');
})();

/* 9 — MARKET */
(()=>{ const s=slide(); kicker(s,'Market'); headline(s,'The budget behind\nevery “Watch It.”');
  const rows=[ ['India promotion economy  ·  ~₹6,000–10,000 cr/yr','streaming marketing + subscriber acquisition + film P&A (~$0.7–1.2B)',5.6,0.10],
               ['Our wedge  ·  the trust-discovery slice','of what platforms already spend to acquire subscribers',3.6,0.24] ];
  rows.forEach((r,i)=>{ const y=3.1+i*1.15; const x=LX+(5.8-r[2])/2;
    s.addShape(pptx.ShapeType.roundRect,{x,y,w:r[2],h:0.85,rectRadius:0.08,fill:{color:RED,transparency:Math.round((1-r[3])*100)},line:{color:RED,width:0.75}});
    s.addText(r[0],{x,y:y+0.14,w:r[2],h:0.35,fontFace:DISPLAY,fontSize:14,bold:true,color:WHITE,align:'center'});
    s.addText(r[1],{x:x-0.5,y:y+0.5,w:r[2]+1.0,h:0.3,fontFace:FONT,fontSize:9.5,color:GRAY,align:'center'});
  });
  s.addText('We don’t take a cut of subscriptions. We take a slice of what platforms already spend to make people watch — one tentpole now spends $100M+ on marketing alone.',{x:7.1,y:3.1,w:5.3,h:1.6,fontFace:FONT,fontSize:15,color:GRAY,valign:'top',lineSpacingMultiple:1.15});
  s.addText([{text:'Same buckets, worldwide → ~$50B+/yr.',options:{color:WHITE,bold:true}},{text:' India is the beachhead; the playground is global.',options:{color:GRAY}}],{x:7.1,y:4.9,w:5.3,h:1.2,fontFace:FONT,fontSize:14,valign:'top',lineSpacingMultiple:1.15});
  foot(s,'Bottom-up, triangulated: FICCI-EY 2026, WPP Media 2026, studio marketing disclosures. Ranges, not point estimates.'); pageNum(s,'09');
})();

/* 10 — BUSINESS MODEL */
(()=>{ const s=slide(); kicker(s,'Business Model'); headline(s,'We sell intent —\nat the moment of taste.');
  const r=[ ['1','Promoted clips · native title marketing','Studios fund curators to clip new titles. Looks organic, recurring with every release.','CORE'],
            ['2','Performance acquisition for streamers','Pre-sold subscribers at peak desire — warmer and cheaper than a streamer’s own cold ads.','THEN'],
            ['3','Cross-platform taste intelligence','Each platform’s mirror of the open market. High-margin, compounding, ours alone.','THEN'],
            ['4','Premium + curator monetization','Power-user tools and creator revenue — diversified, recurring, first-party.','LATER'] ];
  r.forEach((rr,i)=>{ const y=2.55+i*0.88;
    s.addShape(pptx.ShapeType.roundRect,{x:LX,y,w:CW,h:0.74,rectRadius:0.08,fill:{color:i===0?'1E1420':CARD},line:{color:i===0?RED:BORDER,width:i===0?1:0.75}});
    s.addText(rr[0],{x:LX+0.2,y:y+0.08,w:0.5,h:0.55,fontFace:DISPLAY,fontSize:24,bold:true,color:RED,align:'left',valign:'middle'});
    s.addText(rr[1],{x:LX+0.85,y:y+0.09,w:7.6,h:0.32,fontFace:FONT,fontSize:14,bold:true,color:WHITE,align:'left'});
    s.addText(rr[2],{x:LX+0.85,y:y+0.4,w:8.6,h:0.32,fontFace:FONT,fontSize:10.5,color:GRAY,align:'left'});
    s.addText(rr[3],{x:LX+CW-1.7,y:y+0.23,w:1.5,h:0.3,fontFace:FONT,fontSize:9,bold:i===0,color:i===0?RED:GRAY2,align:'right',charSpacing:2});
  });
  foot(s,'Every revenue line is gated behind scale and data — nothing monetizes off a prototype. This raise buys the data. Healthy LTV:CAC ≥ 3:1.'); pageNum(s,'10');
})();

/* 11 — TEAM */
(()=>{ const s=slide(); kicker(s,'Team'); headline(s,'Built by the buyer.');
  card(s, LX, 2.7, 5.65, 2.4, { title:'Piyush Gupta — Founder', body:'B.Tech (IT) and a performance marketer — managed ₹1 cr+ in Google Ads spend driving leads and sales. Built this entire live, tested product solo.' });
  card(s, LX+5.85, 2.7, 5.65, 2.4, { title:'Bringing on', body:'Streaming-industry partnerships to turn Watch-It proof into platform revenue, and senior engineering for multi-region scale.' });
  s.addText([{text:'Delivered ',options:{color:GRAY}},{text:'[X]× ROAS',options:{color:FILL,bold:true}},{text:' on ₹1 cr+ of ad spend — the exact conversion I’ll sell to the OTTs.',options:{color:GRAY}}], { x:LX, y:5.25, w:CW, h:0.4, fontFace:FONT, fontSize:14, bold:true, align:'left' });
  lead(s, [{text:'ShowShak’s customer is a performance marketer buying attention. ',options:{color:GRAY}},{text:'I’ve been that buyer — I know exactly what converts and what they’ll pay for.',options:{color:WHITE,bold:true}}], 5.75, 0.9);
  pageNum(s,'11');
})();

/* 12 — THE ASK */
(()=>{ const s=slide(); kicker(s,'The Ask');
  s.addText([{text:'Raising ',options:{color:WHITE}},{text:'₹1 crore',options:{color:RED}},{text:' pre-seed\nto prove the loop.',options:{color:WHITE}}],
    { x:LX, y:1.15, w:CW, h:1.5, fontFace:DISPLAY, fontSize:36, bold:true, align:'left', lineSpacingMultiple:1.0 });
  lead(s, [{text:'The milestone: ',options:{color:GRAY}},{text:'[N] curators posting weekly and [N] viewers returning because they trust them',options:{color:FILL,bold:true}},{text:' — and the ',options:{color:GRAY}},{text:'Watch-It conversion data',options:{color:WHITE,bold:true}},{text:' that opens our first deal conversations with the OTT platforms.',options:{color:GRAY}}], 3.0, 1.3);
  const c=[ ['Founding curators','Seed and support the founding curator cohort — the supply that makes an audience return.'],
            ['Team','Partnerships + senior engineering — turn the beta into a measurable, fundable loop.'],
            ['Runway to proof','Get to the Watch-It conversion data that unlocks the seed round.'] ];
  c.forEach((cc,i)=>{ card(s, LX+i*3.95, 4.55, 3.7, 1.75, { title:cc[0], body:cc[1] }); });
  s.addText('Start hyperlocal — Chandigarh + Tricity colleges, word-of-mouth first — then the organic rail becomes the paid rail.',{x:LX,y:6.45,w:CW,h:0.4,fontFace:FONT,fontSize:11,color:GRAY2,align:'left',italic:true});
  pageNum(s,'12');
})();

/* 13 — CLOSE */
(()=>{ const s=slide();
  s.addImage({ path:LOGO, x:6.116, y:1.45, w:1.1, h:1.1 });
  s.addText([{text:'SHOW',options:{color:WHITE}},{text:'SHAK',options:{color:RED}}],
    { x:0, y:2.85, w:13.333, h:1.2, fontFace:DISPLAY, fontSize:54, bold:true, align:'center', charSpacing:2 });
  s.addText('The trusted bridge to everything you watch.',{ x:2.67, y:4.3, w:8.0, h:0.8, fontFace:FONT, fontSize:22, color:WHITE, align:'center' });
  s.addText([{text:'[live app link]',options:{color:FILL}},{text:'   ·   hello@showshak.com',options:{color:GRAY2}}],{ x:0, y:6.85, w:13.333, h:0.3, fontFace:FONT, fontSize:12, charSpacing:1, align:'center' });
})();

const out = path.join(__dirname, '..', 'ShowShak-Pitch-Deck-v2.pptx');
pptx.writeFile({ fileName: out }).then(f=>console.log('PPTX written:', f)).catch(e=>{console.error(e);process.exit(1);});
