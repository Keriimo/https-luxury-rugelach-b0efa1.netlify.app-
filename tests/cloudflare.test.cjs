const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const file=fs.readFileSync("functions/api/catalog.js","utf8");
const scope={URL,Response,Request,AbortController,TextDecoder,setTimeout,clearTimeout,fetch,console};
vm.createContext(scope);
vm.runInContext(file.replace(/^export /gm,"")+
 "\nthis.helpers={safeShop,checkedLink,typeOf,meterPrice,attrs,detail,list,sitemap,shopify,robotsCatalog};",scope);
const x=scope.helpers;
const shop=x.safeShop("https://www.boden-testshop.de");
test("Only secure public shops are allowed",()=>{
 assert.equal(shop.host,"boden-testshop.de");
 assert.throws(()=>x.safeShop("https://127.0.0.1"),/Nur öffentliche/);
 assert.throws(()=>x.safeShop("https://localhost"),/Nur öffentliche/);
 assert.throws(()=>x.safeShop("http://boden-testshop.de"),/Nur öffentliche/);
 assert.equal(x.checkedLink(shop,"https://fremder-shop.de/produkt/x"),null);
});
test("Different floor types and accessories",()=>{
 assert.equal(x.typeOf("Laminat Eiche"),"Laminat");
 assert.equal(x.typeOf("Klickvinyl 5 mm"),"Vinyl");
 assert.equal(x.typeOf("Parkett Eiche"),"Parkett");
 assert.equal(x.typeOf("Trittschalldämmung für Laminat"),null);
 assert.equal(x.typeOf("Korkboden"),null);
});
test("Prices are not invented",()=>{
 assert.equal(x.meterPrice("19,99 € /m²",null,null).price,19.99);
 assert.equal(x.meterPrice("Preis m²: | 24,99 €",null,null).price,24.99);
 assert.equal(x.meterPrice("Paketpreis 24,99 €",null,null).price,null);
 assert.equal(x.meterPrice("",{offers:{price:"39.99",priceSpecification:{unitCode:"MTK"}}},null).price,39.99);
 assert.equal(x.meterPrice("",{offers:{price:"30.00"}},2).price,15);
});
test("Structured product page is recognized",()=>{
 const json=JSON.stringify({"@type":"Product",name:"Klickvinyl Eiche 5 mm",sku:"A-123",
  offers:{price:"24.99",priceSpecification:{unitCode:"MTK"}}});
 const html='<html><script type="application/ld+json">'+json+'</script><main><h1>Klickvinyl Eiche 5 mm</h1>'+
  '<p>Nutzungsklasse 33 · Nutzschicht: 0,55 mm</p></main></html>';
 const product=x.detail(html,shop,shop.root+"products/vinyl-eiche");
 assert.equal(product.price,24.99);
 assert.equal(product.category,"Vinyl");
 assert.equal(product.nk,"33");
 assert.equal(product.wear,0.55);
});
test("Catalog links keep product URLs and pagination",()=>{
 const html='<a href="/products/laminat-eiche">Laminat Eiche</a><a href="?page=2">2</a>';
 const result=x.list(html,shop,shop.root+"collections/all");
 assert.equal(result.urls.length,1);
 assert.equal(result.jobs.length,1);
});
test("Sitemap ignores other websites",()=>{
 const xml='<urlset><url><loc>https://www.boden-testshop.de/products/laminat-eiche</loc></url>'+
 '<url><loc>https://evil.com/products/foo</loc></url></urlset>';
 const result=x.sitemap(xml,shop,shop.root+"sitemap.xml",0);
 assert.equal(result.urls.length,1);
});
test("Shopify list never assumes variant price is per m2",()=>{
 const result=x.shopify(shop,{products:[{handle:"laminat-eiche",title:"Laminat Eiche",
  product_type:"Laminat",body_html:"",variants:[{price:"12.00"}]}]});
 assert.equal(result.products[0].price,null);
});

