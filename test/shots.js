// node test/shots.js <prefix>  – Screenshots der wichtigsten Ansichten mit Attrappe
const {chromium}=require('playwright');const fs=require('fs');
const OUT=process.env.OUT, P=process.argv[2]||'s';
const mock=fs.readFileSync(__dirname+'/mock-supabase.js','utf8');
const fragen=JSON.parse(fs.readFileSync(__dirname+'/../app/fragen.json','utf8'));
(async()=>{const b=await chromium.launch();
for (const [w,h,tag] of [[1200,860,'d'],[390,844,'m']]){
const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/vendor-supabase.js',r=>r.fulfill({body:mock,contentType:'application/javascript'}));
await p.route('**/sw.js',r=>r.fulfill({status:404,body:''}));
await p.addInitScript(([fr])=>{ if(!localStorage.getItem('mock_db')){const db={profile:[{id:'u-admin',rolle:'admin',spitzname:'Thomas',klasse_id:null},{id:'u-s',rolle:'schueler',spitzname:'Testschüler',klasse_id:'k1'}],klassen:[{id:'k1',code:'ZDS-ZPJTD',name:'ZDS Fachschule 2026',lehrer_id:'u-admin',aktiv:true,created_at:'2026-10-29'}],fragen:fr.map(f=>({...f,aktiv:true})),lernstand:[],tests:[{id:'t1',code:'ABC123',klasse_id:'k1',titel:'Gelatine & Pektin',frage_ids:fr.slice(0,10).map(x=>x.id),zeit_min:10,aktiv:true,created_at:'2026-10-29'}],test_ergebnisse:[],simulationen:[],users:[{id:'u-admin',email:'tr@rcc-online.com',password:'admin123'},{id:'u-s',email:'testschueler.zds-zpjtd@schueler.rcc-online.com',password:'rcc-1234-ZDS-ZPJTD'}]};localStorage.setItem('mock_db',JSON.stringify(db));}},[fragen]);
await p.goto('http://localhost:8765/');await p.waitForTimeout(700);
await p.screenshot({path:`${OUT}/${P}-${tag}-1login.png`});
await p.fill('#code','ZDS-ZPJTD');await p.fill('#nick','Testschüler');await p.fill('#pin','1234');await p.click('#anmelden');await p.waitForTimeout(800);
await p.screenshot({path:`${OUT}/${P}-${tag}-2start.png`});
await p.goto('http://localhost:8765/#lernen');await p.waitForTimeout(600);
await p.screenshot({path:`${OUT}/${P}-${tag}-3lernen.png`});
const o=await p.$('.opt'); if(o){await o.click();await p.waitForTimeout(300);await p.screenshot({path:`${OUT}/${P}-${tag}-4feedback.png`,fullPage:tag==='m'});}
await p.goto('http://localhost:8765/#fortschritt');await p.waitForTimeout(600);await p.screenshot({path:`${OUT}/${P}-${tag}-5fortschritt.png`});
console.log(tag,errs.slice(0,3), await p.evaluate(()=>document.documentElement.scrollWidth));await p.close();}
await b.close()})();
