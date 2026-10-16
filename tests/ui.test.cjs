"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("app.js","utf8");
const html=fs.readFileSync("index.html","utf8");

class Element {
 constructor(tag="div",id=""){
  this.tagName=tag;this.id=id;this.children=[];this.dataset={};this.value="";
  this.hidden=false;this.textContent="";this.listeners={};this.checked=false;this.disabled=false;
  this.style={setProperty:(key,value)=>{this.styles??={};this.styles[key]=value;}};
  this.classList={toggle:(key,enabled)=>{this.classes??={};this.classes[key]=enabled;},add:()=>{}};
 }
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 addEventListener(type,cb){this.listeners[type]=cb;}
 click(){if(this.onclick)return this.onclick();if(this.listeners.click)return this.listeners.click();}
}
function makeProduct(name,price,url){
 return {name,price,category:"Laminat",unit:"m²",url,thickness:8,nk:"32",ac:"AC4",
  brand:"Demo",sku:"",checkedAt:new Date().toISOString()};
}
function boot(withProducts=true){
 const ids=[...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 const elements=new Map(ids.map(id=>[id,new Element("div",id)]));
 const document={
  getElementById:id=>{
   if(!elements.has(id))throw Error("Missing HTML element "+id);
   return elements.get(id);
  },
  createElement:tag=>new Element(tag),
  documentElement:new Element("html"),
  title:""
 };
 const shops=[
  {id:"dep",name:"Laminat DEPOT",url:"https://laminatdepot.de/",active:true,scan:null,
   items:withProducts?[makeProduct("Laminat Eiche Natur 8 mm",null,"https://laminatdepot.de/eiche")]:[]},
  {id:"sh24",name:"Laminat-Shop24",url:"https://laminat-shop24.com/",active:true,scan:null,
   items:withProducts?[makeProduct("Laminat Eiche Natur 8 mm",13.99,"https://laminat-shop24.com/products/eiche")]:[]}
 ];
 const values=new Map([["marktradar:catalog:v3",JSON.stringify({shops,tab:"products"})]]);
 const localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const window={prompt:()=>null,confirm:()=>true};
 const exposed=source.replace(/\}\)\(\);\s*$/,
  'window.__marketRadarTest={state,render,renderPriceDuel,renderManualComparison,save,editProductPrice,fillCompareShops};})();');
 new Function("document","window","localStorage","navigator",exposed)(
  document,window,localStorage,{clipboard:{}});
 return {window,state:window.__marketRadarTest.state,api:window.__marketRadarTest,
  elements,localStorage,document,values};
}
test("Dashboard boots with available shop products and no network requests",()=>{
 const app=boot();
 assert.equal(app.elements.get("bestPriceGrid").children.length,3);
 assert.equal(app.elements.get("shopCoverage").children.length,1);
 assert.equal(app.state.shops.length,2);
});
test("Category price duel shows missing prices instead of invented advantages",()=>{
 const app=boot();
 app.state.tab="comparison";
 app.api.render();
 const holder=app.elements.get("priceDuelHolder");
 assert.equal(holder.children.length,1);
 const textContent=node=>[node.textContent||"",...(node.children||[]).map(textContent)].join(" ");
 const content=textContent(holder);
 assert.match(content,/Kein Preis erfasst/);
 assert.match(content,/13,99/);
 assert.doesNotMatch(content,/direkt vergleichbar|Vergleichsvorschläge/i);
});

