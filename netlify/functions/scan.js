const cheerio = require("cheerio");

const SETTINGS = {
  depot: {
    host: "laminatdepot.de",
    listings: [
      "https://laminatdepot.de/laminat",
      "https://laminatdepot.de/vinylboeden",
      "https://laminatdepot.de/parkett",
      "https://laminatdepot.de/zubehoer",
      "https://laminatdepot.de/sale"
    ]
  },
  shop24: {
    host: "laminat-shop24.com",
    listings: ["https://laminat-shop24.com/collections/all"]
  }
};
const clean = x => String(x || "").replace(/\s+/g, " ").trim();
function numeric(x) {
  const s = String(x || "").trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}
function kind(x) {
  const t = String(x || "").toLowerCase();
  if (/parkett|massivholz|fertigparkett/.test(t)) return "Parkett";
  if (/vinyl|rigid|designboden|spc|lvt/.test(t)) return "Vinyl";
  if (/laminat/.test(t)) return "Laminat";
  if (/sockel|leiste|dämmung|unterlage|abschlussprofil|übergangsprofil|kleber|zubehör/.test(t)) return "Zubehör";
  return null;
}
function normUrl(url, shop) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== SETTINGS[shop].host) return null;
    u.hash = "";
    if (!/sitemap|\.xml/i.test(u.pathname)) {
      for (const p of ["utm_source","utm_medium","utm_campaign","fbclid","gclid"]) u.searchParams.delete(p);
    }
    return u.href;
  } catch { return null; }
}
function isProductLink(url, shop) {
  if (shop === "shop24") return /\/products\/[^/?]+/i.test(url);
  const p = new URL(url).pathname;
  return /\/(laminat|vinylboeden|parkett|zubehoer|sale)\/.+/i.test(p)
    && !/\/(art|marke|farbe|dekor|artikelart|eigenschaft|format)\//i.test(p)
    && !/\/paging\//i.test(p);
}
function productName(x) {
  return clean(x)
    .replace(/^\d[.,]\d\s*\(\d+\)\s*/, "")
    .replace(/^\s*(AKTIONS-Preis|SALE|Restposten)\s*-?\d*%?\s*/i, "")
    .split(/(?:\s*\|\s*(?:Nutzschicht|NK\b|AC\d|Stärke)\b|\b\d+(?:[.,]\d+)?\s*mm\s*Stärke\b)/i)[0]
    .replace(/\s{2,}/g, " ").slice(0, 170).trim();
}
function specs(text, name) {
  const t = text.slice(0, 2800);
  const strength = t.match(/(\d+(?:[.,]\d+)?)\s*mm\s*(?:Stärke|stark|dick)/i)
    || t.match(/(?:Stärke|Dicke|Gesamtdicke)\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i)
    || name.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  const wear = t.match(/Nutzschicht(?:stärke)?\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  const nk = t.match(/\bNK\s*(\d{2})\b/i) || t.match(/Nutzungsklasse\s*:?\s*(\d{2})/i);
  const ac = t.match(/\bAC\s*([3-6])\b/i);
  return {
    thickness: strength ? numeric(strength[1]) : null,
    wear: wear ? numeric(wear[1]) : null,
    nk: nk ? nk[1] : null,
    ac: ac ? "AC" + ac[1] : null,
    insulation: /(?:inklusive|integrierte[rn]?|mit)\s+(?:\w+\s+)?(?:dämmung|trittschalldämmung)|inklusive dämmung/i.test(t),
    skirting: /(?:inklusive|kostenlose[nr]?|mit)\s+(?:\w+\s+)?(?:fußleiste|sockelleiste)/i.test(t)
  };
}
function pricing(raw, shop) {
  const t = clean(raw).slice(0, 7500);
  const unitRx = /(\d{1,4}(?:[.,]\d{2}))\s*€\s*(?:\/|pro)\s*(?:m²|m2|qm)/gi;
  const hits = [];
  for (const match of t.matchAll(unitRx)) {
    const before = t.slice(Math.max(0,match.index - 44),match.index);
    if (/(?:statt|uvp|du sparst|ersparnis|gespart)\s*$/i.test(before)) continue;
    const v = numeric(match[1]);
    if (v && v > 0 && v < 1500) hits.push(v);
  }
  const specific = t.match(/(?:Komplett-Set|Aktionspreis|Angebotspreis)\s*:?\s*(\d{1,4}(?:[.,]\d{2}))\s*€\s*\/\s*(?:m²|m2|qm)/i)
    || t.match(/Preis\s*(?:pro\s*)?(?:m²|m2|qm)\s*:?\s*\|?\s*(\d{1,4}(?:[.,]\d{2}))\s*€/i);
  const otherFormats = [
    /(?:Preis|Grundpreis)\s*(?:pro\s*)?(?:m²|m2|qm)\s*[:|–-]?\s*(\d{1,4}(?:[.,]\d{2}))\s*€/i,
    /(?:m²|m2|qm)\s*[-:]?\s*(\d{1,4}(?:[.,]\d{2}))\s*€/i,
    /(\d{1,4}(?:[.,]\d{2}))\s*€\s*(?:je|pro)\s*(?:m²|m2|qm)/i
  ];
  const alternative = otherFormats.map(rx=>t.match(rx)).find(Boolean);
  const price = specific ? numeric(specific[1]) : (hits[0] || (alternative ? numeric(alternative[1]) : null));
  const oldHit = t.match(/(?:statt|UVP)\s*:?\s*(\d{1,4}(?:[.,]\d{2}))\s*€/i);
  const oldPrice = oldHit && price && numeric(oldHit[1]) > price ? numeric(oldHit[1]) : null;
  const action = /\bAKTIONS-Preis\b|\bAktionspreis\b/i.test(t.slice(0,550)) ? "Aktion"
    : /(?:Restposten|BodenOUTLET)/i.test(t.slice(0,400)) ? "Restposten"
    : /\bSALE\b/i.test(t.slice(0,400)) ? "Sale"
    : oldPrice ? (shop === "depot" ? "Set-Vorteil" : "UVP-Vergleich") : null;
  return {price, oldPrice, promotion: action,
    discountPct: oldPrice ? Math.round((1 - price / oldPrice) * 100) : null};
}
function directCards(html, shop, pageUrl) {
  const $ = cheerio.load(html);
  $("script,style,noscript,footer,nav").remove();
  const products = [], links = new Set(), seen = new Set();
  const selector = "article,li,div[class*='product-card'],div[class*='product-item'],div[class*='ProductCard'],div[class*='product-tile']";
  $(selector).each((_, el) => {
    const elNode = $(el), text = clean(elNode.text());
    if (text.length < 25 || text.length > 1600) return;
    const candidates = [...new Set(elNode.find("a[href]").toArray()
      .map(a => normUrl(new URL($(a).attr("href") || "",pageUrl).href,shop))
      .filter(u => u && isProductLink(u,shop)))];
    for (const u of candidates) links.add(u);
    if (candidates.length !== 1) return;
    const url = candidates[0];
    if (seen.has(url)) return;
    const name = productName(
      clean(elNode.find("h2,h3,h4,[class*='title']").first().text()) ||
      clean(elNode.find("a[href]").first().text()) || text);
    const category = kind(name) || kind(pageUrl);
    const prices = pricing(text,shop);
    if (!name || !category || !prices.price) return;
    seen.add(url);
    products.push({shop,url,name,category,...prices,...specs(text,name),unit:"m²",verified:false,sourcePage:pageUrl});
  });
  const next = new Set();
  $("a[href]").each((_, a) => {
    const href = $(a).attr("href");
    if (!href) return;
    let u;
    try { u = normUrl(new URL(href,pageUrl).href,shop); } catch { return; }
    if (!u || u === pageUrl) return;
    const label = clean($(a).text());
    const rel = $(a).attr("rel") || "";
    const isPage = /(?:[?&](?:page|pagenumber)=\d+|\/paging\/page\d+)/i.test(u);
    if (isPage && (/next/i.test(rel) || /weiter|next|nächste|^\d{1,3}$|→|›/i.test(label))) next.add(u);
  });
  return {products,productUrls:[...links],next:[...next].slice(0,35)};
}
function parseDetail(html, shop, url) {
  const $ = cheerio.load(html);
  const h1 = productName($("h1").first().text() || $('meta[property="og:title"]').attr("content") || "");
  $("script,style,noscript,footer,nav").remove();
  const body = clean(($("main").first().length ? $("main").first() : $("body")).text());
  const name = h1 || productName($("h2").first().text());
  const category = kind(name) || kind(url) || kind(body.slice(0,800));
  const priceArea = body.slice(0,10000);
  const prices = pricing(priceArea,shop);
  if (!name || !category || !prices.price) return null;
  return {shop,url,name,category,...prices,...specs(priceArea,name),unit:"m²",
    verified:true,sourcePage:url};
}
async function getText(url,shop) {
  const valid = normUrl(url,shop);
  if (!valid) throw new Error("Unzulässige Shop-URL");
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8500);
  try {
    const resp = await fetch(valid,{signal:controller.signal,
      headers:{"Accept":"text/html,application/xml,text/xml","User-Agent":"MarktRadarCatalog/2.0 (public product data)"}});
    if (!resp.ok) throw new Error("HTTP "+resp.status);
    const len = Number(resp.headers.get("content-length")||0);
    if (len > 5000000) throw new Error("Seite zu groß");
    return (await resp.text()).slice(0,5000000);
  } finally { clearTimeout(timeout); }
}
function resp(data,statusCode=200) {
  return {statusCode,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",
      "Access-Control-Allow-Origin":"https://luxury-rugelach-b0efa1.netlify.app"},
    body:JSON.stringify(data)};
}
function xmlEntries(xml,shop) {
  const $=cheerio.load(xml,{xmlMode:true});
  if ($("sitemapindex").length) return {type:"sitemap",links:$("sitemapindex > sitemap > loc").map((_,e)=>normUrl($(e).text(),shop)).get().filter(Boolean)};
  return {type:"url",links:$("urlset > url > loc").map((_,e)=>normUrl($(e).text(),shop)).get().filter(Boolean)};
}
exports.handler = async event => {
  const shop = event.queryStringParameters?.shop;
  if (!SETTINGS[shop]) return resp({error:"Unbekannter Shop"},400);
  const action = event.queryStringParameters?.action || "preview";
  try {
    if (action === "discover") {
      return resp({shop,checkedAt:new Date().toISOString(),
        jobs:[{type:"sitemap",url:"https://"+SETTINGS[shop].host+"/sitemap.xml",offset:0},
          ...SETTINGS[shop].listings.map(url=>({type:"listing",url}))]});
    }
    if (action === "expand") {
      const body=JSON.parse(event.body||"{}");
      const url=normUrl(body.url,shop), type=body.type;
      if (!url || !["sitemap","listing"].includes(type)) return resp({error:"Ungültige Anfrage"},400);
      if (type==="sitemap" && !/sitemap|\.xml/i.test(new URL(url).pathname)) return resp({error:"Kein Sitemap-Pfad"},400);
      const html=await getText(url,shop);
      if (type==="sitemap") {
        const data=xmlEntries(html,shop), offset=Math.max(0,Math.min(50000,Number(body.offset)||0));
        const chunk=data.links.slice(offset,offset+250);
        const jobs=data.type==="sitemap"?chunk.map(url=>({type:"sitemap",url,offset:0})):[];
        const urls=data.type==="url"?chunk.filter(url=>isProductLink(url,shop)):[];
        if (offset+250<data.links.length) jobs.push({type:"sitemap",url,offset:offset+250});
        return resp({jobs,urls,products:[],discovered:data.links.length});
      }
      const found=directCards(html,shop,url);
      return resp({jobs:found.next.map(url=>({type:"listing",url})),urls:found.productUrls,
        products:found.products,discovered:found.productUrls.length});
    }
    if (action==="batch" && event.httpMethod==="POST") {
      const data=JSON.parse(event.body||"{}");
      const urls=[...new Set((Array.isArray(data.urls)?data.urls:[]).slice(0,5))];
      const settled=await Promise.allSettled(urls.map(async url=>{
        const valid=normUrl(url,shop);
        if (!valid || !isProductLink(valid,shop)) throw new Error("Kein Produktlink");
        const html=await getText(valid,shop);
        return parseDetail(html,shop,valid);
      }));
      const products=[],errors=[];
      settled.forEach((r,i)=>{
        if(r.status==="fulfilled"&&r.value)products.push(r.value);
        else errors.push({url:urls[i],error:r.status==="rejected"?clean(r.reason?.message):"Kein eindeutiger €/m²-Preis"});
      });
      return resp({products,errors,checkedAt:new Date().toISOString()});
    }
    const settled=await Promise.allSettled(SETTINGS[shop].listings.slice(0,4).map(async url=>
      directCards(await getText(url,shop),shop,url).products));
    const products=settled.flatMap(r=>r.status==="fulfilled"?r.value:[]);
    return resp({shop,checkedAt:new Date().toISOString(),products,
      errors:settled.filter(r=>r.status==="rejected").map(r=>String(r.reason?.message))});
  } catch(e) { return resp({error:clean(e.message||"Abruf fehlgeschlagen")},502); }
};