const api=vm.runInContext("({get:onRequestGet,post:onRequestPost})",scope);
function apiRequest(site,action,extra){
 return new Request("https://radar.pages.dev/api/catalog",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":"https://radar.pages.dev"},
  body:JSON.stringify({site,action,...extra})
 });
}
test("API health endpoint responds without a remote request",async()=>{
 const result=await api.get({request:new Request("https://radar.pages.dev/api/catalog")});
 const json=await result.json();
 assert.equal(result.status,200);
 assert.equal(json.ok,true);
 assert.ok(json.version);
});
test("Discover includes the supplied product URL",async()=>{
 const r=await api.post({request:apiRequest("https://www.boden-testshop.de/products/klickvinyl-eiche","discover")});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.urls.length,1);
 assert.equal(data.urls[0],"https://www.boden-testshop.de/products/klickvinyl-eiche");
});
test("Unsafe private-site URL is rejected",async()=>{
 const r=await api.post({request:apiRequest("https://localhost/products/laminat","discover")});
 assert.notEqual(r.status,200);
 const data=await r.json();
 assert.match(data.error,/öffentliche/);
});
test("Unexpected cross-site Origin is rejected",async()=>{
 const request=new Request("https://radar.pages.dev/api/catalog",{
  method:"POST",headers:{"Content-Type":"application/json","Origin":"https://angreifer.de"},
  body:JSON.stringify({site:"https://www.boden-testshop.de",action:"discover"})
 });
 const r=await api.post({request});
 assert.equal(r.status,403);
});
test("Sitemap-based catalog discovery with mocked shop response",async()=>{
 const original=scope.fetch;
 scope.fetch=async url=>{
  assert.equal(String(url),"https://www.boden-testshop.de/sitemap.xml");
  return new Response('<urlset><url><loc>https://www.boden-testshop.de/products/laminat-eiche</loc></url></urlset>',
   {status:200,headers:{"Content-Type":"application/xml"}});
 };
 try{
  const r=await api.post({request:apiRequest("https://www.boden-testshop.de/","expand",{
   job:{type:"map",url:"https://www.boden-testshop.de/sitemap.xml"}
  })});
  const data=await r.json();
  assert.equal(r.status,200);
  assert.equal(data.urls.length,1);
 }finally{scope.fetch=original;}
});
test("Real product parsing through API mock distinguishes price and category",async()=>{
 const original=scope.fetch;
 scope.fetch=async ()=>new Response(
  '<html><main><h1>Klickvinyl Eiche 5 mm</h1><p>Preis m²: 24,99 €</p>'+
  '<p>Nutzungsklasse 33, Nutzschicht 0,55 mm</p></main></html>',
  {status:200,headers:{"Content-Type":"text/html"}}
 );
 try{
  const url="https://www.boden-testshop.de/products/vinyl-eiche";
  const r=await api.post({request:apiRequest("https://www.boden-testshop.de","batch",{urls:[url]})});
  const data=await r.json();
  assert.equal(r.status,200);
  assert.equal(data.products.length,1);
  assert.equal(data.products[0].price,24.99);
  assert.equal(data.products[0].category,"Vinyl");
 }finally{scope.fetch=original;}
});
test("Promotions are not falsely inferred from global menu wording",()=>{
 const out=x.meterPrice("Klickvinyl Eiche, 19,99 € /m², normaler Preis",null,null);
 assert.equal(out.promotion,"");
});

test("Robots sitemap hints are discovered within the same shop",()=>{
 const content="User-agent: *\nSitemap: https://www.boden-testshop.de/sitemap_products.xml\n"+
  "Sitemap: https://unrelated.example.net/sitemap.xml\n";
 const result=x.robotsCatalog(content,shop);
 assert.equal(result.jobs.length,1);
 assert.equal(result.jobs[0].type,"map");
});
test("Discount and sale wording in a global menu does not create a false offer",()=>{
 const html='<html><nav>Sale 50% Rabatt</nav><main><h1>Laminat Eiche 8 mm</h1>'+
  '<p>Preis m²: 14,99 €</p></main></html>';
 const p=x.detail(html,shop,shop.root+"products/laminat-eiche");
 assert.equal(p.price,14.99);
 assert.equal(p.promotion,"");
});

