"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {handler,__test}=require("../netlify/functions/catalog.js");
test("Netlify scanner dependency loads and health endpoint works without a shop",async()=>{
 const result=await handler({httpMethod:"GET",queryStringParameters:null});
 assert.equal(result.statusCode,200);
 const body=JSON.parse(result.body);
 assert.equal(body.ok,true);
 assert.equal(body.platform,"Netlify");
});
test("Netlify price parser prioritizes flooring over free insulation",()=>{
 const product=__test.priceInfo("Boden 16,99 €/m² + inkl. Basic Dämmung 0,00 €/m² Komplettpreis 16,99 €/m²",null,null);
 assert.equal(product.price,16.99);
 assert.match(product.priceSource,/Bodenpreis/);
});
test("Netlify price parser never uses free underlay price as floor price",()=>{
 const product=__test.priceInfo("inkl. Basic Dämmung 0,00 €/m²",null,null);
 assert.equal(product.price,null);
});
