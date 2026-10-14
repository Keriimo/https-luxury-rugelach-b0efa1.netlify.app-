const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const file=fs.readFileSync("functions/api/catalog.js","utf8");
const scope={URL,Response,Request,AbortController,setTimeout,clearTimeout,fetch,console};
vm.createContext(scope);
vm.runInContext(file.replace(/^export /gm,"")+
 "\nthis.helpers={safeShop,checkedLink,typeOf,meterPrice,attrs,detail,list,sitemap,shopify};",scope);
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