// node test/anleitung-bilder.js – Bildschirmfotos mit Markierungen für die Anleitung für Lehrkräfte
// Server: python3 -m http.server 8765 -d app
const {chromium}=require('playwright');const fs=require('fs');
const OUT=__dirname+'/../app/anleitung/';
const fragen=JSON.parse(fs.readFileSync(__dirname+'/../app/fragen.json','utf8')).filter(f=>f.status==='geprueft');
let mock=fs.readFileSync(__dirname+'/mock-supabase.js','utf8');
mock=mock.replace("map(p => ({ id: p.id, spitzname: p.spitzname, bearbeitet: 12, sicher: 4, quote: 71 }))","map((p,i) => ({ id: p.id, spitzname: p.spitzname, bearbeitet: [148,96,212,57,130][i%5], sicher: [61,30,118,12,49][i%5], quote: [74,63,82,51,69][i%5] }))");
const SCH=['Anna Becker','Jonas Klein','Lea Schmitz','Tim Wagner','Sara Yilmaz','Mia Hoffmann'];
(async()=>{const b=await chromium.launch();
const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:1200,height:900},deviceScaleFactor:2});
const p=await ctx.newPage();p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.route('https://lernen.rcc-online.com/**',r=>{const u=new URL(r.request().url());
  if(u.pathname.endsWith('vendor-supabase.js'))return r.fulfill({body:mock,contentType:'application/javascript'});
  return r.fetch({url:'http://localhost:8765'+u.pathname+u.search}).then(res=>r.fulfill({response:res}));});
await p.addInitScript(([fr,SCH])=>{ if(localStorage.getItem('mock_db'))return;
  const t=fr.slice(0,10);
  const erg=SCH.slice(0,5).map((n,i)=>({id:'e'+i,test_id:'t1',user_id:'s'+i,richtig:[8,6,9,5,7][i],gesamt:10,abgegeben_at:'2026-10-30T08:1'+i+':00',antworten:Object.fromEntries(t.map((q,j)=>[q.id,(j+i)%4===0&&j<6?'X':q.loesung]))}));
  const db={profile:[{id:'u-l',rolle:'lehrer',spitzname:'Valentin Focke',klasse_id:null},...SCH.map((n,i)=>({id:'s'+i,rolle:'schueler',spitzname:n,klasse_id:'k1'}))],
    klassen:[{id:'k1',code:'ZDS-ZPJTD',name:'ZDS Fachschule 2026',lehrer_id:'u-l',aktiv:true,created_at:'2026-10-29'}],
    fragen:fr.map(f=>({...f,aktiv:true})),lernstand:[],
    tests:[{id:'t1',code:'ABC123',klasse_id:'k1',titel:'Kurztest Gelatine und Pektin',frage_ids:t.map(x=>x.id),zeit_min:10,aktiv:true,created_at:'2026-10-30'}],
    test_ergebnisse:erg,simulationen:[],
    users:[{id:'u-l',email:'v.focke@zds-solingen.de',password:'xxxxxxxx'},...SCH.map((n,i)=>({id:'s'+i,email:'s'+i+'@x',password:'x'}))]};
  localStorage.setItem('mock_db',JSON.stringify(db)); localStorage.setItem('logintab','"lehrer"');},[fragen,SCH]);
const mark=async(list)=>p.evaluate(list=>{document.querySelectorAll('.mk').forEach(e=>e.remove());
  list.forEach(([sel,n,idx])=>{const els=[...document.querySelectorAll(sel)];const el=els[idx||0];if(!el){console.log('fehlt '+sel);return;}
   const r=el.getBoundingClientRect();const x=r.left+scrollX,y=r.top+scrollY;
   const o=document.createElement('div');o.className='mk';Object.assign(o.style,{position:'absolute',left:(x-5)+'px',top:(y-5)+'px',width:(r.width+10)+'px',height:(r.height+10)+'px',border:'3px solid #D9822B',borderRadius:'8px',zIndex:9998,pointerEvents:'none'});document.body.append(o);
   const h=document.createElement('div');h.className='mk';h.textContent=n;Object.assign(h.style,{position:'absolute',left:(x-20)+'px',top:(y-22)+'px',width:'30px',height:'26px',background:'#D9822B',color:'#fff',font:'700 16px "Barlow Semi Condensed",Arial',display:'grid',placeItems:'center',clipPath:'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',zIndex:9999});document.body.append(h);});},list);
