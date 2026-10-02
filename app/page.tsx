'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Download, Link2, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DHIKR } from '@/lib/dhikr';

type Status = { state: 'new' | 'waiting' | 'paired'; pushReady: boolean; otherReady: boolean; publicKey: string; configured: boolean; canCreate:boolean; canRecover:boolean };
const empty: Status = {state:'new',pushReady:false,otherReady:false,publicKey:'',configured:false,canCreate:false,canRecover:false};
async function api(action: string, body?: object) {
  const response = await fetch('/api/dhikr'+(body ? '' : '?action='+action), {
    method:body?'POST':'GET', credentials:'same-origin', cache:'no-store',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}:{}),
  });
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('انتهت جلسة الدخول. أغلقي التطبيق وافتحيه مجدداً لتسجيل الدخول.');
  }
  const data = await response.json() as Status & {error?:string;code:string;accepted?:boolean};
  if (!response.ok) throw new Error(data.error || 'تعذّر الاتصال. حاولي مجدداً.');
  return data;
}
function applicationKey(value: string) {
  const data=atob(value.replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(data,c=>c.charCodeAt(0));
}
export default function Home() {
  const [status,setStatus]=useState<Status>(empty);
  const [panel,setPanel]=useState<'pair'|'install'|null>(null);
  const [code,setCode]=useState('');
  const [entry,setEntry]=useState('');
  const [busy,setBusy]=useState(false);
  const [cooldown,setCooldown]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const [online,setOnline]=useState(true);
  const [standalone,setStandalone]=useState(false);
  const [permission,setPermission]=useState('default');
  const [received,setReceived]=useState('');
  const lock=useRef(false);
  const sw=useRef<ServiceWorkerRegistration|null>(null);
  const statusRef=useRef(status); statusRef.current=status;
  const refresh=useCallback(async()=>{
    try {const next=await api('status');statusRef.current=next;setStatus(next);return next as Status;}
    catch(e){setError((e as Error).message);return null;}
  },[]);
  const syncSubscription=useCallback(async()=>{
    if(!sw.current||statusRef.current.state==='new') return;
    const sub=await sw.current.pushManager?.getSubscription();
    if(sub) await api('subscribe',{subscription:sub.toJSON()});
  },[]);
  useEffect(()=>{
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    setPermission('Notification' in window?Notification.permission:'unsupported');
    const network=()=>setOnline(navigator.onLine);
    network(); window.addEventListener('online',network);window.addEventListener('offline',network);
    if(new URLSearchParams(window.location.search).has('pair'))setPanel('pair');
    void refresh();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{scope:'/'}).then(async reg=>{
      sw.current=reg;
      await navigator.serviceWorker.ready;
      await syncSubscription();
    }).catch(()=>setError('تعذّر تجهيز الإشعارات. افتحي التطبيق مجدداً.'));
    const foreground=()=>{if(!document.hidden){void refresh().then(()=>syncSubscription()).catch(()=>{});setPermission('Notification' in window?Notification.permission:'unsupported');}};
    document.addEventListener('visibilitychange',foreground);
    const message=(event:MessageEvent)=>{if(event.data?.type==='dhikr'&&DHIKR.includes(event.data.body)){setReceived(event.data.body);} if(event.data?.type==='subscription-changed'){void refresh();}};
    navigator.serviceWorker?.addEventListener('message',message);
    return()=>{window.removeEventListener('online',network);window.removeEventListener('offline',network);document.removeEventListener('visibilitychange',foreground);navigator.serviceWorker?.removeEventListener('message',message);};
  },[refresh,syncSubscription]);
  useEffect(()=>{
    if(status.state==='new')return;
    void syncSubscription().catch(()=>{});
    const timer=setInterval(()=>{if(!document.hidden)void refresh();},10000);
    return()=>clearInterval(timer);
  },[status.state,refresh,syncSubscription]);
  // Read-only tool uses the exact same visible status and never sends notifications.
  useEffect(()=>{
    const context=(document as Document & {modelContext?:{registerTool:Function}}).modelContext;
    if(!context)return;
    const lifecycle=new AbortController();
    try{void Promise.resolve(context.registerTool({name:'read_dhikr_pairing_status',description:'Read pairing and notification readiness for this device. Does not send anything.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({state:statusRef.current.state,notificationsReady:statusRef.current.pushReady,partnerReady:statusRef.current.otherReady})},{signal:lifecycle.signal})).catch(()=>{});}catch{}
    return()=>lifecycle.abort();
  },[]);
  async function perform(action:()=>Promise<void>){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await action();}catch(e){setError((e as Error).message);}finally{lock.current=false;setBusy(false);}
  }
  function send(id:number){
    if(cooldown||lock.current)return;
    if(status.state!=='paired'){setPanel('pair');return;}
    if(!online){setError('يلزم الاتصال بالإنترنت لإرسال التذكير.');return;}
    void perform(async()=>{
      setFeedback('');setCooldown(true);
      // iOS Safari does not expose vibration; a pressed-state animation is the fallback.
      navigator.vibrate?.(12);
      const started=Date.now();
      try{await api('send',{dhikrID:id});setFeedback('تم الذكر ❤️');}
      finally{setTimeout(()=>setCooldown(false),Math.max(0,2000-(Date.now()-started)));}
    });
  }
  function enableNotifications(){
    if(!('Notification' in window)||!('PushManager' in window)||!sw.current){setPanel('install');return;}
    if(status.state==='new'){setError('اربطي الجهاز أولاً ثم فعّلي الإشعارات.');setPanel('pair');return;}
    if(!status.publicKey){setError('الإشعارات غير جاهزة بعد. حاولي لاحقاً.');return;}
    // Permission request happens directly in the tap handler, before network awaits.
    const permissionRequest=Notification.requestPermission();
    void perform(async()=>{
      const choice=await permissionRequest;setPermission(choice);
      if(choice!=='granted')throw new Error('اسمحي بالإشعارات من إعدادات الآيفون ثم افتحي التطبيق مجدداً.');
      const registration=await navigator.serviceWorker.ready;
      let sub=await registration.pushManager.getSubscription();
      if(sub&&!status.pushReady){await sub.unsubscribe();sub=null;}
      sub=sub||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:applicationKey(status.publicKey)});
      await api('subscribe',{subscription:sub.toJSON()});await refresh();
    });
  }
  return <main>
    <div className="topline">
      <Button variant="ghost" className="utility" aria-label="ربط الجهازين" onClick={()=>{setError('');setPanel('pair');}}><Link2/></Button>
      <Button variant="ghost" className="utility" aria-label="تثبيت التطبيق" onClick={()=>setPanel('install')}><Download/></Button>
    </div>
    <h1 className="brand">ذِكر ❤️</h1>
    <div className="dhikr-list">{DHIKR.map((dhikr,id)=><Button key={dhikr} variant="outline" className="dhikr-button" disabled={busy||cooldown} onClick={()=>send(id)}>{dhikr} ❤️</Button>)}</div>
    <div className={'feedback'+(error?' error':'')} role="status" aria-live="polite">{error||feedback||(busy?<LoaderCircle className="spinner mx-auto" aria-label="جارٍ إتمام الطلب"/>:'')}</div>
    {!online&&<p className="offline">أنتِ غير متصلة بالإنترنت</p>}
    <div className="footer-action">{status.state==='new'?<Button variant="ghost" onClick={()=>setPanel('pair')}><Link2/>ربط الجهازين</Button>:!status.pushReady||permission!=='granted'?<Button variant="ghost" onClick={enableNotifications}><Bell/>تفعيل الإشعارات</Button>:status.state==='paired'?<Check className="status-icon" aria-label="الجهازان مرتبطان"/>:<Button variant="ghost" onClick={()=>setPanel('pair')}>بانتظار الجهاز الآخر</Button>}</div>
    {received&&<div className="notification-card"><p className="hint">تذكير ❤️</p><p>{received}</p><Button variant="ghost" onClick={()=>setReceived('')}>تم</Button></div>}
    <Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
      <DialogContent className="sheet" showCloseButton={false} dir="rtl">
        <DialogClose className="sheet-close" aria-label="إغلاق"><X/></DialogClose>
        <DialogTitle>{panel==='install'?'إضافة إلى الشاشة الرئيسية':'ربط الجهازين'}</DialogTitle>
        <DialogDescription>{panel==='install'?'ثبّتي التطبيق على كل آيفون قبل الربط وتفعيل الإشعارات.':'رمز واحد يربط الجهازين، دون أسماء أو ملفات شخصية.'}</DialogDescription>
        {panel==='install'?<>
          <section><p>١. افتحي الرابط في Safari.</p><p>٢. اضغطي «مشاركة»، ثم «إضافة إلى الشاشة الرئيسية».</p><p>٣. افتحي «ذِكر ❤️» من أيقونته، ثم اربطي الجهازين وفعّلي الإشعارات.</p></section>
          <p className="hint">تحتاج الإشعارات iOS 16.4 أو أحدث. لا يلزم حساب Apple Developer. لن تهتز أجهزة آيفون عند الضغط لأن Safari لا يدعم الاهتزاز.</p>
          {standalone&&<p>التطبيق مفتوح من الشاشة الرئيسية ✓</p>}
          <Button onClick={()=>setPanel('pair')}>ربط الجهازين</Button>
        </>:<>
          {status.state==='paired'?<section><p>الجهازان مرتبطان ❤️</p><p className="hint">{status.otherReady?'إشعارات الجهاز الآخر جاهزة.':'افتحي التطبيق على الجهاز الآخر وفعّلي الإشعارات.'}</p></section>:<>
            <section><h3>على الجهاز الأول</h3>{status.canCreate?<Button disabled={busy} onClick={()=>void perform(async()=>{const result=await api(status.canRecover?'recover':'create',{});setCode(result.code);await refresh();})}>{status.canRecover?'استعادة الربط على هذا الجهاز':'إنشاء رمز ربط'}</Button>:<><p className="hint">لإنشاء الرمز، سجّلي الدخول بحساب صاحبة التطبيق. الجهاز الآخر لا يحتاج تسجيل دخول.</p><Button asChild><a href="/signin-with-chatgpt?return_to=%2F%3Fpair%3D1" target="_top">دخول صاحبة التطبيق</a></Button></>}{status.canRecover&&<p className="hint">بدأ الربط من متصفح آخر. الاستعادة تنقل الربط غير المكتمل إلى هذا الجهاز وتصدر رمزاً جديداً.</p>}{code&&<><output className="pair-code">{code}</output><p className="hint">صالح لعشر دقائق. اكتبيه على الجهاز الآخر.</p></>}</section>
            {status.state==='new'&&<section><h3>على الجهاز الآخر</h3><label htmlFor="pair-code">إدخال رمز الربط</label><Input id="pair-code" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} placeholder="000000" value={entry} onChange={e=>setEntry(e.target.value.replace(/[٠-٩۰-۹]/g,d=>String(d.charCodeAt(0)%(d.charCodeAt(0)>1775?1776:1632))).replace(/\D/g,''))}/><Button disabled={busy||entry.length!==6} onClick={()=>void perform(async()=>{await api('join',{code:entry});setEntry('');await refresh();})}>ربط</Button></section>}
          </>}
          {status.state!=='new'&&<section><Button disabled={busy} onClick={enableNotifications}><Bell/>{status.pushReady&&permission==='granted'?'تحديث الإشعارات':'تفعيل الإشعارات'}</Button><Button variant="ghost" disabled={busy} onClick={()=>void refresh()}>تحديث حالة الربط</Button></section>}
          {!standalone&&<p className="hint">على آيفون: أضيفي التطبيق للشاشة الرئيسية وافتحيه من الأيقونة قبل الربط.</p>}
        </>}
        {error&&<p className="error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </main>;
}
