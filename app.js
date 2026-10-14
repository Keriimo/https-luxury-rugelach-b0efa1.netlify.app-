"use strict";
(function(){
const KEY="marktradar:catalog:v3";
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
 try{localStorage.setItem(KEY,JSON.stringify({shops:state.shops,tab:state.tab}));}
 catch(e){setStatus("Der Browserspeicher ist voll. Bitte zuerst alte Daten exportieren oder unbenutzte Shops entfernen.","warning");}
}
function restore(){
 try{
  const old=JSON.parse(localStorage.getItem(KEY)||"null");
  if(old&&Array.isArray(old.shops)&&old.shops.length){
   state.shops=old.shops.filter(x=>x&&typeof x.name==="string"&&typeof x.url==="string"&&Array.isArray(x.items))
    .slice(0,20).map(x=>({...x,scan:x.scan||null,active:x.active!==false}));
  }
  if(old&&["products","comparison","offers"].includes(old.tab))state.tab=old.tab;
 }catch(e){}
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
 return u.origin+u.pathname.replace(/\/+$/,"")+"/";
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
  const count=shop.items.length,priced=shop.items.filter(p=>p.price!==null&&p.price!==undefined).length;
  name.append(node("small","muted",count+" Artikel · "+priced+" Preise "+(shop.checkedAt?"· Stand "+shop.checkedAt:"· noch nicht geprüft")));
  item.append(c,name,btn("Bearbeiten",()=>editShop(shop),"secondary"),btn("Entfernen",()=>deleteShop(shop),"ghost"));
  host.append(item);
 }
 const selected=state.shops.filter(s=>s.active);
 el("selectionCount").textContent=selected.length+" Shop"+(selected.length!==1?"s":"")+" ausgewählt";
 el("scanButton").disabled=state.busy||!selected.length;
 el("resetButton").disabled=state.busy||!selected.length;
}
function allItems(){return state.shops.filter(s=>s.active).flatMap(s=>s.items.map(p=>({...p,shopId:s.id,shopName:s.name})))}
function validPrice(p){return Number.isFinite(p.price)&&p.price>0&&p.unit==="m²"}
function filteredItems(){
 const q=state.query.toLowerCase();
 let list=allItems().filter(p=>
  (!q||(p.name+" "+(p.brand||"")+" "+(p.sku||"")).toLowerCase().includes(q))&&
  (!state.category||p.category===state.category)&&
  (!state.promo||(state.promo==="yes"?Boolean(p.promotion):!p.promotion))
 );
 if(state.sort==="price")list.sort((a,b)=>(a.price==null?1:0)-(b.price==null?1:0)||((a.price??Infinity)-(b.price??Infinity)));
 if(state.sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"de"));
 if(state.sort==="new")list.sort((a,b)=>(b.checkedAt||"").localeCompare(a.checkedAt||""));
 return list.slice(0,state.limit);
}
function tokenSet(s){return new Set(neat(s).toLowerCase().split(/[^a-zäöüß0-9]+/).filter(w=>w.length>=4&& !["laminat","boden","eiche","vinyl","parkett","inklusive","stärke","eicheoptik"].includes(w)))}
function comparePairs(){
 const active=state.shops.filter(s=>s.active);
 const list=active.flatMap(s=>s.items.filter(validPrice).map(p=>({...p,shopId:s.id,shopName:s.name})));
 const pairs=[];
 for(let i=0;i<list.length;i++){
  const x=list[i];
  let best=null,score=-Infinity;
  const t=tokenSet(x.name),others=list.slice(i+1);
  for(const y of others){
   if(x.shopId===y.shopId||x.category!==y.category)continue;
   if(x.unit!==y.unit)continue;
   let points=0;
   const sameSku=x.sku&&y.sku&&x.sku===y.sku;
   if(sameSku)points+=18;
   if(x.thickness!==null&&x.thickness!==undefined&&y.thickness!==null&&y.thickness!==undefined){
    const d=Math.abs(x.thickness-y.thickness);
    points+=d<0.3?5:d<=1?1:-4;
   }
   if(x.wear!=null&&y.wear!=null)points+=Math.abs(x.wear-y.wear)<0.02?3:-2;
   if(x.nk&&y.nk)points+=x.nk===y.nk?3:-2;
   if(x.ac&&y.ac)points+=x.ac===y.ac?2:-1;
   for(const word of tokenSet(y.name))if(t.has(word))points+=2;
   if(points>score){score=points;best=y;}
  }
  if(best&&score>=5){
   pairs.push({a:x,b:best,score,diff:x.price-best.price,relative:Math.abs(x.price-best.price)/Math.max(x.price,best.price)});
  }
 }
 const seen=new Set();
 return pairs.filter(p=>{
  const key=[p.a.url,p.b.url].sort().join("|");
  if(seen.has(key))return false;seen.add(key);return true;
 }).sort((a,b)=>b.relative-a.relative).slice(0,800);
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
  row.append(title,node("td",null,p.shopName),node("td",null,p.category),
   node("td",null,p.thickness!=null?p.thickness+" mm":"–"),
   node("td",null,[p.nk?"NK "+p.nk:null,p.ac].filter(Boolean).join(" / ")||"–"),
   node("td","price",p.price!=null?showEuro(p.price)+" /"+(p.unit==="m²"?"m²":p.unit||"Einheit"):"Preis nicht erkannt"),
   node("td",null,p.promotion||"–"));
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
 featureRow(t,"Preis /m²",showEuro(pair.a.price),showEuro(pair.b.price));
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
   (!state.promo||Boolean(pair.a.promotion)||Boolean(pair.b.promotion))&&
   (!q||(pair.a.name+" "+pair.b.name).toLowerCase().includes(q));
 }).slice(0,state.limit);
 for(const pair of choices){
  const item=node("div","pair"),left=node("div","pair-body");
  const smaller=pair.a.price<=pair.b.price?pair.a:pair.b;
  left.append(node("strong",null,pair.a.shopName+": "+pair.a.name));
  left.append(node("small","muted","↔ "+pair.b.shopName+": "+pair.b.name));
  left.append(node("div","",showEuro(pair.a.price)+" /m² ↔ "+showEuro(pair.b.price)+" /m²"));
  left.append(node("strong","green",smaller.shopName+" günstiger um "+showEuro(Math.abs(pair.diff))+" je m²"));
  const detail=node("div","detail-box");detail.hidden=true;
  item.append(left,btn("Technik vergleichen",()=>{detail.hidden=!detail.hidden;if(!detail.hidden)comparisonDetail(pair,detail);},"secondary"),detail);
  area.append(item);
 }
 if(!choices.length)area.append(node("div","empty","Keine Vorschläge in diesem Filter."));
}
function renderPromos(){
 const area=el("offersHolder");area.replaceChildren();
 const list=filteredItems().filter(p=>p.promotion).slice(0,state.limit);
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
async function api(site,action,extra){
 const ctl=new AbortController(),tid=setTimeout(()=>ctl.abort(),12000);
 try{
  const res=await fetch("/.netlify/functions/catalog",{method:"POST",
   headers:{"Content-Type":"application/json"},
   signal:ctl.signal,body:JSON.stringify(Object.assign({site,action},extra||{}))});
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"HTTP "+res.status);
  return data;
 }finally{clearTimeout(tid);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function mergeItem(map,p){
 if(!p||!p.url||!p.name)return;
 const old=map.get(p.url);
 if(!old){map.set(p.url,p);return;}
 const next=Object.assign({},old,p);
 if(p.price==null&&old.price!=null){next.price=old.price;next.unit=old.unit;next.priceSource=old.priceSource;}
 if(!p.promotion&&old.promotion)next.promotion=old.promotion;
 if(!p.thickness&&old.thickness)next.thickness=old.thickness;
 map.set(p.url,next);
}
function scanStats(shop,scan){
 shop.items=[...scan.items.values()].slice(0,5000);
 shop.scan={jobs:scan.jobs.slice(0,1500),urls:scan.urls.slice(0,3000),
  visitedJobs:[...scan.visitedJobs].slice(-3500),visitedUrls:[...scan.visitedUrls].slice(-5000),
  pages:scan.pages,done:scan.done,failures:scan.failures,other:scan.other,shopifyDone:scan.shopifyDone,checkedAt:now()};
 shop.checkedAt=now();save();renderShops();render();
}
async function scanShop(shop,restart){
 const previous=Array.isArray(shop.items)?shop.items:[];
 let s=restart?null:shop.scan;
 if(!s||(!s.jobs?.length&&!s.urls?.length)){
  const discovered=await api(shop.url,"discover");
  s={jobs:discovered.jobs||[],urls:[],visitedJobs:[],visitedUrls:[],pages:0,done:0,failures:0,other:0,shopifyDone:false};
  if(shop.url.includes("laminat-shop24.com"))s.jobs.unshift({type:"shopify",page:1});
 }
 const scan={...s,visitedJobs:new Set(s.visitedJobs||[]),visitedUrls:new Set(s.visitedUrls||[]),items:new Map(previous.map(p=>[p.url,p]))};
 const maxJobs=65,maxDetails=250;
 const started=Date.now();let jobsDone=0,detailsDone=0;
 const label=()=>shop.name+": "+scan.items.size+" Artikel, "+[...scan.items.values()].filter(p=>p.price!=null).length+
  " Preise, "+scan.done+" Produktseiten geprüft, "+scan.failures+" technische Fehler, "+
  (scan.jobs.length+scan.urls.length)+" offene Aufgaben";
 const status=()=>{el("progress").textContent=label();};
 while((scan.jobs.length||scan.urls.length)&&jobsDone<maxJobs&&detailsDone<maxDetails&&Date.now()-started<115000){
  if(scan.jobs.length&&jobsDone<maxJobs){
   const job=scan.jobs.shift(),key=job.type+":"+job.url+":"+(job.offset||job.page||0);
   if(!scan.visitedJobs.has(key)){
    scan.visitedJobs.add(key);jobsDone++;scan.pages++;
    try{
     const data=job.type==="shopify"?
      await api(shop.url,"shopify",{page:job.page}):
      await api(shop.url,"expand",{job});
     for(const p of data.products||[])mergeItem(scan.items,p);
     if(job.type==="shopify"){
      if(data.hasMore&&job.page<8)scan.jobs.push({type:"shopify",page:job.page+1});
     }else{
      for(const j of data.jobs||[])scan.jobs.push(j);
      for(const url of data.urls||[])if(!scan.visitedUrls.has(url)&&!scan.urls.includes(url))scan.urls.push(url);
     }
    }catch(e){if(job.type!=="shopify")scan.failures++;}
   }
  }
  if(scan.urls.length&&(scan.jobs.length===0||scan.urls.length>40||jobsDone%3===0)){
   const batch=[];
   while(batch.length<2&&scan.urls.length){
    const next=scan.urls.shift();
    if(!scan.visitedUrls.has(next)){scan.visitedUrls.add(next);batch.push(next);}
   }
   if(batch.length){
    try{
     const result=await api(shop.url,"batch",{urls:batch});
     for(const p of result.products||[])mergeItem(scan.items,p);
     scan.failures+=(result.errors||[]).filter(e=>!/Kategorie/i.test(e.reason||"")).length;
     scan.other+=(result.errors||[]).length;
    }catch(e){scan.failures+=batch.length;}
    detailsDone+=batch.length;scan.done+=batch.length;
    await delay(190);
   }
  }
  status();
  if((jobsDone+detailsDone)%8===0)scanStats(shop,scan);
 }
 scanStats(shop,scan);
 return {complete:!scan.jobs.length&&!scan.urls.length,
  count:scan.items.size,priced:[...scan.items.values()].filter(p=>p.price!=null).length,
  remaining:scan.jobs.length+scan.urls.length,failed:scan.failures};
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
    outcomes.push(shop.name+": "+result.count+" Artikel, "+result.priced+" Preise"+
     (result.complete?"":" · weitere Prüfung möglich"));
   }catch(e){outcomes.push(shop.name+": Fehler („"+e.message+"“)");}
  }
  setStatus(outcomes.join(" | ")+". Daten können unvollständig sein. Originalangebote prüfen.","normal");
 }finally{state.busy=false;renderShops();render();}
}
function downloadJson(){
 const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),shops:state.shops},null,2)],{type:"application/json"});
 const u=URL.createObjectURL(blob),a=node("a");a.href=u;a.download="marktradar-export.json";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
restore();
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
})();