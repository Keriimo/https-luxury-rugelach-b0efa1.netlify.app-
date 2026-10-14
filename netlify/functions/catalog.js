"use strict";
const https = require("node:https");
const dns = require("node:dns").promises;
const net = require("node:net");
const cheerio = require("cheerio");

const ROOT_LIMIT=90, URL_LIMIT=1200, REQUEST_TIMEOUT=7500, TEXT_LIMIT=2600000;
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
const num=s=>{
  if(s===null||s===undefined)return null;
  const v=clean(s).replace(/[€\s]/g,"");
  const normalized=v.includes(",")?v.replace(/\./g,"").replace(",","."):v;
  const n=Number(normalized);
  return Number.isFinite(n)&&n>0?n:null;
};
function parseSite(raw){
  if(typeof raw!=="string"||raw.length>500)throw Error("Shop-URL fehlt oder ist zu lang");
  const input=raw.trim();
  const uri=new URL(/^https?:\/\//i.test(input)?input:"https://"+input);
  if(uri.protocol!=="https:"||uri.username||uri.password||uri.port||net.isIP(uri.hostname))throw Error("Nur öffentliche HTTPS-Shopadressen ohne Port erlaubt");
  const h=uri.hostname.toLowerCase().replace(/^www\./,"");
  if(!h.includes(".")||h.length>160||/^(localhost|metadata|internal)(\.|$)/.test(h)||/\.(local|internal|localhost|test|invalid|example|onion)$/i.test(h)||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(h))throw Error("Keine öffentliche Shop-Domain");
  return {host:h,home:"https://"+uri.hostname+"/",start:"https://"+uri.hostname+uri.pathname+uri.search};
}
function permitted(site,raw){
  const u=new URL(raw,site.home);
  if(u.protocol!=="https:"||u.username||u.password||u.port)return null;
  if(u.hostname.toLowerCase().replace(/^www\./,"")!==site.host)return null;
  u.hash="";
  for(const key of ["utm_source","utm_medium","utm_campaign","gclid","fbclid"])u.searchParams.delete(key);
  return u.href;
}
function safeIP(a){
  const family=net.isIP(a);
  if(family===4){
    const z=a.split(".").map(Number);
    if(z[0]===0||z[0]===10||z[0]===127||z[0]>=224||z[0]===169&&z[1]===254||z[0]===172&&z[1]>=16&&z[1]<=31||z[0]===192&&z[1]===168||z[0]===100&&z[1]>=64&&z[1]<=127||z[0]===198&&z[1]>=18&&z[1]<=19||z[0]===192&&z[1]===0||z[0]===192&&z[1]===88||z[0]===198&&z[1]===51||z[0]===203&&z[1]===0)return false;
    return true;
  }
  if(family===6){const v=a.toLowerCase();return /^2[0-9a-f]{3}:/.test(v)&&!v.startsWith("2001:db8:");}
  return false;
}
async function download(site,raw,maxRedirects=2){
  const url=permitted(site,raw);
  if(!url)throw Error("URL gehört nicht zu diesem Shop");
  const uri=new URL(url);
  const addresses=await dns.lookup(uri.hostname,{all:true});
  const approved=addresses.find(item=>safeIP(item.address));
  if(!approved)throw Error("Shopadresse ist nicht öffentlich erreichbar");
  return new Promise((resolve,reject)=>{
    let size=0,parts=[];
    const request=https.get(uri,{
      lookup:(host,opts,callback)=>callback(null,approved.address,approved.family),
      servername:uri.hostname,timeout:REQUEST_TIMEOUT,
      headers:{"Accept":"text/html,application/json,application/xml,text/xml;q=0.9,*/*;q=0.2",
        "User-Agent":"MarktRadar/3.0 (+public product price comparison; polite crawl)"}
    },response=>{
      if(response.statusCode>=300&&response.statusCode<400&&response.headers.location&&maxRedirects>0){
        response.resume();
        let next;
        try{next=permitted(site,new URL(response.headers.location,url).href);}catch(e){}
        if(!next){reject(Error("Weiterleitung auf fremde Adresse blockiert"));return;}
        download(site,next,maxRedirects-1).then(resolve,reject);return;
      }
      if(response.statusCode!==200){response.resume();reject(Error("HTTP "+response.statusCode));return;}
      const type=String(response.headers["content-type"]||"");
      if(type&&!/text|json|xml|html/i.test(type)){response.resume();reject(Error("Kein lesbarer HTML/XML/JSON-Inhalt"));return;}
      response.on("data",chunk=>{
        size+=chunk.length;
        if(size>TEXT_LIMIT){request.destroy(Error("Seite ist zu groß"));return;}
        parts.push(chunk);
      });
      response.on("end",()=>resolve({text:Buffer.concat(parts).toString("utf8"),url}));
      response.on("error",reject);
    });
    request.on("timeout",()=>request.destroy(Error("Zeitüberschreitung")));
    request.on("error",reject);
  });
}
function category(s){
 const t=clean(s).toLowerCase();
 if(/parkett|massivholzdiele|fertigparkett|schiffsboden/.test(t))return "Parkett";
 if(/laminat/.test(t))return "Laminat";
 if(/vinyl|spc\b|lvt\b|rigid|designboden|klickboden|klickvinyl|klebevinyl/.test(t))return "Vinyl";
 if(/linoleum|bioboden|bio-boden|korkboden|korkparkett/.test(t))return "Bioboden & Kork";
 if(/teppichboden|teppichfliese|nadelfilz/.test(t))return "Teppich";
 if(/pvc.boden|pvc.belag|cv.belag/.test(t))return "PVC";
 if(/sockel|fußleiste|fussleiste|trittschall|dämmunterlage|dämmung|unterlage|kleber|abschlussprofil|übergangsprofil|bodenprofil|zubehör|reiniger/.test(t))return "Zubehör";
 if(/bodenbelag|bodenplatte|bodenfliese|flooring|bodenpaneel/.test(t))return "Sonstige Bodenbeläge";
 return null;
}
function productName(s){
 return clean(s).replace(/^[45][.,]\d\s*\(\d+\)\s*/,"").replace(/^(sale|aktion|restposten)\s*[-:]\s*/i,"").slice(0,180);
}
function productPath(url){
 const p=new URL(url).pathname;
 return /\/(products?|produkt|artikel|p|pd|item|detail)\//i.test(p)
 || /\/[^/]+\.(?:html|htm)$/i.test(p)
 || /\/(laminat|vinylboeden?|parkett|bodenbelaege|designboden|zubehoer)\/[^/]{12,}\/?$/i.test(p);
}
function details(text,name){
 const t=(name+" "+clean(text)).slice(0,9500);
 const thick=t.match(/(?:Stärke|Gesamtdicke|Dicke)\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i)||t.match(/(\d+(?:[.,]\d+)?)\s*mm\s*(?:Stärke|stark|dick)/i)||name.match(/(\d+(?:[.,]\d+)?)\s*mm/);
 const wear=t.match(/(?:Nutzschicht|Nutzschichtstärke)\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i);
 const nk=t.match(/\b(?:NK|Nutzungsklasse)\s*:?\s*(\d{2})\b/i);
 const ac=t.match(/\bAC\s*([3-6])\b/i);
 const pack=t.match(/(?:Paketinhalt|Inhalt\s*(?:je|pro)\s*Paket|Paket\s*(?:enthält|=)|Paketfläche)\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:m²|m2|qm)/i);
 return {thickness:thick?num(thick[1]):null,wear:wear?num(wear[1]):null,
  nk:nk?nk[1]:null,ac:ac?"AC"+ac[1]:null,packM2:pack?num(pack[1]):null,
  insulation:/inklusive\s+(?:trittschall)?dämmung|mit\s+trittschalldämmung/i.test(t),
  skirting:/inklusive\s+(?:fuß|fuss|sockel)leiste|mit\s+fußleisten/i.test(t)};
}
function priceInfo(t,structured,packM2){
 const text=clean(t).slice(0,14000);
 const found=[];
 const patterns=[
  /(?:Preis|Grundpreis)\s*(?:pro\s*)?(?:m²|m2|qm)\s*[:|\-–\s]*?(\d{1,4}(?:[.,]\d{2}))\s*€/gi,
  /(\d{1,4}(?:[.,]\d{2}))\s*€\s*(?:\/|je|pro)\s*(?:m²|m2|qm)/gi,
  /(?:m²|m2|qm)\s*[:|]\s*(\d{1,4}(?:[.,]\d{2}))\s*€/gi
 ];
 for(let type=0;type<patterns.length;type++){
  for(const m of text.matchAll(patterns[type])){
   const price=num(m[1]);
   const preceding=text.slice(Math.max(0,m.index-40),m.index).toLowerCase();
   if(price&&price<2500&&!/(?:du sparst|ersparnis|statt|uvp)\s*$/.test(preceding))found.push({price,at:m.index,source:"€/m² direkt"});
  }
 }
 let offer=null,offerUnit=null,compare=null;
 if(structured&&structured.offers){
  const offers=Array.isArray(structured.offers)?structured.offers:[structured.offers];
  for(const item of offers){
   if(!item||typeof item!=="object")continue;
   const p=num(item.price||item.lowPrice||item.priceSpecification?.price);
   if(!p)continue;
   const unit=clean(item.priceSpecification?.unitCode||item.priceSpecification?.unitText||"");
   offer=p;offerUnit=unit;
   compare=num(item.highPrice||"");
   break;
  }
 }
 if(offer&&/^(MTK|m2|m²|qm)$/i.test(offerUnit))found.unshift({price:offer,at:0,source:"strukturierter €/m²-Preis"});
 found.sort((a,b)=>a.at-b.at);
 let first=found[0],unit="m²",price=first?.price||null,priceSource=first?.source||null;
 if(price==null&&packM2&&packM2>=0.1&&packM2<=15&&offer){
  price=Math.round(offer/packM2*100)/100;priceSource="aus Paketpreis und Inhalt berechnet";
 }
 if(price==null&&/^(C62|Stück|PCE)$/i.test(offerUnit||"")&&offer&&category(text)==="Zubehör"){
  price=offer;unit="Stück";priceSource="strukturierter Stückpreis";
 }
 const oldMatch=text.slice(0,1800).match(/(?:UVP|statt|Alter Preis)\s*:?\s*(\d{1,4}(?:[.,]\d{2}))\s*€\s*(?:\/\s*(?:m²|m2|qm))?/i);
 const oldPrice=price&&oldMatch&&num(oldMatch[1])>price?num(oldMatch[1]):null;
 const promo=/(aktionspreis|sonderangebot|reduziert|sale|restposten)/i.test(text.slice(0,650))?"Aktionshinweis":(oldPrice?"Vergleichspreis":"");
 return {price,unit,priceSource,oldPrice,promotion:promo,
  discountPct:oldPrice?Math.round((1-price/oldPrice)*100):null};
}
function jsonLD($){
 const result=[];
 $('script[type="application/ld+json"]').each((_,node)=>{
  try{
   const v=JSON.parse($(node).html());
   function walk(x,depth){
    if(depth>5||!x||typeof x!=="object")return;
    if(Array.isArray(x)){x.forEach(v=>walk(v,depth+1));return;}
    if(String(x["@type"]||"").toLowerCase().includes("product"))result.push(x);
    if(x["@graph"])walk(x["@graph"],depth+1);
    if(x.itemListElement)walk(x.itemListElement,depth+1);
    if(x.item)walk(x.item,depth+1);
   }
   walk(v,0);
  }catch(e){}
 });
 return result[0]||null;
}
function parseProduct(html,site,url){
 const $=cheerio.load(html),ld=jsonLD($);
 const title=productName(ld?.name||$("h1").first().text()||$('meta[property="og:title"]').attr("content")||$("title").text());
 $("script,style,footer,nav,noscript").remove();
 const main=$("main").first().length?$("main").first():$("body");
 const text=clean(main.text());
 const type=category([title,ld?.category,ld?.description,text.slice(0,1000)].join(" "));
 if(!type||!title||title.length<5)return null;
 const characteristics=details(text,title);
 const price=priceInfo(text,ld,characteristics.packM2);
 const id=ld?.sku||ld?.gtin13||ld?.gtin||null;
 return {url,name:title,category:type,...characteristics,...price,sku:id?clean(id).slice(0,80):null,
  brand:clean(ld?.brand?.name||ld?.brand||"").slice(0,80),
  sourcePage:url,checkedAt:new Date().toISOString(),verified:price.price!==null};
}
function sitemapList(xml,site){
 const $=cheerio.load(xml,{xmlMode:true});
 if($("sitemapindex").length)return {kind:"sitemap",urls:$("sitemapindex > sitemap > loc").map((_,el)=>permitted(site,$(el).text())).get().filter(Boolean)};
 return {kind:"page",urls:$("urlset > url > loc").map((_,el)=>permitted(site,$(el).text())).get().filter(Boolean)};
}
function listPage(html,site,url){
 const $=cheerio.load(html);
 const productLinks=new Set(),next=new Set(),found=[];
 const linkNodes=$('a[href]').toArray();
 for(const a of linkNodes){
  const href=$(a).attr("href");
  let link;
  try{link=permitted(site,new URL(href,url).href);}catch(e){continue;}
  if(!link||link===url)continue;
  const path=new URL(link).pathname.toLowerCase();
  const anchorText=clean($(a).text());
  if(productPath(link)){
    productLinks.add(link);
    const card=$(a).closest("article,li,[class*='product-card'],[class*='product-item'],[class*='product-tile']");
    if(card.length){
      const t=clean(card.text()),name=productName(card.find("h2,h3,h4").first().text()||anchorText);
      const type=category(name+" "+t.slice(0,150));
      const price=priceInfo(t,null,null);
      if(name.length>5&&type&&price.price!==null){
        found.push({name,category:type,...details(t,name),...price,url:link,
          sourcePage:url,checkedAt:new Date().toISOString(),verified:false});
      }
    }
  } else if(/(?:[?&](?:page|p|pagenumber)=\d+|\/page\/\d+|\/collections\/[^/]+\/?)/i.test(link) &&
      (/weiter|next|nächste|^\d+$|›|»|→/i.test(anchorText)||path.includes("/collections/")))next.add(link);
  else if(/(laminat|vinyl|parkett|boden|zubehör|zubehoer|kork|teppich|sale|angebote)/i.test(anchorText)&&
      new URL(url).pathname==="/")next.add(link);
 }
 return {urls:[...productLinks].slice(0,600),next:[...next].slice(0,35),products:found.slice(0,150)};
}
function reply(result,code=200){
 return {statusCode:code,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
 "X-Content-Type-Options":"nosniff"},body:JSON.stringify(result)};
}
async function main(event){
 const input=event.httpMethod==="POST"?JSON.parse(event.body||"{}"):event.queryStringParameters||{};
 const site=parseSite(input.site);
 const action=input.action||"discover";
 if(action==="discover"){
  const jobs=[{type:"list",url:site.start},{type:"map",url:site.home+"sitemap.xml"}];
  if(site.start!==site.home)jobs.push({type:"list",url:site.home});
  try{
   const robots=(await download(site,site.home+"robots.txt")).text;
   for(const match of robots.matchAll(/^\s*Sitemap:\s*(https?:\/\/\S+)/gim)){
    const uri=permitted(site,match[1]);
    if(uri)jobs.push({type:"map",url:uri});
   }
  }catch(e){}
  return reply({site:site.home,jobs,checkedAt:new Date().toISOString()});
 }
 if(action==="expand"){
  const job=input.job||{},url=permitted(site,job.url);
  if(!url||!["map","list"].includes(job.type))return reply({error:"Ungültiger Job"},400);
  const text=(await download(site,url)).text;
  if(job.type==="map"){
   if(!/(?:\.xml(?:\?|$)|\/sitemap|sitemap\.php)/i.test(new URL(url).pathname))return reply({error:"Kein Sitemap-URL"},400);
   const info=sitemapList(text,site),offset=Math.max(0,Math.min(30000,Number(job.offset)||0));
   const chunk=info.urls.slice(offset,offset+300),jobs=[];
   const urls=info.kind==="page"?chunk.filter(productPath):[];
   if(info.kind==="sitemap")jobs.push(...chunk.map(url=>({type:"map",url})));
   if(offset+300<info.urls.length)jobs.push({type:"map",url,offset:offset+300});
   return reply({jobs,urls,products:[],total:info.urls.length});
  }
  const parsed=listPage(text,site,url);
  return reply({jobs:parsed.next.map(link=>({type:"list",url:link})),urls:parsed.urls,products:parsed.products,total:parsed.urls.length});
 }
 if(action==="shopify"){
  const page=Math.max(1,Math.min(10,Math.trunc(Number(input.page)||1)));
  const uri=site.home+"products.json?limit=250&page="+page;
  const data=JSON.parse((await download(site,uri)).text);
  if(!Array.isArray(data.products))throw Error("Kein offener Shopify-Katalog");
  const products=[];
  for(const p of data.products){
   if(!p.handle||!p.title)continue;
   const name=productName(p.title);
   const text=clean(cheerio.load(p.body_html||"").text());
   const type=category([name,p.product_type,p.tags,text].join(" "));
   if(!type)continue;
   const url=permitted(site,site.home+"products/"+p.handle);
   if(!url)continue;
   products.push({name,url,category:type,...details(text,name),price:null,unit:"m²",
     priceSource:null,promotion:"",checkedAt:new Date().toISOString(),sourcePage:uri,verified:false});
  }
  return reply({products,hasMore:data.products.length===250,count:data.products.length});
 }
 if(action==="batch"){
  const urls=[...new Set((Array.isArray(input.urls)?input.urls:[]).slice(0,2))];
  if(urls.some(url=>!permitted(site,url)))return reply({error:"Fremder Produktlink"},400);
  const results=await Promise.allSettled(urls.map(async uri=>{
   const r=await download(site,uri);
   return parseProduct(r.text,site,r.url);
  }));
  const products=[],errors=[];
  results.forEach((result,index)=>{
   if(result.status==="fulfilled"&&result.value)products.push(result.value);
   else errors.push({url:urls[index],reason:result.status==="rejected"?clean(result.reason?.message):"Keine eindeutige Bodenbelag-Kategorie"});
  });
  return reply({products,errors,checkedAt:new Date().toISOString()});
 }
 return reply({error:"Unbekannte Aktion"},400);
}
exports.handler=async event=>{
 try{return await main(event);}catch(e){return reply({error:clean(e.message||"Abruffehler").slice(0,220)},502);}
};