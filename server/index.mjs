import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import {openStore,root} from './store.mjs';
import {bootstrapUsers} from './auth.mjs';
import {createApi} from './api.mjs';
const dev=process.argv.includes('--dev');const app=express();app.disable('x-powered-by');
if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
const store=openStore();await bootstrapUsers(store);app.use('/api',createApi(store));
if(dev){const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
else {if(!fs.existsSync(path.join(root,'dist/index.html')))throw new Error('Сначала выполните npm run build');app.use(express.static(path.join(root,'dist'),{index:false}));app.get('/{*path}',(req,res)=>res.sendFile('index.html',{root:path.join(root,'dist')}));}
const port=Number(process.env.PORT)||3000;const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`RIDERAM: http://${process.env.HOST||'localhost'}:${port} (${dev?'development':'production'})`));
function close(){server.close(()=>{store.db.close();process.exit(0);});}process.on('SIGINT',close);process.on('SIGTERM',close);