test("Manual comparison works with an unpriced Laminat DEPOT product",()=>{
 const app=boot();
 const products=app.state.shops;
 app.state.manualCompare=[
  {...products[0].items[0],shopId:"dep",shopName:"Laminat DEPOT"},
  {...products[1].items[0],shopId:"sh24",shopName:"Laminat-Shop24"}
 ];
 app.state.tab="comparison";
 app.api.render();
 assert.equal(app.elements.get("manualComparisonHolder").children.length,1);
 assert.match(app.elements.get("manualSelectionLabel").textContent,/2 Produkte/);
});
test("Heading and color settings are saved without changing catalog storage",()=>{
 const app=boot();
 const before=app.values.get("marktradar:catalog:v3");
 app.elements.get("editorTitle").value="Mein Vertriebs-Dashboard";
 app.elements.get("editorBrand").value="DEPOT · MARKTRADAR";
 app.elements.get("editorSubtitle").value="Aktuelle Bodenbeläge";
 app.elements.get("editorAccent").value="#c51f32";
 app.elements.get("editorTheme").value="#15233a";
 app.elements.get("editorSave").click();
 assert.equal(app.elements.get("pageHeading").textContent,"Mein Vertriebs-Dashboard");
 assert.equal(app.values.get("marktradar:catalog:v3"),before);
 assert.ok(app.values.get("marktradar:appearance:v1"));
});
test("Fast and deep scan controls exist without modifying the API",()=>{
 const app=boot(false);
 assert.match(html,/id="deepScanButton"/);
 assert.match(html,/id="scanButton"/);
 assert.equal(typeof app.elements.get("deepScanButton").onclick,"function");
 assert.equal(typeof app.elements.get("fullScanButton").onclick,"function");
 assert.equal(typeof app.elements.get("stopScanButton").onclick,"function");
 assert.match(source,/const API_PATH="\/api\/catalog"/);
});
test("Cloudflare dist assets always match the current source",()=>{
 assert.equal(fs.readFileSync("dist/index.html","utf8"),html);
 assert.equal(fs.readFileSync("dist/app.js","utf8"),source);
});

