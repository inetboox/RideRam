import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import express from 'express';import {openStore} from '../server/store.mjs';import {bootstrapUsers,hashPassword,verifyPassword} from '../server/auth.mjs';import {createApi} from '../server/api.mjs';
test('Каталог, сессии, права дилера, предложения, заявки, модерация и сохранение SQLite',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rideram-test-'));process.env.DEALER_PASSWORD='test-dealer-password-432';process.env.ADMIN_PASSWORD='test-admin-password-432';
 const store=openStore(dir);await bootstrapUsers(store);const app=express();app.use('/api',createApi(store));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port+'/api';
 async function req(route,method='GET',body,session={}){const r=await fetch(base+route,{method,headers:{'content-type':'application/json',...(session.cookie?{cookie:session.cookie}:{}),...(session.csrf?{'x-csrf-token':session.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 async function login(email,password){const r=await req('/login','POST',{email,password});assert.equal(r.status,200,JSON.stringify(r.data));return {cookie:r.cookie,csrf:r.data.user.csrf};}
 try{
 assert.equal(await verifyPassword('correct-password',await hashPassword('correct-password')),true);assert.equal(await verifyPassword('wrong',await hashPassword('correct-password')),false);
 assert.equal((await req('/health')).data.ok,true);const meta=(await req('/meta')).data;assert.equal(meta.modelCount,381);assert.equal(meta.brands.length,77);
 const all=await req('/models?limit=100');assert.equal(all.data.total,381);assert.equal(all.data.items.length,100);const withOffer=(await req('/models?inStock=true')).data.items[0];assert.ok(withOffer);const detail=(await req('/models/'+withOffer.id)).data;assert.equal(detail.offers[0].price,250000);assert.equal((await req('/models/999999')).status,404);
 assert.equal((await req('/dashboard')).status,401);assert.equal((await req('/login','POST',{email:'dealer@rideram.local',password:'incorrect'})).status,401);
 const dealer=await login('dealer@rideram.local',process.env.DEALER_PASSWORD);assert.equal((await req('/session','GET',undefined,dealer)).data.user.role,'dealer');assert.equal((await req('/admin','GET',undefined,dealer)).status,403);
 assert.equal((await req('/offers','POST',{}, {cookie:dealer.cookie})).status,403);
 const offer=(await req('/offers','POST',{modelId:1,price:550000,stock:2,status:'available'},dealer));assert.equal(offer.status,201,JSON.stringify(offer.data));assert.equal((await req('/models/1')).data.minPrice,550000);
 const lead=await req('/leads','POST',{modelId:1,offerId:offer.data.id,name:'Тестовый покупатель',phone:'+79991234567',consent:true});assert.equal(lead.status,201,JSON.stringify(lead.data));let dash=(await req('/dashboard','GET',undefined,dealer)).data;assert.equal(dash.leads.length,1);assert.equal(dash.stats.newLeads,1);
 assert.equal((await req('/leads/'+dash.leads[0].id,'PATCH',{status:'contacted',note:'Тест'},dealer)).status,200);
 const second=store.add('dealers',{name:'Другой дилер',published:true,city:'Москва',plan:'start'});store.db.prepare('INSERT INTO users(email,password_hash,role,dealer_id) VALUES(?,?,?,?)').run('second@test.local',await hashPassword('second-test-password'),'dealer',second.id);const other=await login('second@test.local','second-test-password');assert.equal((await req('/offers/'+offer.data.id,'PUT',{modelId:1,price:1,stock:1,status:'available'},other)).status,403);assert.equal((await req('/dashboard','GET',undefined,other)).data.leads.length,0);
 assert.equal((await req('/reviews','POST',{modelId:1,author:'Тест',rating:5,text:'Тестовый отзыв',consent:true})).status,201);assert.equal((await req('/models/1')).data.reviews.length,0);const admin=await login('admin@rideram.local',process.env.ADMIN_PASSWORD);const review=(await req('/admin','GET',undefined,admin)).data.reviews[0];assert.equal((await req('/admin/reviews/'+review.id,'PATCH',{approved:true},admin)).status,200);assert.equal((await req('/models/1')).data.reviews.length,1);
 assert.equal((await req('/admin/articles','POST',{title:'Обзор',text:'Тестовый материал',modelId:1,published:true},admin)).status,201);assert.equal((await req('/articles')).data.length,1);
 assert.equal((await req('/logout','POST',{},dealer)).status,200);assert.equal((await req('/dashboard','GET',undefined,dealer)).status,401);
 const before=store.all('offers').length;store.db.close();const again=openStore(dir);assert.equal(again.all('offers').length,before);assert.equal(again.all('leads').length,1);again.db.close();
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));try{store.db.close()}catch{}fs.rmSync(dir,{recursive:true,force:true});}
});
