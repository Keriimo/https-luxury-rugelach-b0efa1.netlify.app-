// Cloudflare Pages Functions — free-plan catalog scanner.
// Each call fetches at most two remote pages. No paid API, billing or secrets.
const VERSION = "5.3.0-free";
const MAX_HTML = 1500000;
const clean=s=>String(s??"").replace(/\s+/g," ").trim();
const trim=s=>clean(s).slice(0,180);
function number(value){
 if(value===undefined||value===null)return null;
 const text=clean(value).replace(/[€\s]/g,"");
 const n=Number(text.includes(",")?text.replace(/\./g,"").replace(",","."):text);
 return Number.isFinite(n)&&n>0?n:null;
}
function safeShop(input){
 if(typeof input!=="string"||input.length>500)throw Error("Ungültige Shopadresse");
 let u;
 try{u=new URL(input.includes("://")?input:"https://"+input);}catch(e){throw Error("Shopadresse nicht lesbar");}
 const h=u.hostname.toLowerCase().replace(/^www\./,"");
 if(u.protocol!=="https:"||u.username||u.password||u.port ||
  !/^([a-z0-9-]+\.)+[a-z]{2,63}$/.test(h)||
  h.endsWith(".local")||h.endsWith(".internal")||h.endsWith(".test")||
  h.endsWith(".invalid")||h.endsWith(".example")||h.endsWith(".localhost")||
  h.endsWith(".onion")||h.endsWith(".pages.dev")||h.endsWith(".workers.dev")||
  h.endsWith(".nip.io")||h.endsWith(".sslip.io")||h.endsWith(".localtest.me"))
  throw Error("Nur öffentliche HTTPS-Shopdomains erlaubt");
 return {host:h,root:"https://"+u.hostname+"/",start:"https://"+u.hostname+u.pathname+u.search};
}
function checkedLink(site,raw,from){
 let url;
 try{url=new URL(raw,from||site.root);}catch(e){return null;}
 if(url.protocol!=="https:"||url.username||url.password||url.port||
   url.hostname.toLowerCase().replace(/^www\./,"")!==site.host)return null;
 url.hash="";
 ["utm_source","utm_medium","utm_campaign","gclid","fbclid"].forEach(k=>url.searchParams.delete(k));
 return url.href;
}
async function getText(site,url){
 let next=checkedLink(site,url),response;
 if(!next)throw Error("URL gehört nicht zu diesem Shop");
 for(let redirect=0;redirect<3;redirect++){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
   response=await fetch(next,{redirect:"manual",signal:controller.signal,
    headers:{"Accept":"text/html,application/xhtml+xml,application/json,application/xml,text/xml",
    "Accept-Language":"de-DE,de;q=0.9,en;q=0.7",
    "User-Agent":"Mozilla/5.0 (compatible; MarktRadar/5.0; price comparison)"}});
  }catch(e){clearTimeout(timeout);throw Error(e.name==="AbortError"?"Zeitüberschreitung":trim(e.message));}
  clearTimeout(timeout);
  if(response.status>=300&&response.status<400){
   const to=checkedLink(site,response.headers.get("location")||"",next);
   if(!to)throw Error("Weiterleitung auf anderen Anbieter blockiert");
   next=to;continue;
  }
  if(!response.ok)throw Error("HTTP "+response.status);
  const ct=response.headers.get("content-type")||"";
  if(ct&&!/(?:html|xml|json|text)/i.test(ct))throw Error("Kein lesbares Dokument");
  const size=Number(response.headers.get("content-length")||0);
  if(size>MAX_HTML)throw Error("Katalogseite zu groß");
  // Stream the body with a firm byte limit, including chunked responses.
  // Do not silently truncate an XML or JSON catalog into misleading data.
  const reader=response.body?.getReader();
  if(!reader){
   const body=await response.text();
   if(body.length>MAX_HTML)throw Error("Shopseite zu groß");
   return {url:next,body};
  }
  const decoder=new TextDecoder(),fragments=[];
  let bytes=0;
  while(true){
   const chunk=await reader.read();
   if(chunk.done)break;
   bytes+=chunk.value.byteLength;
   if(bytes>MAX_HTML){
    await reader.cancel().catch(()=>{});
    throw Error("Shopseite zu groß (Gratislimit pro Abruf)");
   }
   fragments.push(decoder.decode(chunk.value,{stream:true}));
  }
  fragments.push(decoder.decode());
  return {url:next,body:fragments.join("")};
 }
 throw Error("Zu viele Weiterleitungen");
}
const decode=s=>String(s||"").replace(/&(?:amp|quot|apos|nbsp|lt|gt);|&#(\d+);/gi,(m,d)=>{
 if(d)return String.fromCharCode(Number(d));
 return {"&amp;":"&","&quot;":'"',"&apos;":"'","&nbsp;":" ","&lt;":"<","&gt;":">"}[m.toLowerCase()]||m;
});
const strip=html=>clean(decode(String(html||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi," ")
  .replace(/<[^>]*>/g," ")));
