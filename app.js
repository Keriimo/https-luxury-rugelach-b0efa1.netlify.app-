"use strict";
(function(){
const KEY="marktradar:catalog:v3";
const API_PATH="/api/catalog";
const FREE_DAILY_MAX=180;
let dbConnection=null,revision=0,pendingDatabaseWrite=null,writingDatabase=false;
function openDatabase(){
 if(!("indexedDB" in window))return Promise.resolve(null);
 if(dbConnection)return dbConnection;
 dbConnection=new Promise(resolve=>{
  try{
   const request=indexedDB.open("MarktRadarKatalog",1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("states"))request.result.createObjectStore("states");};
   request.onsuccess=()=>resolve(request.result);
   request.onerror=()=>resolve(null);
   request.onblocked=()=>resolve(null);
  }catch(e){resolve(null);}
 });
 return dbConnection;
}
async function readDatabase(){
 const db=await openDatabase();if(!db)return null;
 return new Promise(resolve=>{
  try{
   const req=db.transaction("states","readonly").objectStore("states").get(KEY);
   req.onsuccess=()=>resolve(req.result||null);
   req.onerror=()=>resolve(null);
  }catch(e){resolve(null);}
 });
}
async function flushDatabase(){
 if(writingDatabase)return;
 writingDatabase=true;
 try{
  const db=await openDatabase();
  if(!db){pendingDatabaseWrite=null;return;}
  while(pendingDatabaseWrite!==null){
   const raw=pendingDatabaseWrite;pendingDatabaseWrite=null;
   await new Promise(resolve=>{
    try{
     const tx=db.transaction("states","readwrite");
     tx.objectStore("states").put(raw,KEY);
     tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
    }catch(e){resolve();}
   });
  }
 }finally{writingDatabase=false;if(pendingDatabaseWrite!==null)void flushDatabase();}
}
const el=id=>document.getElementById(id);
const DEFAULT=[
 {id:"dep",name:"Laminat DEPOT",url:"https://laminatdepot.de/",active:true,items:[],scan:null},
 {id:"sh24",name:"Laminat-Shop24",url:"https://laminat-shop24.com/",active:true,items:[],scan:null}
];
let state={shops:DEFAULT,tab:"products",query:"",category:"",promo:"",limit:20,sort:"price",busy:false};
const showEuro=n=>Number.isFinite(n)?n.toLocaleString("de-DE",{style:"currency",currency:"EUR"}):"–";
const now=()=>new Date().toLocaleString("de-DE");
const neat=s=>String(s||"").trim();
const $=el;
function node(tag,cls,content){
 const v=document.createElement(tag);
 if(cls)v.className=cls;
 if(content!==undefined&&content!==null)v.textContent=String(content);
 return v;
}
function btn(text,onClick,kind){
 const b=node("button",kind||"secondary",text);
 b.type="button";b.addEventListener("click",onClick);
 return b;
}
function opt(sel,value,label){
 const o=document.createElement("option");o.value=String(value);o.textContent=String(label);sel.append(o);
}
function save(){
 revision++;
 const saved={shops:state.shops,tab:state.tab};
 const raw=JSON.stringify(saved);
 pendingDatabaseWrite=raw;void flushDatabase();
 try{
  const lite=raw.length<650000?saved:{
   shops:state.shops.map(shop=>({...shop,items:shop.items.slice(0,60),scan:null})),
   tab:state.tab
  };
  localStorage.setItem(KEY,JSON.stringify(lite));
 }catch(e){
  setStatus("Browserspeicher eingeschränkt. Eine Sicherung als JSON ist möglich.","warning");
 }
}
function applySaved(old){
 if(old&&Array.isArray(old.shops)&&old.shops.length){
  state.shops=old.shops.filter(x=>x&&typeof x.name==="string"&&typeof x.url==="string"&&Array.isArray(x.items))
   .slice(0,20).map(x=>({...x,scan:x.scan||null,active:x.active!==false}));
 }
 if(old&&["products","comparison","offers"].includes(old.tab))state.tab=old.tab;
}
function restore(){
 try{applySaved(JSON.parse(localStorage.getItem(KEY)||"null"));}catch(e){}
}
function migratePreviousCatalog(){
 let total=0;
 for(const [id,oldKey] of [["dep","depot"],["sh24","shop24"]]){
  const shop=state.shops.find(s=>s.id===id);
  if(!shop||shop.items.length)continue;
  try{
   const old=JSON.parse(localStorage.getItem("marktradar:v2:"+oldKey)||"[]");
   if(Array.isArray(old)&&old.length){
    shop.items=old.filter(p=>p&&p.url&&p.name).map(p=>({
     ...p,unit:p.unit||"m²",priceCheckedAt:p.priceCheckedAt||p.checkedAt||null
    }));
    total+=shop.items.length;
   }
  }catch(e){}
 }
 if(total){save();renderShops();render();setStatus(total+" Artikel aus deiner bisherigen MarktRadar-Version übernommen. Preise bitte erneut prüfen.","ok");}
}
async function restoreFullDatabase(){
 const initialRevision=revision;
 const raw=await readDatabase();
 if(initialRevision!==revision)return;
 if(!raw){migratePreviousCatalog();return;}
 try{
  const old=JSON.parse(raw);
  applySaved(old);renderShops();render();
  migratePreviousCatalog();
  if(!state.shops.some(x=>x.items.length))setStatus("Browser-Datenbank geladen, aber bislang keine Produkte gespeichert. Nutze „Verbindung prüfen“.","normal");
 }catch(e){migratePreviousCatalog();}
}

function setStatus(message,kind){
 const target=el("message");target.textContent=message;target.dataset.kind=kind||"normal";
}
function cleanUrl(input){
 let u;
 try{u=new URL(/^https?:\/\//i.test(input)?input:"https://"+input);}catch(e){throw Error("Ungültige Shop-URL");}
 if(u.protocol!=="https:"||u.username||u.password||u.port)throw Error("Nur HTTPS-Webseiten ohne Port unterstützt.");
 const host=u.hostname.replace(/^www\./,"").toLowerCase();
 if(!host.includes(".")||/^(localhost|127\.|10\.|192\.168\.)/.test(host)||/\.(local|internal|localhost|test)$/i.test(host))throw Error("Bitte einen öffentlich erreichbaren Shop angeben.");
 return u.origin+u.pathname+u.search;
}
function addShop(){
 const name=neat(el("newName").value).slice(0,70),input=neat(el("newUrl").value);
 if(!name||!input){setStatus("Bitte Shopnamen und Webadresse eingeben.","warning");return;}
 let url;
 try{url=cleanUrl(input);}catch(e){setStatus(e.message,"warning");return;}
 if(state.shops.some(s=>s.url===url)){setStatus("Diese Shopadresse wurde bereits hinzugefügt.","warning");return;}
 if(state.shops.length>=20){setStatus("Maximal 20 Shops pro Browser.","warning");return;}
 state.shops.push({id:"s"+Date.now().toString(36),name,url,active:true,items:[],scan:null});
 el("newName").value="";el("newUrl").value="";save();renderShops();render();
 setStatus(name+" hinzugefügt. Wähle anschließend „Ausgewählte Shops prüfen“.","ok");
}
function editShop(shop){
 const n=window.prompt("Name des Shops",shop.name);
 if(n===null)return;
 const u=window.prompt("Shop-Webadresse (HTTPS)",shop.url);
 if(u===null)return;
 try{
  if(!neat(n))throw Error("Der Name darf nicht leer sein.");
  const url=cleanUrl(neat(u));
  if(url!==shop.url){shop.items=[];shop.scan=null;shop.checkedAt=null;}
  shop.name=neat(n).slice(0,70);shop.url=url;
  save();renderShops();render();
 }catch(e){setStatus(e.message,"warning");}
}
function deleteShop(shop){
 if(!window.confirm(shop.name+" und dessen gespeicherte Produkte aus diesem Browser entfernen?"))return;
 state.shops=state.shops.filter(s=>s.id!==shop.id);
 save();renderShops();render();
}
function renderShops(){
 const host=el("shopList");host.replaceChildren();
 for(const shop of state.shops){
  const item=node("div","shop-entry");
  const c=node("input");c.type="checkbox";c.checked=shop.active;
  c.disabled=state.busy;c.addEventListener("change",()=>{shop.active=c.checked;save();render();});
  const name=node("div","shop-data");
  name.append(node("strong",null,shop.name));
  name.append(node("small","muted break",shop.url));
  const count=shop.items.length,priced=shop.items.filter(validPrice).length;
  const pending=(shop.scan?.jobs?.length||0)+(shop.scan?.urls?.length||0);
  name.append(node("small","muted",count+" Artikel · "+priced+" €/m²-Preise "+(shop.checkedAt?"· Stand "+shop.checkedAt:"· noch nicht geprüft")));
  if(shop.scan?.blocked)name.append(node("small","stale","Zugriff eingeschränkt · später erneut versuchen"));
  else if(pending)name.append(node("small","muted",pending+" Prüfaufgaben ausstehend · Scan fortsetzen"));
  else if(shop.scan?.failures)name.append(node("small","stale","Mit "+shop.scan.failures+" Abrufproblemen beendet"));
  if(shop.scan?.errors?.length)name.append(node("small","muted","Hinweis: "+shop.scan.errors.slice(-1)[0]));
  const edit=btn("Bearbeiten",()=>editShop(shop),"secondary");
  const del=btn("Entfernen",()=>deleteShop(shop),"ghost");
  edit.disabled=state.busy;del.disabled=state.busy;
  item.append(c,name,edit,del);
  host.append(item);
 }
 const selected=state.shops.filter(s=>s.active);
 el("selectionCount").textContent=selected.length+" Shop"+(selected.length!==1?"s":"")+" ausgewählt";
 el("scanButton").disabled=state.busy||!selected.length;
 el("resetButton").disabled=state.busy||!selected.length;
}
function allItems(){return state.shops.filter(s=>s.active).flatMap(s=>s.items.map(p=>({...p,shopId:s.id,shopName:s.name})))}
function validPrice(p){return Number.isFinite(p.price)&&p.price>0&&p.unit==="m²"}
function priceAvailable(p){return Number.isFinite(p.price)&&p.price>0&&["m²","Stück"].includes(p.unit)}
function filteredItems(onlyOffers=false){
 const q=state.query.toLowerCase();
 let list=allItems().filter(p=>
  (!q||(p.name+" "+(p.brand||"")+" "+(p.sku||"")).toLowerCase().includes(q))&&
  (!state.category||p.category===state.category)&&
  (onlyOffers?Boolean(p.promotion):(!state.promo||(state.promo==="yes"?Boolean(p.promotion):!p.promotion)))
 );
 if(state.sort==="price")list.sort((a,b)=>(a.price==null?1:0)-(b.price==null?1:0)||((a.price??Infinity)-(b.price??Infinity)));
 if(state.sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"de"));
 if(state.sort==="new")list.sort((a,b)=>(b.checkedAt||"").localeCompare(a.checkedAt||""));
 return list.slice(0,state.limit);
}
function tokenSet(s){return new Set(neat(s).toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w=>w.length>=4&& !["laminat","boden","eiche","vinyl","parkett","inklusive","stärke","eicheoptik"].includes(w)))}
let compareCache={signature:null,pairs:[]};
function comparePairs(){
 const active=state.shops.filter(s=>s.active);
 const signature=active.map(s=>s.id+":"+s.items.length+":"+(s.checkedAt||"")+":"+s.items.filter(p=>p.price!=null).length).join("|");
 if(compareCache.signature===signature)return compareCache.pairs;
 const list=active.flatMap(s=>s.items.filter(priceAvailable).map(p=>({...p,shopId:s.id,shopName:s.name})));
 const byToken=new Map(),bySku=new Map(),pairs=[];
 function scorePair(x,y){
  if(x.shopId===y.shopId||x.category!==y.category||x.unit!==y.unit)return -100;
  let score=0;
  if(x.sku&&y.sku&&x.sku===y.sku)score+=20;
  if(x.thickness!=null&&y.thickness!=null){
   const delta=Math.abs(x.thickness-y.thickness);
   score+=delta<0.25?5:delta<=1?1:-5;
  }
  if(x.wear!=null&&y.wear!=null)score+=Math.abs(x.wear-y.wear)<0.03?3:-2;
  if(x.nk&&y.nk)score+=x.nk===y.nk?3:-3;
  if(x.ac&&y.ac)score+=x.ac===y.ac?2:-2;
  const a=tokenSet(x.name),b=tokenSet(y.name);
  for(const t of a)if(b.has(t))score+=2;
  if(x.brand&&y.brand&&x.brand.toLowerCase()===y.brand.toLowerCase())score+=2;
  return score;
 }
 for(const x of list){
  const tokens=[...tokenSet(x.name)];
  const candidates=new Set();
  for(const token of tokens){
   const group=byToken.get(x.category+"|"+token)||[];
   for(const y of group.slice(-90))candidates.add(y);
  }
  if(x.sku)for(const y of bySku.get(x.sku)||[])candidates.add(y);
  let best=null,bestScore=7;
  let counter=0;
  for(const y of candidates){
   if(counter++>180)break;
   const score=scorePair(x,y);
   if(score>bestScore){best=y;bestScore=score;}
  }
  if(best){
   pairs.push({a:x,b:best,score:bestScore,diff:x.price-best.price,
    relative:Math.abs(x.price-best.price)/Math.max(x.price,best.price)});
  }
  for(const token of tokens){
   const k=x.category+"|"+token,group=byToken.get(k)||[];
   group.push(x);
   if(group.length>400)group.shift();
   byToken.set(k,group);
  }
  if(x.sku){
   const group=bySku.get(x.sku)||[];
   group.push(x);bySku.set(x.sku,group);
  }
 }
 const unique=new Set();
 const result=pairs.filter(p=>{
  const key=[p.a.url,p.b.url].sort().join("|");
  if(unique.has(key))return false;unique.add(key);return true;
 }).sort((a,b)=>b.relative-a.relative).slice(0,800);
 compareCache={signature,pairs:result};
 return result;
}
function renderMetrics(items,pairs){
 const top=el("metrics");top.replaceChildren();
 const m=[["Gefundene Produkte",items.length],["Mit €/m²-Preis",items.filter(validPrice).length],
  ["Shops",state.shops.filter(s=>s.active).length],["Vergleichsvorschläge",pairs.length]];
 for(const [label,n]of m){
  const card=node("div","metric-card");
  card.append(node("small","muted",label),node("strong","metric-val",n));
  top.append(card);
 }
}
function tableHeader(tr,headers){for(const h of headers)tr.append(node("th",null,h));}
function renderProducts(){
 const box=el("tableHolder");box.replaceChildren();
 const table=node("table"),thead=node("thead"),tr=node("tr"),tbody=node("tbody");
 tableHeader(tr,["Produkt","Shop","Kategorie","Stärke","NK / AC","Preis","Aktion","Quelle"]);
 thead.append(tr);
 for(const p of filteredItems()){
  const row=node("tr");
  const title=node("td"),name=node("strong",null,p.name);
  title.append(name);
  if(p.brand)title.append(node("small","muted",p.brand));
  const priceCell=node("td","price",p.price!=null?showEuro(p.price)+" /"+(p.unit==="m²"?"m²":p.unit||"Einheit"):"Preis nicht erkannt");
  if(p.price!=null){
   const stamp=p.priceCheckedAt||p.checkedAt;
   const date=stamp?new Date(stamp):null;
   const valid=date&&Number.isFinite(date.getTime());
   const age=valid?Date.now()-date.getTime():Infinity;
   priceCell.append(node("small",age>24*60*60*1000?"stale":"muted",
    valid?"Preis geprüft: "+date.toLocaleDateString("de-DE")+(age>24*60*60*1000?" · älter":""):"Prüfdatum unbekannt"));
  }
  row.append(title,node("td",null,p.shopName),node("td",null,p.category),
   node("td",null,p.thickness!=null?p.thickness+" mm":"–"),
   node("td",null,[p.nk?"NK "+p.nk:null,p.ac].filter(Boolean).join(" / ")||"–"),
   priceCell,node("td",null,p.promotion||"–"));
  const source=node("td"),a=node("a",null,"Angebot ↗");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";source.append(a);row.append(source);tbody.append(row);
 }
 if(!tbody.children.length){const row=node("tr"),td=node("td",null,"Keine Produkte für die gewählten Filter. Prüfe die Shop-Auswahl oder starte einen Scan.");td.colSpan=8;row.append(td);tbody.append(row);}
 table.append(thead,tbody);box.append(table);
}
function featureRow(table,label,a,b){
 const row=node("tr");row.append(node("td",null,label),node("td",null,a??"Nicht erfasst"),node("td",null,b??"Nicht erfasst"));table.append(row);
}
function comparisonDetail(pair,box){
 box.replaceChildren();
 const t=node("table","detail"),heading=node("tr");
 tableHeader(heading,["Merkmal",pair.a.shopName,pair.b.shopName]);t.append(heading);
 featureRow(t,"Produkt",pair.a.name,pair.b.name);
 featureRow(t,"Preis je "+pair.a.unit,showEuro(pair.a.price),showEuro(pair.b.price));
 featureRow(t,"Stärke",pair.a.thickness!=null?pair.a.thickness+" mm":null,pair.b.thickness!=null?pair.b.thickness+" mm":null);
 featureRow(t,"Nutzschicht",pair.a.wear!=null?pair.a.wear+" mm":null,pair.b.wear!=null?pair.b.wear+" mm":null);
 featureRow(t,"Nutzungsklasse",pair.a.nk?("NK "+pair.a.nk):null,pair.b.nk?("NK "+pair.b.nk):null);
 featureRow(t,"Abriebklasse",pair.a.ac,pair.b.ac);
 featureRow(t,"Dämmung laut Beschreibung",pair.a.insulation?"Erwähnt":"Nicht bestätigt",pair.b.insulation?"Erwähnt":"Nicht bestätigt");
 featureRow(t,"Fußleisten laut Beschreibung",pair.a.skirting?"Erwähnt":"Nicht bestätigt",pair.b.skirting?"Erwähnt":"Nicht bestätigt");
 box.append(t,node("p","notice","Automatischer Vorschlag, keine bestätigte Gleichwertigkeit. Fehlende Angaben sind kein Qualitätsnachteil."));
 const row=node("div","row");
 for(const p of [pair.a,pair.b]){const a=node("a",null,p.shopName+" ↗");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";row.append(a);}
 box.append(row);
}
function renderComparisons(pairs){
 const area=el("comparisonHolder");area.replaceChildren();
 if(!pairs.length){area.append(node("div","empty","Noch keine geeigneten Preisvergleiche. Mindestens zwei Shops mit verifizierbarem €/m²-Preis sind erforderlich."));return;}
 const choices=pairs.filter(pair=>{
  const q=state.query.toLowerCase();
  return (!state.category||pair.a.category===state.category)&&
   (!state.promo||(state.promo==="yes"?(Boolean(pair.a.promotion)||Boolean(pair.b.promotion)):(!pair.a.promotion&&!pair.b.promotion)))&&
   (!q||(pair.a.name+" "+pair.b.name).toLowerCase().includes(q));
 }).slice(0,state.limit);
 for(const pair of choices){
  const item=node("div","pair"),left=node("div","pair-body");
  const smaller=pair.a.price<=pair.b.price?pair.a:pair.b;
  left.append(node("strong",null,pair.a.shopName+": "+pair.a.name));
  left.append(node("small","muted","↔ "+pair.b.shopName+": "+pair.b.name));
  left.append(node("div","",showEuro(pair.a.price)+" /"+pair.a.unit+" ↔ "+showEuro(pair.b.price)+" /"+pair.b.unit));
  left.append(node("strong","green",smaller.shopName+" günstiger um "+showEuro(Math.abs(pair.diff))+" je "+pair.a.unit+" ("+Math.round(100*pair.relative)+" % gegenüber dem höheren Preis)"));
  left.append(node("small","muted","Automatischer Vergleichsvorschlag · Merkmale vor Verwendung prüfen"));
  const detail=node("div","detail-box");detail.hidden=true;
  item.append(left,btn("Technik vergleichen",()=>{detail.hidden=!detail.hidden;if(!detail.hidden)comparisonDetail(pair,detail);},"secondary"),detail);
  area.append(item);
 }
 if(!choices.length)area.append(node("div","empty","Keine Vorschläge in diesem Filter."));
}
function renderPromos(){
 const area=el("offersHolder");area.replaceChildren();
 const list=filteredItems(true);
 if(!list.length){area.append(node("div","empty","Keine eindeutig gekennzeichneten Aktionen in der Auswahl."));return;}
 for(const p of list){
  const row=node("div","offer"),left=node("div","shop-data");
  left.append(node("strong",null,p.name),node("small","muted",p.shopName+" · "+p.category));
  const price=node("div","price");
  price.append(node("strong",null,p.price!=null?showEuro(p.price):"Preis unbekannt"));
  if(p.oldPrice&&p.price!=null)price.append(node("small","muted", "Vergleichspreis "+showEuro(p.oldPrice)));
  price.append(node("small","green",p.promotion));
  const a=node("a",null,"Prüfen ↗");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";
  row.append(left,price,a);area.append(row);
 }
}
function render(){
 const all=allItems(),pairs=comparePairs();renderMetrics(all,pairs);
 el("productsTab").classList.toggle("active",state.tab==="products");
 el("comparisonTab").classList.toggle("active",state.tab==="comparison");
 el("offersTab").classList.toggle("active",state.tab==="offers");
 el("productsSection").hidden=state.tab!=="products";
 el("comparisonSection").hidden=state.tab!=="comparison";
 el("offersSection").hidden=state.tab!=="offers";
 if(state.tab==="products")renderProducts();
 if(state.tab==="comparison")renderComparisons(pairs);
 if(state.tab==="offers")renderPromos();
}
function allowanceKey(){return "marktradar:requests:"+new Date().toISOString().slice(0,10);}
function availableRequest(){
 let used=0;
 try{used=Number(localStorage.getItem(allowanceKey())||0);}catch(e){}
 if(used>=FREE_DAILY_MAX)return false;
 try{localStorage.setItem(allowanceKey(),String(used+1));}catch(e){}
 return true;
}
async function api(site,action,extra){
 if(!availableRequest())throw Error("Kostenlose Sicherheitsgrenze von 180 Scan-Anfragen pro Tag erreicht. Morgen erneut versuchen.");
 const ctl=new AbortController(),tid=setTimeout(()=>ctl.abort(),12000);
 try{
  const res=await fetch(API_PATH,{method:"POST",
   headers:{"Content-Type":"application/json"},
   signal:ctl.signal,body:JSON.stringify(Object.assign({site,action},extra||{}))});
  const raw=await res.text();
  let data;
  try{data=JSON.parse(raw);}catch(e){throw Error("Cloudflare /api/catalog: HTTP "+res.status+" · Antwort ist kein JSON");}
  if(!res.ok)throw Error("Netlify /catalog: HTTP "+res.status+" · "+(data.error||"Abruf fehlgeschlagen"));
  return data;
 }finally{clearTimeout(tid);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function mergeItem(map,p){
 if(!p||!p.url||!p.name)return;
 const old=map.get(p.url);
 if(!old){map.set(p.url,p.price!=null?{...p,priceCheckedAt:p.checkedAt||new Date().toISOString()}:p);return;}
 const next=Object.assign({},old,p);
 if(p.price==null&&old.price!=null){
  next.price=old.price;next.unit=old.unit;next.priceSource=old.priceSource;
  next.priceCheckedAt=old.priceCheckedAt||old.checkedAt||null;
 }else if(p.price!=null)next.priceCheckedAt=p.checkedAt||new Date().toISOString();
 if(!p.promotion&&old.promotion)next.promotion=old.promotion;
 if(!p.thickness&&old.thickness)next.thickness=old.thickness;
 map.set(p.url,next);
}
function scanStats(shop,scan){
 shop.items=[...scan.items.values()].slice(0,12000);
 shop.scan={jobs:scan.jobs.slice(0,12000),urls:scan.urls.slice(0,25000),
  visitedJobs:[...scan.visitedJobs].slice(-20000),visitedUrls:[...scan.visitedUrls].slice(-30000),
  pages:scan.pages,done:scan.done,failures:scan.failures,other:scan.other,
  errors:(scan.errors||[]).slice(-6),truncated:Boolean(scan.truncated),
  blocked:Boolean(scan.blocked),checkedAt:now()};
 shop.checkedAt=now();save();renderShops();render();
}


function errorKind(error){
 const message=String(error?.message||error||"Abruf nicht möglich");
 if(/403|401|Zugriff verweigert/i.test(message))return "Zugriff verweigert";
 if(/429|rate.limit|zu viele anfragen/i.test(message))return "Anfragen begrenzt";
 if(/Zeitüberschreitung|timed out|aborted/i.test(message))return "Zeitüberschreitung";
 if(/404/i.test(message))return "Seite nicht gefunden";
 if(/quota|free|limit|Sicherheitsgrenze|Kostenlose/i.test(message))return "Gratislimit erreicht";
 return message.slice(0,130);
}
async function scanShop(shop,restart){
 const previous=Array.isArray(shop.items)?shop.items:[];
 let saved=restart?null:shop.scan;
 if(!saved||(!saved.jobs?.length&&!saved.urls?.length)){
  try{
   const found=await api(shop.url,"discover");
   saved={jobs:[{type:"shopify",page:1},...(found.jobs||[])],
    urls:found.urls||[],visitedJobs:[],visitedUrls:[],
    pages:0,done:0,failures:0,other:0,errors:[],truncated:false};
  }catch(e){
   const message=errorKind(e);
   shop.scan={jobs:[],urls:[],visitedJobs:[],visitedUrls:[],
    pages:0,done:0,failures:1,other:0,errors:[message],
    blocked:message==="Zugriff verweigert"||message==="Anfragen begrenzt",checkedAt:now()};
   save();renderShops();
   return {complete:false,count:previous.length,priced:previous.filter(validPrice).length,
    remaining:0,failed:1,diagnostic:message};
  }
 }
 const scan={
  ...saved,
  visitedJobs:new Set(saved.visitedJobs||[]),
  visitedUrls:new Set(saved.visitedUrls||[]),
  items:new Map(previous.filter(p=>p?.url).map(p=>[p.url,p])),
  errors:Array.isArray(saved.errors)?saved.errors.slice(-6):[],
  blocked:false
 };
 const maxJobs=8,maxDetails=24,maxMillis=75000;
 const start=Date.now();
 let jobsDone=0,detailsDone=0,processed=0;
 const progress=()=>{
  const priced=[...scan.items.values()].filter(validPrice).length;
  el("progress").textContent=shop.name+": "+scan.items.size+" Artikel, "+
    priced+" €/m²-Preise, "+scan.done+" Produktseiten geprüft, "+
    (scan.jobs.length+scan.urls.length)+" Aufgaben offen, "+
    scan.failures+" Abrufprobleme"+
    (scan.errors.length?" · "+scan.errors[scan.errors.length-1]:"");
 };
 const fail=(error,kind)=>{
  const label=errorKind(error);
  scan.failures++;
  if(!scan.errors.includes(label))scan.errors.push(label);
  scan.errors=scan.errors.slice(-6);
  if(label==="Zugriff verweigert"||label==="Anfragen begrenzt"||label==="Gratislimit erreicht")scan.blocked=true;
  if(kind==="shopify"&&label==="Seite nicht gefunden")scan.failures--; // optional feed
  return label;
 };
 while((scan.jobs.length||scan.urls.length)&&
  (jobsDone<maxJobs||detailsDone<maxDetails)&&
  Date.now()-start<maxMillis&&!scan.blocked){
  // Alternate catalog discovery and verification to produce usable prices earlier.
  const catalogNext=scan.jobs.length&&jobsDone<maxJobs&&
    (scan.urls.length<10||detailsDone>=maxDetails||processed%3!==1);
  if(catalogNext){
   const job=scan.jobs.shift();
   const key=job.type+":"+job.url+":"+(job.offset||job.page||0);
   if(!scan.visitedJobs.has(key)){
    jobsDone++;processed++;scan.pages++;
    try{
     const data=job.type==="shopify"?
      await api(shop.url,"shopify",{page:job.page}):
      await api(shop.url,"expand",{job});
     scan.visitedJobs.add(key);
     for(const product of data.products||[])mergeItem(scan.items,product);
     if(job.type==="shopify"){
      for(const product of data.products||[]){
       if(product.url&&!scan.visitedUrls.has(product.url)&&
        !scan.urls.includes(product.url))scan.urls.push(product.url);
      }
      if(data.hasMore&&job.page<30)scan.jobs.push({type:"shopify",page:job.page+1});
      if(data.hasMore&&job.page>=30)scan.truncated=true;
     }else{
      for(const next of data.jobs||[]){
       const token=next.type+":"+next.url+":"+(next.offset||next.page||0);
       if(!scan.visitedJobs.has(token)&&!scan.jobs.some(j=>j.type+":"+j.url+":"+(j.offset||j.page||0)===token))scan.jobs.push(next);
      }
      for(const url of data.urls||[]){
       if(!scan.visitedUrls.has(url)&&!scan.urls.includes(url))scan.urls.push(url);
      }
      if(data.truncated)scan.truncated=true;
     }
    }catch(e){
     const label=errorKind(e);
     // Not every shop publishes a Shopify feed or these optional sitemap paths.
     if(label==="Seite nicht gefunden"&&["shopify","map","robots"].includes(job.type)){
      scan.visitedJobs.add(key);
     }else{
      fail(e,job.type);
      // If blocked, keep the exact task for a later manual retry.
      if(scan.blocked)scan.jobs.unshift(job);
      else scan.visitedJobs.add(key);
     }
    }
   }
  }else if(scan.urls.length&&detailsDone<maxDetails){
   const batch=[];
   while(batch.length<2&&scan.urls.length){
    const url=scan.urls.shift();
    if(!scan.visitedUrls.has(url)){batch.push(url);scan.visitedUrls.add(url);}
   }
   if(batch.length){
    processed++;detailsDone+=batch.length;scan.done+=batch.length;
    try{
     const response=await api(shop.url,"batch",{urls:batch});
     for(const product of response.products||[])mergeItem(scan.items,product);
     for(const failure of response.errors||[]){
      if(/Kategorie|Bodenbelag/i.test(failure.reason||"")){scan.other++;continue;}
      const label=fail(failure.reason||"Produkt nicht abrufbar","detail");
      if(scan.blocked){scan.urls.unshift(failure.url);scan.visitedUrls.delete(failure.url);}
      else if(label==="Seite nicht gefunden")scan.failures--;
     }
    }catch(e){
     fail(e,"detail");
     if(scan.blocked)for(const url of batch.reverse()){
      scan.urls.unshift(url);scan.visitedUrls.delete(url);
     }
    }
    await delay(250);
   }
  }else break;
  progress();
  if(processed%8===0)scanStats(shop,scan);
 }
 scanStats(shop,scan);
 progress();
 const priced=[...scan.items.values()].filter(validPrice).length;
 const remaining=scan.jobs.length+scan.urls.length;
 return {complete:remaining===0&&!scan.truncated&&scan.failures===0&&scan.items.size>0,
  count:scan.items.size,priced,remaining,failed:scan.failures,
  diagnostic:scan.items.size===0?"Keine auslesbaren Bodenbelag-Produkte gefunden; Katalog kann gesperrt oder dynamisch sein":
    scan.errors.slice(-2).join("; "),blocked:scan.blocked};
}
async function scanAll(restart){
 if(state.busy)return;
 const shops=state.shops.filter(s=>s.active);
 if(!shops.length){setStatus("Bitte mindestens einen Shop auswählen.","warning");return;}
 state.busy=true;renderShops();el("progress").hidden=false;
 const outcomes=[];
 try{
  for(const shop of shops){
   setStatus("Scanne "+shop.name+". Bitte Browser-Tab geöffnet lassen.","normal");
   try{
    const result=await scanShop(shop,restart);
    outcomes.push(shop.name+": "+result.count+" Artikel, "+result.priced+" €/m²-Preise"+
     (result.blocked?" · Abruf eingeschränkt":
     result.complete?" · Durchlauf abgeschlossen":" · Scan unvollständig")+
     (result.remaining?" · "+result.remaining+" Aufgaben offen":"")+
     (result.diagnostic?" · "+result.diagnostic:""));
   }catch(e){outcomes.push(shop.name+": Fehler („"+e.message+"“)");}
  }
  setStatus(outcomes.join(" | ")+". Daten können unvollständig sein. Originalangebote prüfen.","normal");
 }finally{state.busy=false;renderShops();render();}
}
function downloadJson(){
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),shops:state.shops},null,2)],{type:"application/json"});
 const u=URL.createObjectURL(blob),a=node("a");a.href=u;a.download="marktradar-export.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
