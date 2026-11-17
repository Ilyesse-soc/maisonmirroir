const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto')
const {Resend}=require('resend'),{NextRequest}=require('next/server')
async function main(){
 const key=crypto.randomBytes(32),secret='whsec_'+key.toString('base64'),resend=new Resend('re_unit_test_not_a_real_key')
 process.env.RESEND_NEWSLETTER_WEBHOOK_SECRET=secret
 let stored=0,reconciled=0
 const mod=new Module(path.resolve('app/api/newsletter/webhook/route.ts'),module)
 mod.filename=path.resolve('app/api/newsletter/webhook/route.ts');mod.paths=module.paths
 mod.require=id=>{
  if(id==='@/lib/email')return{getResendClient:()=>resend}
  if(id==='@/lib/newsletterDb')return{database:()=>({query:async()=>{stored++;return{rows:[],rowCount:1}}})}
  if(id==='@/lib/deliveryEvents')return{deliveryStatuses:{'email.delivered':'delivered'},reconcileDelivery:async()=>{reconciled++}}
  if(id==='@/lib/requestSecurity')return{readBoundedText:async r=>{const t=await r.text();if(t.length>65536)throw Error('too large');return t}}
  if(id==='@/lib/observability')return{securityEvent:()=>{}}
  return require(id)
 }
 mod._compile(ts.transpileModule(fs.readFileSync(mod.filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,mod.filename)
 const body=JSON.stringify({type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:crypto.randomUUID()}}),id='msg_unit_test'
 function request(age=0,valid=true){const timestamp=String(Math.floor(Date.now()/1000)-age),signature=crypto.createHmac('sha256',key).update(id+'.'+timestamp+'.'+body).digest('base64');return new NextRequest('https://example.test/api/newsletter/webhook',{method:'POST',body,headers:{'content-type':'application/json','svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+(valid?signature:'invalid')}})}
 assert.equal((await mod.exports.POST(request(0,false))).status,400)
 assert.equal((await mod.exports.POST(request(600,true))).status,400)
 assert.equal(stored,0)
 assert.equal((await mod.exports.POST(request())).status,200)
 assert.equal(stored,1);assert.equal(reconciled,1)
 console.log('PASS: real Resend SDK signature verification, rejection of altered and expired signatures, no storage before authentication. No provider API request or email.')
}
main().catch(error=>{console.error(error);process.exitCode=1})
