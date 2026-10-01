import { env } from 'cloudflare:workers';
import { buildPushPayload } from '@block65/webcrypto-web-push';
import { database } from '@/db';
import { DHIKR } from '@/lib/dhikr';
import { deviceCookie, digest, randomCode, randomToken, validCode, validDhikr, validSubscription } from '@/lib/policy.mjs';
export const dynamic = 'force-dynamic';
type Pair = {id:number;owner:string;guest:string|null;code_hash:string|null;expires:number;owner_subscription:string|null;guest_subscription:string|null;owner_sent:number;guest_sent:number};
class APIError extends Error { constructor(public status:number,message:string){super(message);} }
function reject(status:number,message:string):never{throw new APIError(status,message);}
function response(body:unknown,status=200,token?:string){
  const headers:Record<string,string>={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
  if(token)headers['Set-Cookie']=`__Host-dhekr=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`;
  return new Response(JSON.stringify(body),{status,headers});
}
async function rate(id:string,milliseconds:number){
  const now=Date.now();
  const result=await database().prepare('INSERT INTO limits(id,at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET at=excluded.at WHERE limits.at <= ?').bind(id,now,now-milliseconds).run();
  if(!result.meta.changes)reject(429,'انتظري قليلاً ثم حاولي مجدداً.');
}
async function current(request:Request){
  const token=deviceCookie(request);
  const hash=token?await digest(token):null;
  const pair=await database().prepare('SELECT * FROM pair WHERE id=1').first<Pair>();
  const role=pair&&hash?(pair.owner===hash?'owner':pair.guest===hash?'guest':null):null;
  return {token,hash,pair,role};
}
function publicStatus(value:Awaited<ReturnType<typeof current>>){
  const {pair,role}=value;
  return {state:role?(pair?.guest?'paired':'waiting'):'new',
    pushReady:!!(role==='owner'?pair?.owner_subscription:role==='guest'?pair?.guest_subscription:null),
    otherReady:!!(role==='owner'?pair?.guest_subscription:role==='guest'?pair?.owner_subscription:null),
    configured:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY&&env.VAPID_SUBJECT), publicKey:env.VAPID_PUBLIC_KEY||''};
}
async function handle(request:Request){
  // Sites validates these identity headers before forwarding private requests.
  // This application must remain behind private Sites access. Never expose this
  // handler through an untrusted proxy that lets clients inject these headers.
  if(!request.headers.get('oai-authenticated-user-id'))reject(401,'سجّلي الدخول لفتح التطبيق الخاص.');
  if(request.method==='GET')return response(publicStatus(await current(request)));
  const origin=request.headers.get('origin');
  if(!origin || origin!==env.APP_ORIGIN)reject(403,'افتحي التطبيق من رابطه الأصلي.');
  if(!request.headers.get('content-type')?.startsWith('application/json'))reject(415,'طلب غير صالح.');
  const raw=await request.text();
  if(raw.length>8000)reject(413,'طلب كبير جداً.');
  let input;try{input=JSON.parse(raw);}catch{reject(400,'طلب غير صالح.');}
  const {action}=input||{};
  const {pair,role,hash,token}=await current(request);
  if(action==='create'){
    await rate('create',5000);
    if(pair&&!role)reject(409,'هذا التطبيق مرتبط بجهاز آخر بالفعل. استخدمي رمز الربط.');
    if(pair?.guest)reject(409,'الجهازان مرتبطان بالفعل.');
    const credential=token||randomToken();
    const owner=hash||await digest(credential);
    const code=randomCode();
    const codeHash=await digest(code);
    const now=Date.now();
    // A single atomic upsert prevents two callers from claiming the first slot.
    const result=await database().prepare(`INSERT INTO pair(id,owner,code_hash,expires) VALUES(1,?,?,?)
      ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,expires=excluded.expires
      WHERE pair.owner=excluded.owner AND pair.guest IS NULL`).bind(owner,codeHash,now+600000).run();
    if(!result.meta.changes)reject(409,'تم إنشاء الربط على جهاز آخر.');
    return response({code,expiresAt:now+600000},200,credential);
  }
  if(action==='join'){
    await rate('join',3000);
    if(!validCode(input.code))reject(400,'أدخلي ستة أرقام.');
    if(role==='owner')reject(409,'استخدمي هذا الرمز على الجهاز الآخر.');
    if(role==='guest')return response({paired:true});
    const credential=randomToken();
    const guest=await digest(credential);
    const result=await database().prepare('UPDATE pair SET guest=?,code_hash=NULL,expires=0 WHERE id=1 AND guest IS NULL AND code_hash=? AND expires>?')
      .bind(guest,await digest(input.code),Date.now()).run();
    if(!result.meta.changes)reject(409,'الرمز غير صحيح أو انتهت صلاحيته أو استُخدم بالفعل.');
    return response({paired:true},200,credential);
  }
  if(!role||!pair)reject(403,'اربطي الجهازين أولاً.');
  if(action==='subscribe'){
    if(!validSubscription(input.subscription))reject(400,'اشتراك الإشعارات غير صالح.');
    const subscription=JSON.stringify({endpoint:input.subscription.endpoint,expirationTime:input.subscription.expirationTime??null,keys:input.subscription.keys});
    await database().prepare(`UPDATE pair SET ${role}_subscription=? WHERE id=1 AND ${role}=?`).bind(subscription,hash).run();
    return response({ready:true});
  }
  if(action==='send'){
    if(!validDhikr(input.dhikrID))reject(400,'الذكر غير صالح.');
    if(!pair.guest)reject(409,'أكملي الربط على الجهاز الآخر.');
    const other=role==='owner'?'guest':'owner';
    const saved=pair[`${other}_subscription`];
    if(!saved)reject(409,'فعّلي الإشعارات على الجهاز الآخر وافتحي التطبيق عليه.');
    if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)reject(503,'الإشعارات غير جاهزة بعد.');
    const now=Date.now();
    const result=await database().prepare(`UPDATE pair SET ${role}_sent=? WHERE id=1 AND ${role}=? AND ${role}_sent<=?`).bind(now,hash,now-2000).run();
    if(!result.meta.changes)reject(429,'انتظري ثانيتين قبل الذكر التالي.');
    const subscription=JSON.parse(saved);
    if(!validSubscription(subscription))reject(409,'أعيدي تفعيل الإشعارات على الجهاز الآخر.');
    const payload=await buildPushPayload({data:JSON.stringify({title:'تذكير ❤️',body:DHIKR[input.dhikrID as number],url:'/'}),options:{ttl:3600}},subscription,
      {subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
    let sent:Response;
    try{sent=await fetch(subscription.endpoint,{...payload,redirect:'error',signal:AbortSignal.timeout(10000)});}catch{reject(503,'تعذّر تأكيد إرسال التذكير. تحققي من الاتصال قبل المحاولة مجدداً.');}
    if(sent.status===404||sent.status===410){
      // Clear only the stale value; never overwrite a concurrently refreshed token.
      await database().prepare(`UPDATE pair SET ${other}_subscription=NULL WHERE id=1 AND ${other}_subscription=?`).bind(saved).run();
      reject(409,'انتهى اشتراك الجهاز الآخر. افتحي التطبيق عليه وفعّلي الإشعارات.');
    }
    if(!sent.ok)reject(503,'تعذّر إرسال التذكير الآن. حاولي لاحقاً.');
    return response({accepted:true});
  }
  reject(400,'طلب غير صالح.');
}
async function boundary(request:Request){
  try{return await handle(request);}catch(error){
    if(error instanceof APIError)return response({error:error.message},error.status);
    // Never log endpoint credentials, cookies or notification payloads.
    console.error('Dhekr request failed',error instanceof Error?error.name:'unknown');
    return response({error:'تعذّر الاتصال بالخدمة. حاولي مرة أخرى.'},503);
  }
}
export const GET=boundary;
export const POST=boundary;