async function runDiagnostics(){
 const btn=el("diagnoseButton"),old=btn.textContent;
 btn.disabled=true;btn.textContent="Prüfung läuft …";el("progress").hidden=false;
 const findings=[];
 try{
  try{
   const result=await fetch(API_PATH,{cache:"no-store"});
   const info=await result.json();
   if(!result.ok||!info.ok)throw Error(info.error||"HTTP "+result.status);
   findings.push("Cloudflare-Funktion OK: "+(info.version||"unbekannt"));
  }catch(e){findings.push("Cloudflare-Funktion FEHLER: "+e.message);}
  try{
   const check=await api("https://laminatdepot.de/","probe");
   findings.push("Shopabruf Laminat DEPOT: "+(check.ok?"OK, "+check.bytes+" Zeichen":"fehlgeschlagen"));
  }catch(e){findings.push("Shopabruf Laminat DEPOT FEHLER: "+e.message);}
  findings.push("Prüfzeit: "+new Date().toLocaleString("de-DE"));
  el("progress").textContent=findings.join(" | ");
  setStatus("Verbindungstest abgeschlossen. Bei Fehler bitte die blaue Diagnosezeile kopieren.","normal");
 }finally{btn.disabled=false;btn.textContent=old;}
}
restore();
el("diagnoseButton").onclick=runDiagnostics;
el("addButton").onclick=addShop;
el("scanButton").onclick=()=>scanAll(false);
el("resetButton").onclick=()=>{if(window.confirm("Neu starten? Bereits gespeicherte Artikel bleiben vorhanden.")){state.shops.filter(s=>s.active).forEach(s=>s.scan=null);scanAll(true);}};
el("exportButton").onclick=downloadJson;
el("productSearch").oninput=e=>{state.query=e.target.value;render();};
el("category").onchange=e=>{state.category=e.target.value;render();};
el("promotions").onchange=e=>{state.promo=e.target.value;render();};
el("limit").onchange=e=>{state.limit=Number(e.target.value)||20;render();};
el("sort").onchange=e=>{state.sort=e.target.value;render();};
for(const [id,t] of [["productsTab","products"],["comparisonTab","comparison"],["offersTab","offers"]]){
 el(id).onclick=()=>{state.tab=t;save();render();};
}
renderShops();render();
void restoreFullDatabase();
})();