const shot=async(name,clip)=>{await p.waitForTimeout(250);await p.screenshot({path:OUT+name+'.png',clip,fullPage:!!clip});};
const box=async(sel,pad=24,idx=0)=>p.evaluate(([s,pad,idx])=>{const r=document.querySelectorAll(s)[idx].getBoundingClientRect();return {x:Math.max(0,r.left+scrollX-pad),y:Math.max(0,r.top+scrollY-pad),width:Math.min(1200,r.width+2*pad),height:r.height+2*pad};},[sel,pad,idx]);
const U='https://lernen.rcc-online.com/';
// 1 Anmeldung
await p.goto(U);await p.waitForTimeout(900);
await p.fill('#mail','v.focke@zds-solingen.de');await p.fill('#pw','xxxxxxxx');
await mark([['.tabs button',1,1],['#mail',2],['#pw',2],['#lanmelden',3]]);
await shot('01-anmelden',await box('.login-wrap',16));
await p.evaluate(()=>document.querySelectorAll('.mk').forEach(e=>e.remove()));
await p.click('#lanmelden');await p.waitForTimeout(900);
// 2 Navigation
await mark([['#nav a[href="#klassen"]',1],['#nav a[href="#testbau"]',2]]);
await shot('02-navigation',{x:0,y:0,width:1200,height:150});
// 3 Klassen
await p.goto(U+'#klassen');await p.waitForTimeout(900);
await mark([['#kname',1],['#kneu',1],['[data-link]',2],['a[href^="blatt.html"]',3],['[data-k]',4]]);
await shot('03-klassen',{x:0,y:110,width:1200,height:560});
// 4 Fortschritt + PIN
await p.evaluate(()=>document.querySelectorAll('.mk').forEach(e=>e.remove()));
await p.click('[data-k]');await p.waitForTimeout(600);
await mark([['[data-pin]',1,1]]);
const k=await box('.karten .karte',12);await shot('04-fortschritt',{x:k.x,y:k.y+250,width:k.width,height:k.height-250});
await p.evaluate(()=>document.querySelectorAll('.mk').forEach(e=>e.remove()));
await p.click('[data-pin]>>nth=1');await p.waitForTimeout(150);await p.click('[data-pin]>>nth=1');await p.waitForTimeout(600);
await mark([['.neupin',2]]);
const k2=await box('.karten .karte',12);await shot('05-pin-neu',{x:k2.x,y:k2.y+250,width:k2.width,height:k2.height-250});
// 6 Test erstellen
await p.goto(U+'#testbau');await p.waitForTimeout(900);
await p.evaluate(()=>{const c=[...document.querySelectorAll('.themen input[type=checkbox]')].filter(x=>x.id!=='nurg').slice(0,2);c.forEach(x=>x.click());});await p.waitForTimeout(500);
await p.fill('#tt','Kurztest Gelatine und Pektin');
await mark([['.themen',1],['#tk',2],['#tt',2],['#tn',2],['#tz',2],['#tneu',3]]);
await shot('06-test-erstellen',{x:0,y:110,width:1200,height:560});
// 7 Bisherige Tests
await p.evaluate(()=>document.querySelectorAll('.mk').forEach(e=>e.remove()));
await mark([['[data-aus]',1],['[data-tog]',2]]);
const t=await box('.panel .tbl',16);await shot('07-tests-liste',{x:t.x,y:t.y-40,width:t.width,height:t.height+40});
// 8 Auswertung
await p.evaluate(()=>document.querySelectorAll('.mk').forEach(e=>e.remove()));
await p.click('[data-aus]');await p.waitForTimeout(800);
const a=await box('#auswertung',12);await shot('08-auswertung',{x:a.x,y:a.y,width:a.width,height:Math.min(a.height,560)});
// 9 Schüleransicht Startseite mit Testhinweis
await p.evaluate(()=>{localStorage.setItem('mock_session',JSON.stringify({id:'s5',email:'s5@x'}));});
await p.goto(U);await p.reload();await p.waitForTimeout(1200);
await mark([['.testband',1]]);
await shot('09-schueler-start',{x:0,y:0,width:1200,height:560});
await b.close()})();
