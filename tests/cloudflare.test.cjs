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
 assert.equal(x.typeOf("Trittschalldämmung für Laminat"),"Zubehör");
 assert.equal(x.typeOf("Korkboden"),"Bioboden & Kork");
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