test("Sale price wins over UVP, old prices and savings",()=>{
 const a=x.meterPrice("statt 19,99 € /m² jetzt 12,99 € /m²",null,null);
 assert.equal(a.price,12.99);
 assert.equal(a.oldPrice,19.99);
 const b=x.meterPrice("Alter Preis pro m²: 19,99 € Preis pro m²: 12,99 €",null,null);
 assert.equal(b.price,12.99);
 assert.equal(x.meterPrice("UVP 29,99 € /m²",null,null).price,null);
 assert.equal(x.meterPrice("ab 9,99 € /m²",null,null).price,null);
});
test("Unit-safe price reduction is not inferred from package price",()=>{
 const p=x.meterPrice("Paket-UVP: 49,99 € Heute 24,99 € /m²",null,null);
 assert.equal(p.price,24.99);
 assert.equal(p.oldPrice,null);
 assert.equal(p.discountPct,null);
});

test("Flat SEO product routes like Laminat DEPOT are discovered from category pages",()=>{
 const shop=x.safeShop("https://laminatdepot.de/");
 const html='<main><a href="/laminat">Laminat</a>'+
  '<a href="/vinylboeden">Vinylböden</a>'+
  '<a href="/laminat-bodomo-premium-schlossdiele-natur-100013100">'+
  'Laminat Schlossdiele Natur Set inklusive Dämmung und Fußleiste '+
  '8 mm Stärke | NK 32 | AC4 statt 26,39 €/m² Komplett-Set 19,99 €/m² Du sparst 6,40 €/m²</a></main>';
 const result=x.list(html,shop,shop.root+"laminat");
 assert.equal(result.urls.length,1);
 assert.ok(result.jobs.some(j=>j.url===shop.root+"vinylboeden"));
 assert.equal(result.products.length,1);
 assert.equal(result.products[0].price,19.99);
 assert.equal(result.products[0].category,"Laminat");
 assert.equal(result.products[0].nk,"32");
 assert.equal(result.products[0].provisional,true);
});
test("Long floor product page retains true price rather than accessory/savings figures",()=>{
 const shop=x.safeShop("https://laminatdepot.de/");
 const markup='<main><h1>Laminat Schlossdiele Natur</h1><div>'+
   'Artikelbeschreibung '.repeat(1400)+'</div><section>'+
   '8 mm Stärke | NK 32 | AC4 Boden 19,99 €/m², Basic Dämmung 0,00 €/m² '+ 
   'Komplettpreis statt 26,39 19,99 €/m² Du sparst 6,40 €/m² '+
   'Paketpreis 50,67 € | Inhalt 2,535 m²</section></main>';
 const product=x.detail(markup,shop,shop.root+"laminat-bodomo-schlossdiele-natur-100013100");
 assert.equal(product.price,19.99);
 assert.equal(product.thickness,8);
 assert.equal(product.nk,"32");
 assert.equal(product.packM2,2.535);
});
test("Unlabeled prices are not invented from an unrelated category",()=>{
 const shop=x.safeShop("https://laminatdepot.de/");
 const html='<nav><a href="/laminat">Laminat</a></nav>'+
  '<a href="/laminat-bodomo-premium-schlossdiele-natur-100013100">Laminat Eiche Natur</a>';
 const result=x.list(html,shop,shop.root);
 assert.equal(result.products[0].price,null);
});


test("Only laminate, parquet and vinyl/rigid vinyl; reject other floor materials",()=>{
 for(const [label,expected] of [
  ["Laminat Eiche 8 mm","Laminat"],
  ["Parkett Eiche 14 mm","Parkett"],
  ["Vinyl rigid 5 mm","Vinyl"],
  ["Rigid-Vinyl Eiche 4 mm","Vinyl"],
  ["SPC Designboden beige","Vinyl"],
  ["Teppichboden beige",null],
  ["PVC-Boden stone",null],
  ["Linoleum grau",null],
  ["Bioboden Exquisit",null],
  ["Korkboden",null],
  ["Fußleiste passend für Vinyl",null],
  ["Trittschalldämmung für Laminat",null]
 ])assert.equal(x.typeOf(label),expected,label);
});
test("LaminatDEPOT Komplettpreis wins over crossed-out prices and derives a genuine advertised saving",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<main><h1>Laminat BoDomo Klassik Modern Grau</h1>'+
  '<p>Boden 12,99 €/m² + inkl. Basic Dämmung 0,00 €/m² + inkl. Fußleiste 0,00 €/m</p>'+
  '<section>Komplettpreis statt <del>17,73</del> 12,99 €/m² Du sparst 4,74 €/m²</section>'+
  '<p>Paketpreis 32,40 € | Inhalt 2,494 m²</p></main>';
 const product=x.detail(html,site,site.root+"laminat-bodomo-klassik-modern-grau-100029402");
 assert.equal(product.price,12.99);
 assert.equal(product.oldPrice,17.73);
 assert.equal(product.priceSource,"Komplettpreis €/m² auf Produktseite");
 assert.equal(product.unit,"m²");
 assert.equal(product.packM2,2.494);
});
test("Long listing and sitemap can process more than 200 products without truncation",()=>{
 const site=x.safeShop("https://boden-testshop.de/");
 const labels=Array.from({length:340},(_,i)=>
  '<a href="/products/laminat-eiche-'+i+'">Laminat Eiche '+i+' 8 mm 14,99 €/m²</a>');
 const listed=x.list('<main>'+labels.join('')+'</main>',site,site.root+"laminat");
 assert.equal(listed.urls.length,340);
 assert.equal(listed.products.length,340);
 const xml='<urlset>'+labels.map((_,i)=>'<url><loc>'+site.root+
  'products/laminat-eiche-'+i+'</loc></url>').join('')+'</urlset>';
 const parsed=x.sitemap(xml,site,site.root+"sitemap.xml");
 assert.equal(parsed.urls.length,340);
 assert.equal(parsed.jobs.length,0);
});