function typeOf(text){
 const t=clean(text).toLowerCase();
 if(/^(?:sockel|fußleiste|fussleiste|dämmung|trittschall|unterlage|profil|kleber|reiniger|zubehör)/.test(t))return "Zubehör";
 if(/parkett|massivholz|fertigparkett|schiffsboden/.test(t))return "Parkett";
 if(/laminat/.test(t))return "Laminat";
 if(/vinyl|spc\b|lvt\b|rigid|designboden|klick.?vinyl|klebe.?vinyl/.test(t))return "Vinyl";
 if(/bioboden|bio-boden|linoleum|kork/.test(t))return "Bioboden & Kork";
 if(/teppichboden|teppichfliese|nadelfilz/.test(t))return "Teppich";
 if(/pvc.?boden|pvc.?belag|cv.?belag/.test(t))return "PVC";
 if(/sockel|fußleiste|fussleiste|trittschall|dämmunterlage|dämmung|unterlage|kleber|profil|zubehör/.test(t))return "Zubehör";
 if(/bodenbelag|bodenplatte|bodenpaneel|flooring/.test(t))return "Sonstige Bodenbeläge";
 return null;
}
function nameClean(text){return trim(text).replace(/^[45][,.]\d\s*\(\d+\)\s*/,"").slice(0,160);}
function attrs(text,name){
 const t=(name+" "+text).slice(0,20000);
 const thick=t.match(/(?:Stärke|Gesamtdicke|Dicke)\s*:?\s*(\d+(?:[,.]\d+)?)\s*mm/i)
   ||t.match(/(\d+(?:[,.]\d+)?)\s*mm\s*(?:stark|dick|Stärke)/i)
   ||name.match(/(\d+(?:[,.]\d+)?)\s*mm/i);
 const wear=t.match(/Nutzschicht(?:stärke)?\s*:?\s*(\d+(?:[,.]\d+)?)\s*mm/i);
 const nk=t.match(/(?:NK|Nutzungsklasse)\s*:?\s*(\d{2})\b/i);
 const ac=t.match(/\bAC\s*([3-6])\b/i);
 const pack=t.match(/(?:Paketinhalt|Paketfläche|Paket\s*enthält|Inhalt(?:\s*je\s*Paket)?)\s*:?\s*(\d+(?:[,.]\d+)?)\s*(?:m²|m2|qm)/i);
 return {thickness:thick?number(thick[1]):null,wear:wear?number(wear[1]):null,
  nk:nk?nk[1]:null,ac:ac?"AC"+ac[1]:null,packM2:pack?number(pack[1]):null,
  insulation:/inklusive\s+(?:trittschall)?dämmung|mit\s+trittschalldämmung/i.test(t),
  skirting:/inklusive\s+(?:fuß|fuss|sockel)leiste/i.test(t)};
}
function meterPrice(text,structured,pack){
 const t=clean(text).slice(0,55000);
 const patterns=[
  /(?:Aktionspreis|Angebotspreis|Preis|Grundpreis)\s*(?:pro\s*)?(?:m²|m2|qm)\s*[:|–\-\s]*(\d{1,4}(?:[,.]\d{2}))\s*€/gi,
  /(\d{1,4}(?:[,.]\d{2}))\s*€\s*(?:\/|je|pro)\s*(?:m²|m2|qm)/gi,
  /(?:m²|m2|qm)\s*[:|]\s*(\d{1,4}(?:[,.]\d{2}))\s*€/gi
 ];
 const valid=[];
 for(const regex of patterns){
  for(const match of t.matchAll(regex)){
   const context=t.slice(Math.max(0,match.index-90),match.index).split("€").pop();
   // Old prices, savings and "from" prices are not confirmed current offers.
   if(/(?:statt|uvp|alter(?:\s+preis)?(?:\s+pro(?:\s*(?:m²|m2|qm))?)?|ersparnis|du\s+sparst|sie\s+sparen|gespart|ab)\s*:?\s*$/i.test(context))continue;
   const candidate=number(match[1]);
   if(candidate&&candidate<2500)valid.push({price:candidate,at:match.index});
  }
 }
 valid.sort((a,b)=>a.at-b.at);
 let price=valid[0]?.price??null,unit="m²",priceSource=price!==null?"ausgewiesener €/m²-Preis":null;
 if(price===null&&structured?.offers){
  const offers=Array.isArray(structured.offers)?structured.offers:[structured.offers];
  const offer=offers.find(o=>o&&typeof o==="object"&&
    number(o.price||o.lowPrice||o.priceSpecification?.price))||{};
  const amount=number(offer.price||offer.lowPrice||offer.priceSpecification?.price);
  const unitLabel=clean(offer.priceSpecification?.unitCode||offer.priceSpecification?.unitText||"");
  if(amount&&/^(MTK|m2|m²|qm)$/i.test(unitLabel)){
   price=amount;priceSource="strukturierter Quadratmeterpreis";
  }else if(amount&&pack&&pack>=0.1&&pack<=15){
   price=Math.round(amount/pack*100)/100;priceSource="Paketpreis durch Paketfläche";
  }else if(amount&&/^(C62|PCE|Stück)$/i.test(unitLabel)&&typeOf(t)==="Zubehör"){
   price=amount;unit="Stück";priceSource="strukturierter Stückpreis";
  }
 }
 // Compare old and current prices only when the reference explicitly shares the same unit.
 const oldMatch=unit==="m²"?t.match(/(?:UVP|statt|alter\s+preis)\s*:?\s*(\d{1,4}(?:[,.]\d{2}))\s*€\s*(?:\/|pro)\s*(?:m²|m2|qm)/i):null;
 const oldCandidate=oldMatch?number(oldMatch[1]):null;
 const oldPrice=price!==null&&oldCandidate>price?oldCandidate:null;
 const discountPct=oldPrice?Math.round((1-price/oldPrice)*100):null;
 const promoText=/(Aktionspreis|Angebotspreis|\bRabatt\b|\breduziert\b|\bRestposten\b)/i.test(t.slice(0,700));
 const promotion=promoText?"Aktionshinweis":oldPrice?"Ausgewiesener Vergleichspreis":"";
 return {price,unit,priceSource,oldPrice,discountPct,promotion};
}
function productJson(html){
 const scripts=html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
 for(const source of scripts.slice(0,10)){
  try{
   const raw=source.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"").trim();
   const data=JSON.parse(raw),items=[data];
   let seen=0;
   while(items.length&&seen++<50){
    const item=items.shift();
    if(!item||typeof item!=="object")continue;
    if(Array.isArray(item)){items.push(...item.slice(0,50));continue;}
    const typ=String(item["@type"]||"").toLowerCase();
    if(typ.includes("product"))return item;
    if(item["@graph"])items.push(item["@graph"]);
    if(item.itemListElement)items.push(item.itemListElement);
    if(item.item)items.push(item.item);
   }
  }catch(e){}
 }
 return null;
}
function detail(html,site,url){
 const ld=productJson(html);
 const h=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
 const og=html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i);
 const title=nameClean(ld?.name||strip(h?.[1])||decode(og?.[1])||"");
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
 const content=main?main[1]:html.slice(Math.max(0,html.indexOf(h?.[0]||"")||0));
 const text=strip(content).slice(0,65000);
 const category=typeOf(title)||typeOf([ld?.category||"",ld?.description||"",text.slice(0,450)].join(" "));
 if(!title||title.length<5||!category)return null;
 const extra=attrs(text,title),price=meterPrice(text,ld,extra.packM2);
 if(price.price===null&&extra.packM2){
  const packageAmount=text.match(/Paketpreis\s*:?\s*(\d{1,4}(?:[,.]\d{2}))\s*€[^\d]{0,25}(?:\||\s)\s*Inhalt\s*:?\s*(\d+(?:[,.]\d+)?)\s*m²/i);
  if(packageAmount&&number(packageAmount[2])===extra.packM2&&extra.packM2>=0.1&&extra.packM2<=15){
   price.price=Math.round(number(packageAmount[1])/extra.packM2*100)/100;
   price.priceSource="Paketpreis / Paketfläche (berechnet)";
  }
 }
 return {name:title,url,category,...extra,...price,brand:trim(ld?.brand?.name||""),
  sku:trim(ld?.sku||ld?.gtin13||ld?.gtin||""),sourcePage:url,
  checkedAt:new Date().toISOString(),verified:price.price!==null};
}
function isProduct(url){
 const path=new URL(url).pathname.toLowerCase();
 if(/\/(?:products?|produkte?|artikel|detail|items?|p)\//i.test(path))return true;
 if(/\/[^/]+\.html?$/i.test(path))return true;
 if(/\/(?:laminat|parkett|vinylboeden?|designboden|bodenbelag|zubehoer)\/[^/]{12,}/i.test(path))return true;
 // Flat SEO product routes are common in floor shops (e.g. /laminat-eiche-100013100).
 const slug=path.split("/").filter(Boolean).pop()||"";
 if(/^((?:klick|klebe)[-_]?)?(?:laminat|vinyl|parkett|designboden|bioboden|korkboden|teppichboden|pvc|bodenbelag|boden)-[a-z0-9%-]{8,}/i.test(slug)&&
  /(?:[-_]\d{5,12}|[-_][a-z0-9]{6,})$/i.test(slug))return true;
 return false;
}
function isCategory(url,label){
 const u=new URL(url);
 const path=u.pathname.toLowerCase().replace(/\/+$/,"");
 const segments=path.split("/").filter(Boolean);
 if(segments.length>3)return false;
 const cat=/(?:^|[-_/])(?:alleboeden|alle-boeden|alle-produkte|laminat|vinylboeden|vinylboden|parkett|bodenbelaege|bodenbelage|boeden|böden|designboden|bioboeden|bioboden|kork|zubehoer|zubehör|teppichboden|angebote|bodenoutlet|sale)(?:$|[-_/])/i;
 if(cat.test(path)&&!isProduct(url))return true;
 if(/\/collections\/[^/]+$/i.test(path))return true;
 if(segments.length<=2&&/^(?:laminat|vinylböden?|vinylboden|parkett|bioboden|alle böden|alle produkte|zubehör|teppich|bodenbeläge|angebote|sale)$/i.test(clean(label)))return true;
 return false;
}
function listingProduct(href,label){
 const title=nameClean(label.split(/\s+(?:statt|Komplett-Set|Komplettpreis|Du sparst|Paketpreis)\b/i)[0]
   .replace(/\s+\d{1,4}[,.]\d{2}\s*€.*$/,"")).slice(0,155);
 const category=typeOf(title);
 if(!category||title.length<8)return null;
 // Prices must be printed next to this product, never borrowed from unrelated
 // page navigation, recommendations, or another product card.
 const price=meterPrice(label,null,null),features=attrs(label,title);
 return {name:title,url:href,category,...features,...price,
   sourcePage:href,checkedAt:new Date().toISOString(),
   verified:price.price!==null,provisional:true};
}
function list(html,site,url){
 const urls=new Set(),next=new Set(),products=[],anchor=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 const productMap=new Map();
 let match,counter=0;
 while((match=anchor.exec(html))&&counter++<2000){
  const href=checkedLink(site,decode(match[1]),url);
  if(!href||href===url)continue;
  const label=strip(match[2]).slice(0,700);
  if(isProduct(href)){
   urls.add(href);
   const item=listingProduct(href,label);
   if(item){
    const previous=productMap.get(href);
    if(!previous||(!previous.verified&&item.verified))productMap.set(href,item);
   }
  }else if(/(?:[?&](?:page|p|pagenumber)=\d+|\/page\/\d+)/i.test(href) &&
    /weiter|next|nächste|^\d{1,3}$|›|→/i.test(label))next.add(href);
  else if(isCategory(href,label))next.add(href);
 }
 // rel=next may live outside visible anchor tags.
 const rel=html.match(/<link\b(?=[^>]*rel=["']next["'])([^>]+)>/i);
 if(rel){
  const href=rel[1].match(/href=["']([^"']+)["']/i);
  if(href){
   const nextLink=checkedLink(site,decode(href[1]),url);
   if(nextLink)next.add(nextLink);
  }
 }
 for(const product of productMap.values())products.push(product);
 return {jobs:[...next].slice(0,36).map(url=>({type:"list",url})),
  urls:[...urls].slice(0,750),products};
}
function sitemap(html,site,url,offset){
 const isIndex=/<sitemapindex\b/i.test(html);
 const rx=/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi,all=[];let m;
 while((m=rx.exec(html))&&all.length<10000){
  const checked=checkedLink(site,decode(strip(m[1])));
  if(checked)all.push(checked);
 }
 const off=Math.max(0,Math.min(all.length,Math.trunc(Number(offset)||0)));
 const segment=all.slice(off,off+250);
 const jobs=isIndex?segment.filter(link=>/\.xml(?:$|\?)|\/sitemap/i.test(link)).map(url=>({type:"map",url})):[];
 const urls=isIndex?[]:segment.filter(isProduct);
 if(off+250<all.length)jobs.push({type:"map",url,offset:off+250});
 return {jobs,urls,products:[],total:all.length,truncated:all.length>=10000};
}
function robotsCatalog(text,site){
 const jobs=[],seen=new Set();
 for(const line of String(text).split(/\r?\n/)){
  const match=line.match(/^\s*Sitemap:\s*(https?:\/\/\S+)/i);
  if(!match)continue;
  const url=checkedLink(site,match[1]);
  if(url&&!seen.has(url)&&jobs.length<12){jobs.push({type:"map",url});seen.add(url);}
 }
 return {jobs,urls:[],products:[],total:jobs.length};
}
function shopify(site,data){
 if(!Array.isArray(data.products))throw Error("Öffentlicher Shopify-Katalog nicht verfügbar");
 const products=[];
 for(const p of data.products.slice(0,50)){
  const name=nameClean(p.title),url=checkedLink(site,"/products/"+encodeURIComponent(p.handle||""));
  const body=strip(p.body_html||"").slice(0,5000);
  const category=typeOf(name)||typeOf([p.product_type,p.tags,body.slice(0,500)].join(" "));
  if(!url||!name||!category)continue;
  const extra=attrs(body,name),price=meterPrice(body,null,extra.packM2);
  const variants=Array.isArray(p.variants)?p.variants:[];
  const sale=variants.some(v=>number(v.compare_at_price)>number(v.price)&&number(v.price)>0);
  products.push({name,url,category,...extra,...price,sourcePage:site.root+"products.json",
   checkedAt:new Date().toISOString(),verified:price.price!==null,
   promotion:price.promotion||(sale?"Reduzierter Paketpreis (Einheit prüfen)":"")});
 }
 return {products,hasMore:data.products.length===50,count:data.products.length};
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export async function onRequestGet({request}){
 return json({ok:true,version:VERSION,platform:"Cloudflare Pages Free",features:["discover","expand","shopify","batch"]});
}
export async function onRequestPost({request}){
 try{
  const origin=request.headers.get("Origin");
  if(origin&&origin!==new URL(request.url).origin)return json({error:"Fremde Herkunft blockiert"},403);
  const ct=request.headers.get("content-type")||"";
  if(!ct.includes("application/json"))return json({error:"JSON erforderlich"},415);
  const size=Number(request.headers.get("content-length")||0);
  if(size>8000)return json({error:"Anfrage zu groß"},413);
  const raw=await request.text();
  if(raw.length>8000)return json({error:"Anfrage zu groß"},413);
  const input=JSON.parse(raw||"{}");
  const action=input.action||"discover";
  if(action==="health")return json({ok:true,version:VERSION,platform:"Cloudflare"});
  const site=safeShop(input.site);
  if(action==="discover"){
   const jobs=[
    {type:"robots",url:site.root+"robots.txt"},
    {type:"map",url:site.root+"sitemap.xml"},
    {type:"list",url:site.start},
    {type:"map",url:site.root+"sitemap_index.xml"},
    {type:"map",url:site.root+"wp-sitemap.xml"}
   ];
   const urls=isProduct(site.start)?[site.start]:[];
   if(site.root!==site.start)jobs.push({type:"list",url:site.root});
   return json({site:site.root,jobs,urls,checkedAt:new Date().toISOString(),version:VERSION});
  }
  if(action==="probe"){
   const response=await getText(site,site.start);
   return json({ok:true,site:site.root,bytes:response.body.length,version:VERSION});
  }
  if(action==="expand"){
   const job=input.job||{};
   const url=checkedLink(site,job.url);
   if(!url||!["map","list","robots"].includes(job.type))return json({error:"Ungültiger Katalog-Link"},400);
   const data=await getText(site,url);
   return json(job.type==="map"?sitemap(data.body,site,data.url,job.offset):
     job.type==="robots"?robotsCatalog(data.body,site):
     list(data.body,site,data.url));
  }
  if(action==="shopify"){
   const page=Math.min(30,Math.max(1,Math.trunc(Number(input.page)||1)));
   const response=await getText(site,site.root+"products.json?limit=50&page="+page);
   let items;
   try{items=JSON.parse(response.body);}catch(e){throw Error("Shopify-Katalog gesperrt oder ungültig");}
   return json(shopify(site,items));
  }
  if(action==="batch"){
   const urls=[...new Set((Array.isArray(input.urls)?input.urls:[]).slice(0,2))];
   if(!urls.length||urls.some(u=>!checkedLink(site,u)))return json({error:"Ungültige Produktlinks"},400);
   const products=[],errors=[];
   // Only two outside requests, one at a time, to respect Free-plan limits.
   for(const url of urls){
    try{
     const data=await getText(site,url);
     const p=detail(data.body,site,data.url);
     if(p)products.push(p);
     else errors.push({url,reason:"Kein eindeutiger Bodenbelag auf der Produktseite"});
    }catch(e){errors.push({url,reason:trim(e.message)});}
   }
   return json({products,errors,checkedAt:new Date().toISOString()});
  }
  return json({error:"Unbekannte Aktion"},400);
 }catch(e){
  return json({error:trim(e.message||"Abruf nicht möglich"),version:VERSION},502);
 }
}