test("All shops share the same bounded scanner and old products remain in storage",()=>{
 const app=boot();
 assert.match(source,/engineVersion:7/);
 assert.match(source,/for\(let round=0;round<rounds&&/);
 assert.match(source,/for\(const shop of shops\)/);
 assert.equal(app.state.shops[0].items.length,1);
 assert.equal(app.state.shops[1].items.length,1);
 assert.match(source,/const KEY="marktradar:catalog:v3"/);
});


test("Only three flooring categories appear in dropdown and radar",()=>{
 const app=boot();
 assert.equal(app.elements.get("bestPriceGrid").children.length,3);
 assert.match(html,/Vinyl \/ Rigid-Vinyl/);
 assert.doesNotMatch(html,/<option[^>]*>Teppich<\/option>/i);
 assert.doesNotMatch(html,/<option[^>]*>PVC<\/option>/i);
 assert.doesNotMatch(html,/<option[^>]*>Zubehör<\/option>/i);
 assert.doesNotMatch(html,/<option[^>]*>Bioboden/i);
 assert.doesNotMatch(html,/<option[^>]*value="Leisten"/);
});
test("Legacy unsupported products remain saved but are excluded from dashboards",()=>{
 const app=boot();
 const shop=app.state.shops[0];
 shop.items.push({name:"PVC-Boden",url:"https://laminatdepot.de/pvc",price:4.99,unit:"m²",category:"PVC"});
 shop.items.push({name:"Teppich",url:"https://laminatdepot.de/teppich",price:2.99,unit:"m²",category:"Teppich"});
 app.api.render();
 const metrics=app.elements.get("metrics");
 const text=el=>[el.textContent||"",...(el.children||[]).map(text)].join(" ");
 assert.match(text(metrics),/2/);
 assert.doesNotMatch(text(app.elements.get("bestPriceGrid")),/2,99/);
 assert.equal(shop.items.length,3); // historical storage is retained
});

test("More than 300 floor products remain in browser storage without IndexedDB",()=>{
 const app=boot();
 const template=app.state.shops[0].items[0];
 app.state.shops[0].items=Array.from({length:340},(_,i)=>({...template,
  name:"Laminat Eiche "+i,url:"https://laminatdepot.de/laminat-eiche-"+i,
  price:i%2?15.99:null}));
 app.api.save();
 const saved=JSON.parse(app.values.get("marktradar:catalog:v3"));
 assert.equal(saved.shops[0].items.length,340);
 app.api.render();
 assert.equal(app.elements.get("bestPriceGrid").children.length,3);
});

test("Browser full scan is bounded, resumable and supports stopping",()=>{
 const app=boot();
 assert.match(source,/const rounds=full\?120:deep\?12:1/);
 assert.match(source,/const maxSessionMs=full\?900000:/);
 assert.match(source,/if\(Date\.now\(\)-overallStart>=maxSessionMs\|\|state\.stopRequested\)break/);
 app.state.busy=true;
 app.elements.get("stopScanButton").click();
 assert.equal(app.state.stopRequested,true);
});
test("Unpriced saved products will be revisited in scanner v5",()=>{
 assert.match(source,/previous\.filter\(p=>p\?\.url&&isFloor\(p\)&&!validPrice\(p\)\)/);
 assert.match(source,/urls:\[\.\.\.new Set\(\[\.\.\.unpriced,/);
 assert.match(source,/if\(saved&&saved\.engineVersion!==7\)saved=null/);
});

test("An unavailable optional Shopify feed never counts as a shop-wide failure",()=>{
 assert.match(source,/if\(job\.type==="shopify"\)\{\s*scan\.visitedJobs\.add\(key\);/);
 assert.match(source,/optional shortcut/);
});
test("Failed product pages are retried but ultimately counted as unresolved",()=>{
 assert.match(source,/scan\.retryCounts\[url\]=times/);
 assert.match(source,/times<3/);
 assert.match(source,/scan\.unresolved\.push\(url\)/);
 assert.match(source,/Produktseiten nicht prüfbar/);
});


test("Price radar keeps Laminat DEPOT visible even with zero €/m² prices",()=>{
 const app=boot();
 app.state.tab="comparison";
 app.api.render();
 const text=el=>[el.textContent||"",...(el.children||[]).map(text)].join(" ");
 const all=text(app.elements.get("priceDuelHolder"));
 assert.match(all,/Laminat DEPOT/);
 assert.match(all,/Laminat-Shop24/);
 assert.match(all,/Noch kein geprüfter €/m²-Preis/);
 assert.match(all,/13,99/);
 assert.match(all,/Produkt und Preis prüfen/);
});
test("Explicit comparison shop selectors list both shops even without price",()=>{
 const app=boot();
 app.state.tab="comparison";app.api.render();
 const left=app.elements.get("compareShopA"),right=app.elements.get("compareShopB");
 assert.equal(left.value,"dep");
 assert.equal(right.value,"sh24");
 assert.equal(app.elements.get("compareProductA").children.length,2);
 assert.equal(app.elements.get("compareProductB").children.length,2);
 assert.equal(typeof app.elements.get("comparePriceA").onclick,"function");
});
test("Manually verified price survives in the existing catalog and no other product changes",()=>{
 const app=boot();
 const product=app.state.shops[0].items[0];
 app.window.prompt=()=>"12,99";
 app.window.confirm=()=>true;
 const original=app.state.shops[1].items[0].price;
 app.api.editProductPrice(app.state.shops[0],product);
 assert.equal(product.price,12.99);
 assert.equal(product.unit,"m²");
 assert.equal(product.manualPrice,true);
 assert.match(product.priceSource,/Manuell/);
 assert.equal(app.state.shops[1].items[0].price,original);
 assert.equal(JSON.parse(app.values.get("marktradar:catalog:v3")).shops[0].items[0].price,12.99);
});
test("Invalid or unconfirmed user price does not modify product catalog",()=>{
 const app=boot();
 const product=app.state.shops[0].items[0];
 app.window.prompt=()=>"abc";
 app.api.editProductPrice(app.state.shops[0],product);
 assert.equal(product.price,null);
 app.window.prompt=()=>"12,99";app.window.confirm=()=>false;
 app.api.editProductPrice(app.state.shops[0],product);
 assert.equal(product.price,null);
});
test("Design studio changes custom text/colors without overwriting saved shops",()=>{
 const app=boot();
 const before=app.values.get("marktradar:catalog:v3");
 app.elements.get("editorTitle").value="Meine Marktübersicht";
 app.elements.get("editorOverviewText").value="Alle Preise auf einen Blick";
 app.elements.get("editorBackground").value="#fff2f1";
 app.elements.get("editorTextColor").value="#123456";
 app.elements.get("editorSave").click();
 assert.equal(app.elements.get("pageHeading").textContent,"Meine Marktübersicht");
 assert.equal(app.elements.get("overviewTagline").textContent,"Alle Preise auf einen Blick");
 assert.equal(app.values.get("marktradar:catalog:v3"),before);
 assert.equal(JSON.parse(app.values.get("marktradar:appearance:v1")).ink,"#123456");
});
test("Unsupported old skirting data remains archived but is absent in visible dashboard",()=>{
 const app=boot();
 const shop=app.state.shops[0];
 shop.items.push({name:"Sockelleiste Eiche",category:"Leisten",price:9.99,unit:"Stück",
  url:"https://laminatdepot.de/sockelleiste"});
 app.api.render();
 const text=el=>[el.textContent||"",...(el.children||[]).map(text)].join(" ");
 assert.doesNotMatch(text(app.elements.get("bestPriceGrid")),/9,99/);
 assert.doesNotMatch(text(app.elements.get("priceDuelHolder")),/Sockelleiste/);
 assert.equal(shop.items.length,2);
});
