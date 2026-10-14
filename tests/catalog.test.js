"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const p=require("../netlify/functions/catalog.js").__test;

test("Only public HTTPS host names are allowed",()=>{
  assert.equal(p.parseSite("https://example-shop.de/laminat").host,"example-shop.de");
  assert.throws(()=>p.parseSite("http://127.0.0.1/test"));
  assert.throws(()=>p.parseSite("https://localhost/"));
  assert.throws(()=>p.parseSite("https://secret.internal/"));
  assert.throws(()=>p.parseSite("https://public.com:8080/"));
  assert.equal(p.permitted(p.parseSite("https://shop-abc.de"),"https://another-website.de/products/1"),null);
  assert.equal(p.safeIP("127.0.0.1"),false);
  assert.equal(p.safeIP("169.254.169.254"),false);
  assert.equal(p.safeIP("10.2.3.4"),false);
  assert.equal(p.safeIP("8.8.8.8"),true);
});
test("Floor category recognition differentiates flooring from accessories",()=>{
  assert.equal(p.category("Klickvinyl Eiche 5 mm"),"Vinyl");
  assert.equal(p.category("Laminat Eiche inklusive Trittschalldämmung"),"Laminat");
  assert.equal(p.category("Trittschalldämmung für Laminat"),"Zubehör");
  assert.equal(p.category("Sockelleiste Eiche"),"Zubehör");
  assert.equal(p.category("Parkett Landhausdiele"),"Parkett");
  assert.equal(p.category("Bioboden Kork"),"Bioboden & Kork");
});
test("Only explicitly stated square-meter prices are recognized",()=>{
  const a=p.priceInfo("Laminat Eiche 12,99 € / m²",null,null);
  assert.equal(a.price,12.99);
  assert.equal(a.unit,"m²");
  assert.equal(p.priceInfo("Laminat Eiche Paketpreis 28,95 €",null,null).price,null);
  assert.equal(p.priceInfo("Preis m²: | 29,99 €",null,null).price,29.99);
  assert.equal(p.priceInfo("Preis m²: 19,99 €",null,null).price,19.99);
});
test("A structured unit price is acceptable; unlabelled unit not assumed",()=>{
  const direct=p.priceInfo("",{offers:{price:"22.99",priceSpecification:{unitCode:"MTK"}}},null);
  assert.equal(direct.price,22.99);
  const unknown=p.priceInfo("",{offers:{price:"22.99"}},null);
  assert.equal(unknown.price,null);
  const pack=p.priceInfo("",{offers:{price:"20.00"}},2);
  assert.equal(pack.price,10);
  assert.equal(pack.priceSource,"aus Paketpreis und Inhalt berechnet");
});
test("Scan detail with structured Product information",()=>{
  const html='<html><head><script type="application/ld+json">'+JSON.stringify({
    "@type":"Product",name:"Vinyl Eiche Natur 5 mm",sku:"XYZ-123",
    brand:{"@type":"Brand",name:"Demomarke"},
    offers:{price:"24.99",priceSpecification:{price:"24.99",unitCode:"MTK"}}
  })+'</script></head><body><main><h1>Vinyl Eiche Natur 5 mm</h1><p>Nutzungsklasse NK 33 · Nutzschicht 0,55 mm</p></main></body></html>';
  const product=p.parseProduct(html,p.parseSite("https://boden.testshop.de"),"https://boden.testshop.de/products/eiche");
  assert.equal(product.price,24.99);
  assert.equal(product.category,"Vinyl");
  assert.equal(product.nk,"33");
  assert.equal(product.wear,0.55);
  assert.equal(product.brand,"Demomarke");
});
test("Sitemap URL parsing retains only same-domain entries",()=>{
 const site=p.parseSite("https://www.testshop.de");
 const xml='<urlset><url><loc>https://www.testshop.de/products/a</loc></url>'+
  '<url><loc>https://evil.de/products/b</loc></url></urlset>';
 assert.deepEqual(p.sitemapList(xml,site).urls,["https://www.testshop.de/products/a"]);
});
test("HTML cards list product pages",()=>{
 const site=p.parseSite("https://www.testshop.de");
 const html='<main><article><a href="/products/laminat-eiche">Laminat Eiche 8 mm</a><span>12,99 € /m²</span></article></main>';
 const data=p.listPage(html,site,"https://www.testshop.de/laminat");
 assert.ok(data.urls.includes("https://www.testshop.de/products/laminat-eiche"));
 assert.equal(data.products[0].price,12.99);
});
