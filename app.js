"use strict";
(function(){
const KEY="marktradar:catalog:v3";
const API_PATH="/api/catalog";
const FREE_DAILY_MAX=1000;
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
let state={shops:DEFAULT,tab:"products",query:"",category:"",promo:"",limit:20,sort:"price",busy:false,stopRequested:false,manualCompare:[],compareShops:{A:"",B:""},compareSearch:{A:"",B:""}};
const APPEARANCE_KEY="marktradar:appearance:v1";
const STANDARD_STYLE={brand:"LAMINAT DEPOT · MARKTRADAR",title:"Wettbewerbsanalyse",
 subtitle:"Laminat · Vinyl / Rigid-Vinyl · Parkett · €/m²",
 accent:"#e5233f",hero:"#15233a"};
let appearance={...STANDARD_STYLE};
const accentOptions=["#e5233f","#c51f32","#2563eb","#0c8c62"];
const heroOptions=["#15233a","#101827","#ffffff"];
function loadAppearance(){
 try{
  const saved=JSON.parse(localStorage.getItem(APPEARANCE_KEY)||"null");
  if(saved&&typeof saved==="object"){
   for(const key of ["brand","title","subtitle"])
    if(typeof saved[key]==="string"&&saved[key].trim())appearance[key]=saved[key].slice(0,key==="subtitle"?130:80);
   if(accentOptions.includes(saved.accent))appearance.accent=saved.accent;
   if(heroOptions.includes(saved.hero))appearance.hero=saved.hero;
  }
 }catch(e){}
 // Earlier browser-customized default headings can still list removed categories.
 if(/bioboden|teppich|pvc|zubehör/i.test(appearance.subtitle))
  appearance.subtitle=STANDARD_STYLE.subtitle;
 updateAppearance();
}
function updateAppearance(){
 document.documentElement.style.setProperty("--accent",appearance.accent);
 document.documentElement.style.setProperty("--hero",appearance.hero);
 el("brandLabel").textContent=appearance.brand;
 el("pageHeading").textContent=appearance.title;
 el("pageSubtitle").textContent=appearance.subtitle;
 document.title=appearance.title+" · MarktRadar";
 el("editorBrand").value=appearance.brand;
 el("editorTitle").value=appearance.title;
 el("editorSubtitle").value=appearance.subtitle;
 el("editorAccent").value=appearance.accent;
 el("editorTheme").value=appearance.hero;
 el("hero").classList.toggle("light",appearance.hero==="#ffffff");
}
function saveAppearance(){
 const brand=neat(el("editorBrand").value).slice(0,65);
 const title=neat(el("editorTitle").value).slice(0,80);
 const subtitle=neat(el("editorSubtitle").value).slice(0,130);
 if(!brand||!title){setStatus("Bitte eine Marken-Zeile und Überschrift eingeben.","warning");return;}
 appearance={brand,title,subtitle:subtitle||STANDARD_STYLE.subtitle,
  accent:accentOptions.includes(el("editorAccent").value)?el("editorAccent").value:STANDARD_STYLE.accent,
  hero:heroOptions.includes(el("editorTheme").value)?el("editorTheme").value:STANDARD_STYLE.hero};
 try{localStorage.setItem(APPEARANCE_KEY,JSON.stringify(appearance));}catch(e){setStatus("Darstellung konnte nicht gespeichert werden. Browserspeicher prüfen.","warning");return;}
 updateAppearance();
 el("appearancePanel").hidden=true;
 setStatus("Darstellung für diesen Browser gespeichert. Scanner und Preise unverändert.","ok");
}
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
  const lite=raw.length<1600000?saved:{
   shops:state.shops.map(shop=>({...shop,items:shop.items.filter(isSupported).slice(0,500),scan:null})),
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
   .slice(0,20).map(x=>({...x,items:x.items.map(normalizedItem),
    scan:x.scan||null,active:x.active!==false}));
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
  const floorItems=shop.items.filter(isFloor);
  const count=floorItems.length,priced=floorItems.filter(validPrice).length;
  const pending=(shop.scan?.jobs?.length||0)+(shop.scan?.urls?.length||0);
  name.append(node("small","muted",count+" Bodenbeläge · "+priced+" €/m²-Preise "+
  (shop.checkedAt?"· Stand "+shop.checkedAt:"· noch nicht geprüft")));
  if(shop.scan?.blocked)name.append(node("small","stale","Zugriff eingeschränkt · später erneut versuchen"));
  else if(pending)name.append(node("small","muted",pending+" Prüfaufgaben ausstehend · Scan fortsetzen"));
  else if(shop.scan?.failures)name.append(node("small","stale","Mit "+shop.scan.failures+" Abrufproblemen beendet"));
  if(shop.scan?.unresolved?.length)name.append(node("small","stale",
   shop.scan.unresolved.length+" Produktseiten konnten nicht geprüft werden – bitte Quellen prüfen"));
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
 el("deepScanButton").disabled=state.busy||!selected.length;
 el("fullScanButton").disabled=state.busy||!selected.length;
 el("stopScanButton").hidden=!state.busy;
 el("resetButton").disabled=state.busy||!selected.length;
}
function allItems(){return state.shops.filter(s=>s.active).flatMap(s=>
 s.items.filter(isSupported).map(item=>({...normalizedItem(item),shopId:s.id,shopName:s.name})))} 
function validPrice(p){return isFloor(p)&&Number.isFinite(p.price)&&p.price>0&&p.unit==="m²"}
function priceAvailable(p){return validPrice(p)}
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
function hasComparablePrice(a,b){
 return a.category===b.category&&priceAvailable(a)&&priceAvailable(b)&&a.unit===b.unit;
}

const PRICE_CATEGORIES=["Laminat","Vinyl","Parkett"];
const SUPPORTED_CATEGORIES=PRICE_CATEGORIES;
const isFloor=p=>p&&PRICE_CATEGORIES.includes(p.category);
const isSupported=isFloor;
const normalizedItem=p=>p;

function productLink(p,label){
 const a=node("a",null,label||"Produkt öffnen ↗");
 a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";
 return a;
}
function renderOverview(items){
 const section=el("bestPriceGrid");section.replaceChildren();
 const prices=items.filter(validPrice);
 const count=prices.length;
 el("priceCoverage").textContent=count+" Bodenbeläge mit erfasstem €/m²-Preis";
 el("priceCoverage").classList.toggle("warn",!count);
 for(const category of PRICE_CATEGORIES){
  const options=items.filter(p=>p.category===category&&validPrice(p));
  options.sort((a,b)=>a.price-b.price);
  const product=options[0];
  const card=node("div","best-card"+(!product?" empty-price":""));
  card.append(node("small","muted","Bester erfasster "+(category==="Vinyl"?"Vinyl / Rigid-Vinyl":category)+"-Preis"));
  if(product){
   card.append(node("strong","",showEuro(product.price)+" /"+product.unit));
   card.append(node("div","name",product.name));
   card.append(node("small","muted",product.shopName));
   card.append(productLink(product,"Angebot ansehen ↗"));
  }else{
   card.append(node("strong",null,"Noch kein Preis"));
   card.append(node("div","name","Für diese Kategorie wurde noch kein passender Preis erfasst."));
  }
  section.append(card);
 }
 const wrap=el("shopCoverage");wrap.replaceChildren();
 const table=node("table","mini-table"),thead=node("thead"),tr=node("tr"),tbody=node("tbody");
 tableHeader(tr,["Shop","Bodenbeläge","Mit €/m²","Günstigster Boden","Scanstatus"]);
 thead.append(tr);
 for(const shop of state.shops.filter(x=>x.active)){
  const floor=(shop.items||[]).filter(isFloor),all=floor,verified=floor.filter(validPrice);
  const best=verified.length?verified.reduce((a,b)=>a.price<b.price?a:b):null;
  const row=node("tr");
  const name=node("td");name.append(node("strong",null,shop.name));
  const dataQuality=node("td",null,verified.length+" von "+floor.length+" Bodenartikeln");
  const scan=shop.scan;
  let status="Noch nicht geprüft";
  if(scan){
   const pending=(scan.jobs?.length||0)+(scan.urls?.length||0);
   status=scan.blocked?"Zugriff eingeschränkt":pending?pending+" Aufgaben offen":
    scan.failures?"Teilweise geprüft":"Prüfung beendet";
  }
  row.append(name,node("td",null,all.length),dataQuality,
   node("td","price",best?showEuro(best.price)+" /m²":"Preis fehlt"),
   node("td",null,status));
  tbody.append(row);
 }
 if(!tbody.children.length){const tr=node("tr"),cell=node("td",null,"Wähle mindestens einen Shop aus.");cell.colSpan=5;tr.append(cell);tbody.append(tr);}
 table.append(thead,tbody);wrap.append(table);
}
function renderQuickCategories(){
 const box=el("quickCategories");box.replaceChildren();
 const choices=[["","Alle Produkte"],...SUPPORTED_CATEGORIES.map(cat=>[cat,cat==="Vinyl"?"Vinyl / Rigid-Vinyl":cat==="Leisten"?"Fuß-/Sockelleisten":cat])];
 for(const [value,label]of choices){
  const button=btn(label,()=>{
   state.category=value;
   el("category").value=value;
   render();
  },state.category===value?"active":"secondary");
  button.classList.toggle("active",state.category===value);
  box.append(button);
 }
}
function compareSelectionChanged(){
 const chosen=state.manualCompare.length;
 setStatus(chosen<2?chosen+" von 2 Produkten für den technischen Vergleich ausgewählt.":
  "Zwei Produkte ausgewählt. Technische Eigenschaften und vorhandene Preise werden nebeneinander angezeigt.","ok");
 if(chosen===2)state.tab="comparison";
 render();
}
function toggleManualProduct(p){
 const key=p.shopId+"|"+p.url;
 const idx=state.manualCompare.findIndex(x=>x&&x.shopId+"|"+x.url===key);
 if(idx>=0)state.manualCompare.splice(idx,1);
 else{
  if(state.manualCompare.length>=2)state.manualCompare.shift();
  state.manualCompare.push({...p});
 }
 compareSelectionChanged();
}
function renderManualComparison(){
 const label=el("manualSelectionLabel"),area=el("manualComparisonHolder");
 const selected=state.manualCompare.filter(Boolean);
 const count=selected.length;
 label.textContent=count===0?"Wähle in der Produktliste zwei Artikel über „Vergleichen“ aus.":
  count===1?"1 von 2 Artikeln ausgewählt: "+selected[0].name:
  "2 Produkte zum direkten Merkmalsvergleich ausgewählt";
 area.replaceChildren();
 if(count<2){
  area.append(node("p","empty","Auch ohne €/m²-Preis möglich. Gehe zur Produktliste und wähle zwei Produkte aus."));
  return;
 }
 const a=state.manualCompare[0],b=state.manualCompare[1];
 if(!a||!b){area.append(node("p","empty","Bitte beide Seiten auswählen."));return;}
 const unitCheck=hasComparablePrice(a,b),sameCategory=a.category===b.category;
 const card=node("div","manual-card");
 const title=node("h3",null,"Manuell ausgewählter Produktvergleich");
 card.append(title);
 const info= !sameCategory?"Unterschiedliche Bodenarten – kein gleichwertiger Vergleich.":
  !unitCheck?"Einer oder beide Preise fehlen beziehungsweise besitzen unterschiedliche Einheiten. Kein Preisvorteil berechnet.":
  "Beide Preise sind pro "+a.unit+" erfasst; technische Unterschiede bitte einzeln prüfen.";
 card.append(node("p","notice",info));
 const detail=node("div","detail-box");comparisonDetail({a,b},detail);card.append(detail);
 if(unitCheck&&sameCategory){
  const difference=Math.abs(a.price-b.price);
  const cheaper=a.price===b.price?"Gleicher Preis":a.price<b.price?a.shopName+" günstiger":b.shopName+" günstiger";
  card.append(node("strong","green",cheaper+": "+showEuro(difference)+" je "+a.unit));
 }
 area.append(card);
}
function renderMetrics(items){
 const top=el("metrics");top.replaceChildren();
 const priced=items.filter(validPrice);
 const pricedShops=state.shops.filter(shop=>shop.active&&shop.items.some(validPrice)).length;
 const m=[["Bodenbeläge erfasst",items.length],["Geprüfte €/m²-Preise",priced.length],
  ["Shops ausgewählt",state.shops.filter(shop=>shop.active).length],
  ["Shops mit Preisen",pricedShops]];
 for(const [label,value] of m){
  const card=node("div","metric-card");
  card.append(node("small","muted",label),node("strong","metric-val",value));
  top.append(card);
 }
}
function renderPriceDuel(){
 const area=el("priceDuelHolder");area.replaceChildren();
 const shops=state.shops.filter(s=>s.active);
 if(!shops.length){area.append(node("div","empty","Bitte mindestens einen Shop auswählen."));return;}
 const categories=state.category&&PRICE_CATEGORIES.includes(state.category)?
  [state.category]:PRICE_CATEGORIES;
 const table=node("table","mini-table"),head=node("thead"),line=node("tr"),body=node("tbody");
 tableHeader(line,["Bodenart",...shops.map(shop=>shop.name)]);head.append(line);
 for(const category of categories){
  const row=node("tr");row.append(node("td",null,category==="Vinyl"?"Vinyl / Rigid-Vinyl":category));
  const results=shops.map(shop=>{
   const relevant=(shop.items||[]).filter(p=>p.category===category);
   const priced=relevant.filter(validPrice).sort((a,b)=>a.price-b.price);
   // Crucial: retain shops with unpriced items instead of dropping them.
   return {count:relevant.length,pricedCount:priced.length,best:priced[0]||null,
    example:priced[0]||relevant[0]||null,shop};
  });
  const known=results.filter(x=>x.best);
  const low=known.length>=2?Math.min(...known.map(x=>x.best.price)):null;
  for(const result of results){
   const cell=node("td"),{best,example}=result;
   cell.append(node("small","muted",result.count+" Artikel · "+result.pricedCount+" €/m²-Preise"));
   if(best){
    cell.append(node("strong","price",showEuro(best.price)+" /m²"));
    cell.append(node("small","muted",best.name));
    if(best.manualPrice)cell.append(node("small","stale","Vom Nutzer nachgetragen · Originalpreis prüfen"));
    if(low!==null&&best.price===low)cell.append(node("small","green","Günstigster erfasster Kategoriepreis"));
    else if(low!==null)cell.append(node("small","muted","+"+showEuro(best.price-low)+" zum Kategorie-Bestpreis"));
    cell.append(productLink(best,"Angebot prüfen ↗"));
   }else if(example){
    cell.append(node("strong","price-unknown","Noch kein geprüfter €/m²-Preis"));
    cell.append(node("small","muted","Beispiel aus "+result.shop.name+": "+example.name));
    cell.append(productLink(example,"Produkt und Preis prüfen ↗"));
    cell.append(btn("€/m²-Preis eintragen",()=>editProductPrice(result.shop,example)));
   }else{
    cell.append(node("strong","price-unknown","Noch keine Produkte erfasst"));
    cell.append(node("small","muted","Katalogscan fortsetzen"));
   }
   row.append(cell);
  }
  body.append(row);
 }
 table.append(head,body);area.append(table);
 const hint=node("p","section-note","Wichtig: Die günstigsten Produkte einer Kategorie können technisch unterschiedlich sein. Für einen Vergleich zweier konkreter Artikel die Produktauswahl darunter verwenden.");
 area.append(hint);
}
function editProductPrice(shop,product){
 if(state.busy){setStatus("Warte, bis der aktuelle Scan abgeschlossen ist.","warning");return;}
 if(!shop||!product||!isFloor(product))return;
 const current=validPrice(product)?String(product.price).replace(".",","):"";
 const entered=window.prompt("Bitte zuerst den €/m²-Preis im Originalshop prüfen.\nAktueller €/m²-Preis für:\n"+product.name+"\n\nEingabe z. B. 12,99",current);
 if(entered===null)return;
 const normalized=String(entered).trim().replace(/\s|€/g,"").replace(",",".");
 if(!/^\d{1,4}(?:\.\d{1,2})?$/.test(normalized)){
  setStatus("Preis nicht gespeichert. Bitte einen gültigen €/m²-Betrag eingeben, z. B. 12,99.","warning");return;
 }
 const amount=Number(normalized);
 if(!Number.isFinite(amount)||amount<=0||amount>=500){
  setStatus("Preis nicht gespeichert. Prüfe die Eingabe auf der Originalseite.","warning");return;
 }
 const target=(shop.items||[]).find(p=>p.url===product.url&&p.category===product.category);
 if(!target){setStatus("Artikel nicht mehr im Shop-Katalog. Bitte neu auswählen.","warning");return;}
 const label=window.confirm("Hast du "+showEuro(amount)+" pro m² für diesen Artikel gerade im Originalshop geprüft?\n"+target.name+"\n"+target.url);
 if(!label)return;
 target.price=Math.round(amount*100)/100;
 target.unit="m²";
 target.priceSource="Manuell vom Nutzer anhand des Originalshops erfasst";
 target.priceCheckedAt=new Date().toISOString();
 target.manualPrice=true;
 target.provisional=false;
 state.manualCompare=state.manualCompare.map(p=>p&&p.shopId===shop.id&&p.url===target.url?
  {...p,...target,shopId:shop.id,shopName:shop.name}:p);
 save();renderShops();render();
 setStatus("Preis für "+target.name+" als manuell geprüft gespeichert. Produktdaten erhalten.","ok");
}
function fillCompareShops(){
 const shops=state.shops.filter(s=>s.active);
 for(const side of ["A","B"]){
  const select=el("compareShop"+side);
  select.replaceChildren();
  for(const shop of shops){
   const option=node("option",null,shop.name);
   option.value=shop.id;select.append(option);
  }
  const manual=state.manualCompare[side==="A"?0:1];
  const wanted=manual?.shopId||state.compareShops[side]||
   shops[side==="A"?0:Math.min(1,shops.length-1)]?.id||"";
  select.value=shops.some(x=>x.id===wanted)?wanted:(shops[0]?.id||"");
  state.compareShops[side]=select.value;
  const query=el("compareSearch"+side);
  query.value=state.compareSearch[side]||"";
  fillCompareProducts(side);
 }
}
function fillCompareProducts(side){
 const select=el("compareProduct"+side),shopId=el("compareShop"+side).value;
 const shop=state.shops.find(s=>s.id===shopId);
 const search=String(el("compareSearch"+side).value||"").trim().toLowerCase();
 const chosen=state.manualCompare[side==="A"?0:1];
 select.replaceChildren();
 const blank=node("option",null,shop?"Produkt auswählen – bei Bedarf Suchfeld nutzen":"Bitte Shop wählen");
 blank.value="";select.append(blank);
 if(!shop){select.value="";return;}
 let found=0,matched=false;
 for(let index=0;index<shop.items.length;index++){
  const p=shop.items[index];
  if(!isFloor(p)||search&&!((p.name||"")+" "+(p.brand||"")+" "+(p.sku||"")).toLowerCase().includes(search))continue;
  const option=node("option",null,p.category+" · "+p.name+(validPrice(p)?" · "+showEuro(p.price)+"/m²":" · Preis fehlt"));
  option.value=String(index);select.append(option);
  if(chosen?.url===p.url&&chosen.shopId===shop.id){select.value=String(index);matched=true;}
  if(++found>=300)break;
 }
 if(!matched)select.value="";
 el("comparePrice"+side).disabled=!matched;
}
function selectCompareProduct(side){
 const select=el("compareProduct"+side),shopId=el("compareShop"+side).value;
 const shop=state.shops.find(s=>s.id===shopId),idx=Number(select.value);
 if(!shop||select.value===""||!Number.isInteger(idx)||!isFloor(shop.items[idx])){
  state.manualCompare[side==="A"?0:1]=null;
 }else{
  state.manualCompare[side==="A"?0:1]={...shop.items[idx],shopId:shop.id,shopName:shop.name};
 }
 el("comparePrice"+side).disabled=select.value==="";
 renderManualComparison();
}
function editSelectedComparePrice(side){
 const p=state.manualCompare[side==="A"?0:1];
 if(!p){setStatus("Bitte zuerst ein Produkt auswählen.","warning");return;}
 editProductPrice(state.shops.find(s=>s.id===p.shopId),p);
}

function tableHeader(tr,headers){for(const h of headers)tr.append(node("th",null,h));}
function renderProducts(){
 const box=el("tableHolder");box.replaceChildren();
 const table=node("table"),thead=node("thead"),tr=node("tr"),tbody=node("tbody");
 tableHeader(tr,["Produkt","Shop","Kategorie","Stärke","NK / AC","Preis","Aktion","Quelle","Auswahl"]);
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
    valid?"Stand: "+date.toLocaleDateString("de-DE")+(age>24*60*60*1000?" · älter":""):"Prüfdatum unbekannt"));
   if(p.provisional)priceCell.append(node("small","stale","Aus Katalogliste · Produkt prüfen"));
  }
  row.append(title,node("td",null,p.shopName),node("td",null,p.category),
   node("td",null,p.thickness!=null?p.thickness+" mm":"–"),
   node("td",null,[p.nk?"NK "+p.nk:null,p.ac].filter(Boolean).join(" / ")||"–"),
   priceCell,node("td",null,p.promotion||"–"));
  const source=node("td");source.append(productLink(p,"Angebot ↗"));row.append(source);
  const choice=node("td");
  const selected=state.manualCompare.some(x=>x&&x.shopId===p.shopId&&x.url===p.url);
  const action=btn(selected?"Abwählen":"Vergleichen",()=>toggleManualProduct(p),selected?"active":"secondary");
  choice.append(action);row.append(choice);tbody.append(row);
 }
 if(!tbody.children.length){const row=node("tr"),td=node("td",null,"Keine Produkte für die gewählten Filter. Prüfe die Shop-Auswahl oder starte einen Scan.");td.colSpan=9;row.append(td);tbody.append(row);}
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
 featureRow(t,"Preis je Verkaufseinheit",
  priceAvailable(pair.a)?showEuro(pair.a.price)+" /"+pair.a.unit:"Nicht erfasst",
  priceAvailable(pair.b)?showEuro(pair.b.price)+" /"+pair.b.unit:"Nicht erfasst");
 featureRow(t,"Stärke",pair.a.thickness!=null?pair.a.thickness+" mm":null,pair.b.thickness!=null?pair.b.thickness+" mm":null);
 featureRow(t,"Nutzschicht",pair.a.wear!=null?pair.a.wear+" mm":null,pair.b.wear!=null?pair.b.wear+" mm":null);
 featureRow(t,"Nutzungsklasse",pair.a.nk?("NK "+pair.a.nk):null,pair.b.nk?("NK "+pair.b.nk):null);
 featureRow(t,"Abriebklasse",pair.a.ac,pair.b.ac);
 featureRow(t,"Dämmung laut Beschreibung",pair.a.insulation?"Erwähnt":"Nicht bestätigt",pair.b.insulation?"Erwähnt":"Nicht bestätigt");
 featureRow(t,"Fußleisten laut Beschreibung",pair.a.skirting?"Erwähnt":"Nicht bestätigt",pair.b.skirting?"Erwähnt":"Nicht bestätigt");
 box.append(t,node("p","notice","Automatischer bzw. manueller Eigenschaftsvergleich, keine bestätigte Gleichwertigkeit. Unterschiedliche Stärken, Nutzschichten und Nutzungsklassen sind Merkmale – nicht automatisch Vor- oder Nachteile."));
 const row=node("div","row");
 for(const p of [pair.a,pair.b]){const a=node("a",null,p.shopName+" ↗");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";row.append(a);}
 box.append(row);
}