test("LaminatDEPOT category Komplett-Set price is recognized instead of old strikethrough price",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<article><a href="/alle-produkte/laminat-modern-grau-100029402">'+
  'Laminat Modern Grau Set inklusive Dämmung und Fußleiste 7 mm Stärke | NK 31 | AC3 '+
  'statt 17,73 €/m² Komplett-Set 12,99 €/m² Du sparst 4,74 €/m²'+
  '</a></article>';
 const listed=x.list(html,site,site.root+"laminat");
 assert.equal(listed.products.length,1);
 assert.equal(listed.products[0].price,12.99);
 assert.equal(listed.products[0].oldPrice,17.73);
 assert.equal(listed.products[0].unit,"m²");
});
test("Product card price in following HTML sibling is attributed only to its product",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<div class="product-card"><a href="/alle-produkte/laminat-eiche-100011111">'+
  'Laminat Eiche Natur Set 8 mm</a><span>statt 14,73 €/m²</span>'+
  '<span>Komplett-Set 9,99 €/m²</span></div>'+
  '<div class="product-card"><a href="/alle-produkte/laminat-grau-100022222">'+
  'Laminat Grau Set 7 mm</a><span>Komplett-Set 12,99 €/m²</span></div>';
 const result=x.list(html,site,site.root+"laminat");
 assert.equal(result.products.length,2);
 const byName=new Map(result.products.map(p=>[p.name,p]));
 assert.equal(byName.get("Laminat Eiche Natur Set 8 mm").price,9.99);
 assert.equal(byName.get("Laminat Grau Set 7 mm").price,12.99);
});
test("Unpriced product card never borrows the next product's price",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<a href="/alle-produkte/laminat-a-100010001">Laminat Natur Eiche 8 mm</a>'+
  '<a href="/alle-produkte/laminat-b-100010002">Laminat Anderer Boden 7 mm</a>'+
  '<span>Komplett-Set 16,99 €/m²</span>';
 const result=x.list(html,site,site.root+"laminat");
 assert.equal(result.products.length,2);
 assert.equal(result.products[0].price,null);
 assert.equal(result.products[1].price,16.99);
});
test("Generic shops do not get an unconditional Shopify feed request",async()=>{
 const r=await api.post({request:apiRequest("https://boden-testshop.de/","discover")});
 const data=await r.json();
 assert.equal(r.status,200);
 assert.equal(data.jobs.some(j=>j.type==="shopify"),false);
});

test("Standalone skirting, adhesive and other accessories are excluded",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 for(const title of ["Sockelleiste Eiche","Fußleiste weiß","Montagekleber für Sockelleisten",
  "Trittschalldämmung für Laminat","Teppichboden grau","PVC Boden Grau"]){
  assert.equal(x.typeOf(title),null,title);
 }
 const product=x.detail('<main><h1>Sockelleiste MDF Eiche</h1><p>5,99 €/Stück</p></main>',
  site,site.root+"sockelleiste-eiche-100045678");
 assert.equal(product,null);
 const cards=x.list('<a href="/sockelleiste-eiche-100045678">Sockelleiste Eiche</a>'+
  '<a href="/laminat-eiche-100045679">Laminat Eiche 8 mm Komplett-Set 12,99 €/m²</a>',
  site,site.root);
 assert.equal(cards.products.length,1);
 assert.equal(cards.products[0].category,"Laminat");
});