function renderPromos(){
 const area=el("offersHolder");area.replaceChildren();
 const list=filteredItems(true);
 if(!list.length){area.append(node("div","empty","Keine eindeutig gekennzeichneten Aktionen in der Auswahl."));return;}
 for(const p of list){
  const row=node("div","offer"),left=node("div","shop-data");
  left.append(node("strong",null,p.name),node("small","muted",p.shopName+" · "+p.category));
  const price=node("div","price");
  price.append(node("strong",null,p.price!=null?showEuro(p.price)+" /"+(p.unit||"Einheit"):"Preis unbekannt"));
  if(p.oldPrice&&p.price!=null)price.append(node("small","muted","Vergleichspreis "+showEuro(p.oldPrice)+" /"+(p.unit||"Einheit")));
  price.append(node("small","green",p.promotion));
  const a=node("a",null,"Prüfen ↗");a.href=p.url;a.target="_blank";a.rel="noopener noreferrer";
  row.append(left,price,a);area.append(row);
 }
}
function render(){
 const all=allItems();
 renderMetrics(all);renderOverview(all);renderQuickCategories();
 el("productsTab").classList.toggle("active",state.tab==="products");
 el("comparisonTab").classList.toggle("active",state.tab==="comparison");
 el("offersTab").classList.toggle("active",state.tab==="offers");
 el("productsSection").hidden=state.tab!=="products";
 el("comparisonSection").hidden=state.tab!=="comparison";
 el("offersSection").hidden=state.tab!=="offers";
 if(state.tab==="products")renderProducts();
 if(state.tab==="comparison"){renderPriceDuel();fillCompareShops();renderManualComparison();}
 if(state.tab==="offers")renderPromos();
}
function allowanceKey(){return "marktradar:requests:"+new Date().toISOString().slice(0,10);}
function remainingRequests(){
 try{return Math.max(0,FREE_DAILY_MAX-Number(localStorage.getItem(allowanceKey())||0));}
 catch(e){return 0;} // If storage is blocked, avoid unbounded usage.
}
function availableRequest(){
 if(remainingRequests()<=0)return false;
 try{
  const used=FREE_DAILY_MAX-remainingRequests();
  localStorage.setItem(allowanceKey(),String(used+1));
  return true;
 }catch(e){return false;}
}
async function api(site,action,extra){
 if(!availableRequest())throw Error("Kostenlose Sicherheitsgrenze von 1.000 Scan-Anfragen pro Browser und Tag erreicht. Morgen erneut versuchen.");
 const ctl=new AbortController(),tid=setTimeout(()=>ctl.abort(),12000);
 try{
  const res=await fetch(API_PATH,{method:"POST",
   headers:{"Content-Type":"application/json"},
   signal:ctl.signal,body:JSON.stringify(Object.assign({site,action},extra||{}))});
  const raw=await res.text();
  let data;
  try{data=JSON.parse(raw);}catch(e){throw Error("Cloudflare /api/catalog: HTTP "+res.status+" · Antwort ist kein JSON");}
  if(!res.ok)throw Error("Cloudflare /api/catalog: HTTP "+res.status+" · "+(data.error||"Abruf fehlgeschlagen"));
  return data;
 }finally{clearTimeout(tid);}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function mergeItem(map,p){
 if(!p||!p.url||!p.name||!isSupported(p))return;
 p=normalizedItem(p);
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
 shop.items=[...scan.items.values()].filter(isSupported).map(normalizedItem).slice(0,12000);
 shop.scan={jobs:scan.jobs.slice(0,12000),urls:scan.urls.slice(0,25000),
  visitedJobs:[...scan.visitedJobs].slice(-20000),visitedUrls:[...scan.visitedUrls].slice(-30000),
  engineVersion:7,pages:scan.pages,done:scan.done,failures:scan.failures,other:scan.other,
  errors:(scan.errors||[]).slice(-6),retryCounts:scan.retryCounts||{},
  unresolved:(scan.unresolved||[]).slice(-1500),
  truncated:Boolean(scan.truncated),
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
async function scanShop(shop,restart,quick=false){
 const previous=Array.isArray(shop.items)?shop.items:[];
 let saved=restart?null:shop.scan;
 // Refresh legacy crawl queues but never discard previously collected products.
 if(saved&&saved.engineVersion!==7)saved=null;
 if(!saved||(!saved.jobs?.length&&!saved.urls?.length)){
  try{
   const found=await api(shop.url,"discover");
   const jobs=found.jobs||[];
   const unpriced=previous.filter(p=>p?.url&&isSupported(p)&&!priceAvailable(normalizedItem(p))).map(p=>p.url);
   saved={engineVersion:7,
    jobs:[...jobs.filter(j=>j.type==="list"),...jobs.filter(j=>j.type!=="list")],
    urls:[...new Set([...unpriced,...(found.urls||[])])],visitedJobs:[],visitedUrls:[],
    pages:0,done:0,failures:0,other:0,errors:[],retryCounts:{},unresolved:[],truncated:false};
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
  items:new Map(previous.filter(p=>p?.url&&isSupported(p)).map(p=>[p.url,normalizedItem(p)])),
  retryCounts:{...(saved.retryCounts||{})},
  unresolved:Array.isArray(saved.unresolved)?saved.unresolved.slice(-1500):[],
  errors:Array.isArray(saved.errors)?saved.errors.slice(-6):[],
  blocked:false
 };
 const maxJobs=quick?6:14,maxDetails=quick?12:30,maxMillis=quick?30000:85000;
 const start=Date.now();
 let jobsDone=0,detailsDone=0,processed=0;
 const progress=()=>{
  const priced=[...scan.items.values()].filter(validPrice).length;
  el("progress").textContent=shop.name+": "+scan.items.size+" Artikel, "+
    priced+" €/m²-Preise, "+scan.done+" Produktseiten geprüft, "+
    (scan.jobs.length+scan.urls.length)+" Aufgaben offen, "+
    scan.failures+" Abrufprobleme"+(scan.unresolved?.length?" · "+scan.unresolved.length+" nicht prüfbar":"")+
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
  Date.now()-start<maxMillis&&!scan.blocked&&!state.stopRequested){
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
      if(data.hasMore&&job.page<100)scan.jobs.push({type:"shopify",page:job.page+1});
      if(data.hasMore&&job.page>=100)scan.truncated=true;
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
     // Shopify products.json is an optional shortcut. A rejected feed does
     // not mean the ordinary product pages are inaccessible.
     if(job.type==="shopify"){
      scan.visitedJobs.add(key);
     }else if(label==="Seite nicht gefunden"&&["map","robots"].includes(job.type)){
      scan.visitedJobs.add(key);
     }else{
      fail(e,job.type);
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
      const url=failure.url,reason=failure.reason||"Produkt nicht abrufbar";
      if(/Kategorie|Bodenbelag/i.test(reason)){scan.other++;continue;}
      const label=errorKind(reason);
      const times=(scan.retryCounts[url]||0)+1;
      scan.retryCounts[url]=times;
      if(["Zugriff verweigert","Anfragen begrenzt","Gratislimit erreicht"].includes(label)){
       fail(reason,"detail");
       scan.urls.unshift(url);scan.visitedUrls.delete(url);
      }else if(times<3&&label!=="Seite nicht gefunden"){
       // Transport/parse errors get two further attempts, saved across scans.
       scan.urls.push(url);scan.visitedUrls.delete(url);
      }else{
       fail(reason,"detail");
       if(!scan.unresolved.includes(url))scan.unresolved.push(url);
      }
     }
    }catch(e){
     const label=errorKind(e);
     if(["Zugriff verweigert","Anfragen begrenzt","Gratislimit erreicht"].includes(label)){
      fail(e,"detail");
     }
     for(const url of batch.reverse()){
      const times=(scan.retryCounts[url]||0)+1;
      scan.retryCounts[url]=times;
      if(scan.blocked||times<3){
       scan.urls.unshift(url);scan.visitedUrls.delete(url);
      }else{
       if(!scan.unresolved.includes(url))scan.unresolved.push(url);
       fail(e,"detail");
      }
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
  count:scan.items.size,priced,unpriced:Math.max(0,scan.items.size-priced),
  unresolved:scan.unresolved.length,remaining,failed:scan.failures,
  diagnostic:scan.items.size===0?"Keine auslesbaren Bodenbelag-Produkte gefunden; Katalog kann gesperrt oder dynamisch sein":
    scan.errors.slice(-2).join("; "),blocked:scan.blocked};
}
async function scanAll(restart,deep=false,full=false){
 if(state.busy)return;
 const shops=state.shops.filter(shop=>shop.active);
 if(!shops.length){setStatus("Bitte mindestens einen Shop auswählen.","warning");return;}
 state.busy=true;state.stopRequested=false;renderShops();el("progress").hidden=false;
 const outcomes=new Map();
 const completed=new Set();
 const rounds=full?120:deep?12:1;
 const overallStart=Date.now();
 const maxSessionMs=full?900000:deep?210000:60000;
 try{
  // Round robin: every selected shop gets the same crawl budget per stage.
  for(let round=0;round<rounds&&Date.now()-overallStart<maxSessionMs&&!state.stopRequested;round++){
   for(const shop of shops){
    if(Date.now()-overallStart>=maxSessionMs||state.stopRequested)break;
    if(completed.has(shop.id))continue;
    if(remainingRequests()<6){
     outcomes.set(shop.id,shop.name+": Tagesbudget aufgebraucht; erfasste Artikel bleiben erhalten.");
     completed.add(shop.id);continue;
    }
    setStatus(shop.name+": "+(full?"Vollscan":deep?"Vertiefter Scan":"Schnellscan")+
      " · Durchgang "+(round+1)+"/"+rounds+
      ". Erfasste Daten werden laufend gespeichert. Bei Sperren und Gratisgrenzen wird pausiert.","normal");
    try{
     const result=await scanShop(shop,restart&&round===0,!deep);
     outcomes.set(shop.id,shop.name+": "+result.count+" erfasste Artikel, "+
       result.priced+" €/m²-Preise"+
       (result.blocked?" · Zugriff eingeschränkt":
        result.complete?" · erreichbare Aufgaben erledigt":" · Scan unvollständig")+
       (result.unpriced?" · "+result.unpriced+" Artikel ohne verifizierten Preis":"")+
       (result.unresolved?" · "+result.unresolved+" Produktseiten nicht prüfbar":"")+
       (result.remaining?" · "+result.remaining+" Aufgaben offen":"")+
       (result.diagnostic?" · "+result.diagnostic:""));
     if(result.blocked||result.complete||result.remaining===0)completed.add(shop.id);
    }catch(e){
     outcomes.set(shop.id,shop.name+": Fehler („"+e.message+"“)");
     completed.add(shop.id);
    }
   }
   if(full&&!completed.size)await delay(350);
   if(completed.size===shops.length)break;
  }
  setStatus(shops.map(s=>outcomes.get(s.id)||s.name+": noch nicht geprüft").join(" | ")+
   ". Offene Aufgaben mit „Scan vertiefen / fortsetzen“ erneut prüfen. Produktpreise vor Vertriebsaussagen kontrollieren.","normal");
 }finally{state.busy=false;state.stopRequested=false;renderShops();render();}
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
loadAppearance();
el("appearanceButton").onclick=()=>{el("appearancePanel").hidden=!el("appearancePanel").hidden;};
el("editorSave").onclick=saveAppearance;
el("editorReset").onclick=()=>{
 appearance={...STANDARD_STYLE};
 try{localStorage.removeItem(APPEARANCE_KEY);}catch(e){}
 updateAppearance();setStatus("Standarddarstellung wiederhergestellt.","ok");
};
el("clearCompare").onclick=()=>{state.manualCompare=[];render();};
for(const side of ["A","B"]){
 el("compareShop"+side).onchange=()=>{
  state.compareShops[side]=el("compareShop"+side).value;
  state.manualCompare[side==="A"?0:1]=null;
  fillCompareProducts(side);renderManualComparison();
 };
 el("compareSearch"+side).oninput=()=>{
  state.compareSearch[side]=el("compareSearch"+side).value;
  fillCompareProducts(side);
 };
 el("compareProduct"+side).onchange=()=>selectCompareProduct(side);
 el("comparePrice"+side).onclick=()=>editSelectedComparePrice(side);
}
el("diagnoseButton").onclick=runDiagnostics;
el("addButton").onclick=addShop;
el("scanButton").onclick=()=>scanAll(false,false);
el("deepScanButton").onclick=()=>scanAll(false,true);
el("fullScanButton").onclick=()=>scanAll(false,true,true);
el("stopScanButton").onclick=()=>{state.stopRequested=true;setStatus("Scan wird nach dem aktuellen Abruf angehalten. Daten bleiben gespeichert.","normal");};
el("resetButton").onclick=()=>{if(window.confirm("Neu starten? Bereits gespeicherte Artikel bleiben vorhanden.")){state.shops.filter(s=>s.active).forEach(s=>s.scan=null);scanAll(true,false);}};
el("exportButton").onclick=downloadJson;
async function copyFilteredTable(){
 const rows=filteredItems();
 if(!rows.length){setStatus("Keine Produkte im aktuellen Filter zum Kopieren.","warning");return;}
 const safeCell=v=>String(v??"").replace(/\s+/g," ").trim().replace(/^[=+\-@\t\r]/,match=>"'"+match);
 const fields=[["Produkt",p=>p.name],["Shop",p=>p.shopName],
  ["Kategorie",p=>p.category],["Preis",p=>p.price??""],
  ["Einheit",p=>p.unit||""],["Stärke mm",p=>p.thickness??""],
  ["Nutzungsklasse",p=>p.nk||""],["Abriebklasse",p=>p.ac||""],
  ["Werbeaktion",p=>p.promotion||""],["Letzte Preisprüfung",p=>p.priceCheckedAt||p.checkedAt||""],
  ["Produktlink",p=>p.url]];
 const data=[fields.map(f=>f[0]).join("\t"),...rows.map(p=>fields.map(f=>safeCell(f[1](p))).join("\t"))].join("\n");
 try{
  await navigator.clipboard.writeText(data);
  setStatus(rows.length+" gefilterte Zeilen kopiert. Du kannst sie jetzt in Excel Online einfügen.","ok");
 }catch(e){setStatus("Die Browser-Berechtigung zum Kopieren wurde verweigert. Bitte Clipboard-Zugriff erlauben.","warning");}
}

el("copyButton").onclick=copyFilteredTable;
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