test("Laminat DEPOT catalog discovery starts on all four verified flooring pages",async()=>{
 const response=await api.post({request:apiRequest("https://laminatdepot.de/","discover")});
 const json=await response.json();
 assert.equal(response.status,200);
 const urls=json.jobs.filter(j=>j.type==="list").map(j=>j.url);
 for(const suffix of ["alleboeden","laminat","vinylboeden","parkett"])
  assert.ok(urls.includes("https://laminatdepot.de/"+suffix),suffix);
});
test("Shop list follows public floor catalog page navigation, including German 'zu Seite' labels",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<a href="/alle-produkte/laminat-eiche-100010934">Laminat Eiche LHD Komplett-Set 9,99 €/m²</a>'+
  '<a href="/paging/page0?PageNumber=1&PageSize=60&CatalogID=laminat">zu Seite 2 von 5</a>';
 const discovered=x.list(html,site,site.root+"laminat");
 assert.equal(discovered.products.length,1);
 assert.equal(discovered.products[0].price,9.99);
 assert.ok(discovered.jobs.some(j=>j.type==="list"&&/PageNumber=1/.test(j.url)));
});
test("Clearly named accessory product URLs are excluded before requesting detail pages",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const html='<a href="/alle-produkte/trittschall-fuer-laminat-100010934">Trittschalldämmung für Laminat</a>'+
  '<a href="/alle-produkte/sockelleiste-fuer-parkett-100010935">Sockelleiste für Parkett</a>'+
  '<a href="/alle-produkte/laminat-eiche-100010936">Laminat Eiche Komplett-Set 13,99 €/m²</a>';
 const found=x.list(html,site,site.root+"laminat");
 assert.equal(found.products.length,1);
 assert.equal(found.urls.length,1);
 assert.equal(found.products[0].category,"Laminat");
});

test("Insulation advertised 'für Laminat' or inside laminate category is never a floor product",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 for(const title of [
  "Trittschalldämmung für Laminat 2 mm",
  "XPERT Trittschalldämmung passend für Laminat",
  "Dämmunterlage für Vinyl Rigid",
  "Laminat Trittschalldämmung 2 mm",
  "Trittschall-Unterlage Vinyl 5 mm",
  "Sockelleiste für Parkett Eiche"
 ])assert.equal(x.typeOf(title),null,title);
 const structured=JSON.stringify({"@type":"Product",
  name:"XPERT Trittschalldämmung für Laminat",category:"Laminat",
  offers:{price:"9.99",priceSpecification:{unitCode:"MTK"}}});
 const detail=x.detail('<script type="application/ld+json">'+structured+'</script>'+
  '<main><h1>XPERT Trittschalldämmung für Laminat</h1><p>Stärke 2 mm</p></main>',
  site,site.root+"products/xpert-trittschalldaemmung-fuer-laminat");
 assert.equal(detail,null);
 const listing=x.list('<a href="/products/xpert-trittschalldaemmung-fuer-laminat">'+
  'XPERT Trittschalldämmung für Laminat</a>'+
  '<a href="/products/laminat-eiche-8mm">Laminat Eiche 8 mm</a>',site,site.root+"laminat");
 assert.equal(listing.urls.length,1);
 assert.equal(listing.products.length,1);
 assert.equal(listing.products[0].name,"Laminat Eiche 8 mm");
});
test("Flooring sold with included underlay remains discoverable",()=>{
 const site=x.safeShop("https://laminatdepot.de/");
 const title="Laminat Eiche 8 mm inklusive Dämmung";
 assert.equal(x.typeOf(title),"Laminat");
 const item=x.detail('<main><h1>'+title+'</h1><p>Komplettpreis 12,99 €/m²</p></main>',
 site,site.root+"products/laminat-eiche-inklusive-daemmung");
 assert.equal(item.category,"Laminat");
 assert.equal(item.price,12.99);
});
