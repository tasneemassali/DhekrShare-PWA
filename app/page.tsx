'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, Link2, Unlink, LoaderCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { DHIKR } from '@/lib/dhikr';
import { renewSubscription } from '@/lib/notifications.mjs';

type Status = { subscriptionID:string|null; state: 'new' | 'waiting' | 'paired'; pushReady: boolean; otherReady: boolean; publicKey: string; configured: boolean; canCreate:boolean; canRecover:boolean };
const empty: Status = {subscriptionID:null,state:'new',pushReady:false,otherReady:false,publicKey:'',configured:false,canCreate:false,canRecover:false};
async function api(action: string, body?: object) {
  const response = await fetch('/api/dhikr'+(body ? '' : '?action='+action), {
    method:body?'POST':'GET', credentials:'same-origin', cache:'no-store',
    ...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...body})}:{}),
  });
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('انتهت جلسة الدخول.');
  }
  const data = await response.json() as Status & {error?:string;code:string;accepted?:boolean};
  if (!response.ok) throw new Error(data.error || 'تعذّر الاتصال.');
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
  const [confirmUnlink,setConfirmUnlink]=useState(false);
  const [busy,setBusy]=useState(false);
  const [cooldown,setCooldown]=useState(false);
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const [online,setOnline]=useState(true);
  const [standalone,setStandalone]=useState(false);
  const [permission,setPermission]=useState('default');
  const [received,setReceived]=useState('');
  const [localTest,setLocalTest]=useState('');
  const [subscriptionMatches,setSubscriptionMatches]=useState<boolean|null>(null);
  const lock=useRef(false);
  const sw=useRef<ServiceWorkerRegistration|null>(null);
  const subscriptionSync=useRef<Promise<void>|null>(null);
  const statusRef=useRef(status); statusRef.current=status;
  const refresh=useCallback(async()=>{
    try {const next=await api('status');statusRef.current=next;setStatus(next);return next as Status;}
    catch(e){setError((e as Error).message);return null;}
  },[]);
  const syncSubscription=useCallback(async()=>{
    if(!sw.current||statusRef.current.state==='new'||!statusRef.current.pushReady||lock.current) return;
    if(subscriptionSync.current)return subscriptionSync.current;
    const task=(async()=>{
      const sub=await sw.current!.pushManager?.getSubscription();
      if(sub&&!lock.current){
        const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sub.endpoint));
        const id=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
        const matches=id===statusRef.current.subscriptionID;
        setSubscriptionMatches(matches);
        if(matches)await api('subscribe',{subscription:sub.toJSON()});
      }
    })();
    subscriptionSync.current=task;
    try{await task;}finally{subscriptionSync.current=null;}
  },[]);
  useEffect(()=>{
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & {standalone?:boolean}).standalone);
    setPermission('Notification' in window?Notification.permission:'unsupported');
    const network=()=>setOnline(navigator.onLine);
    network(); window.addEventListener('online',network);window.addEventListener('offline',network);
    if(new URLSearchParams(window.location.search).has('pair'))setPanel('pair');
    void refresh();
    if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(async reg=>{
      sw.current=reg;
      void reg.update().catch(()=>{});
      await navigator.serviceWorker.ready;
      await syncSubscription();
    }).catch(()=>setError('تعذّر تجهيز الإشعارات.'));
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
      try{await api('send',{dhikrID:id});setFeedback('تم الذكر');}
      finally{setTimeout(()=>setCooldown(false),Math.max(0,2000-(Date.now()-started)));}
    });
  }
  function enableNotifications(){
    if(!('Notification' in window)||!('PushManager' in window)||!sw.current){setPanel('install');return;}
    if(status.state==='new'){setError('الجهاز غير مرتبط.');setPanel('pair');return;}
    if(!status.publicKey){setError('الإشعارات غير جاهزة بعد.');return;}
    // Permission request happens directly in the tap handler, before network awaits.
    const permissionRequest=Notification.requestPermission();
    void perform(async()=>{
      const choice=await permissionRequest;setPermission(choice);
      if(choice!=='granted')throw new Error('إذن الإشعارات غير متاح.');
      const registration=await navigator.serviceWorker.ready;
      await subscriptionSync.current?.catch(()=>{});
      const sub=await renewSubscription(registration,applicationKey(status.publicKey));
      await api('subscribe',{subscription:sub.toJSON()});setSubscriptionMatches(true);await refresh();
    });
  }
  function testNotifications(){
    void perform(async()=>{
      setLocalTest('');
      if(!('Notification' in window)||Notification.permission!=='granted')throw new Error('إذن الإشعارات غير متاح في هذه النسخة.');
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification('تذكير',{body:'اختبار الإشعارات',lang:'ar',dir:'rtl',icon:'/icons/icon-192.png',data:{url:'/'}});
      setLocalTest('تم طلب إشعار اختبار على هذا الجهاز');
    });
  }
  return <main>
    <header className="topline">
      <h1 className="brand">ذِكر</h1>
      <Button variant="ghost" className="pair-control" onClick={()=>{setError('');setConfirmUnlink(false);setPanel('pair');}}><Link2/>الربط</Button>
    </header>
    <div className="dhikr-list">{DHIKR.map((dhikr,id)=><Button key={dhikr} variant="outline" className="dhikr-button" disabled={busy||cooldown} onClick={()=>send(id)}>{dhikr}</Button>)}</div>
    <div className={'feedback'+(error?' error':'')} role="status" aria-live="polite">{error||feedback||(busy?<LoaderCircle className="spinner mx-auto" aria-label="جارٍ إتمام الطلب"/>:'')}</div>
    {!online&&<p className="offline">لا يوجد اتصال بالإنترنت</p>}

    {received&&<div className="notification-card"><p className="hint">تذكير</p><p>{received}</p><Button variant="ghost" onClick={()=>setReceived('')}>تم</Button></div>}
    <Dialog open={panel!==null} onOpenChange={open=>{if(!open)setPanel(null);}}>
      <DialogContent className="sheet" showCloseButton={false} dir="rtl">
        <DialogClose className="sheet-close" aria-label="إغلاق"><X/></DialogClose>
        <DialogTitle>{panel==='install'?'إضافة إلى الشاشة الرئيسية':'ربط الجهازين'}</DialogTitle>
        <DialogDescription className="sr-only">إدارة الربط والإشعارات</DialogDescription>
        {panel==='install'?<>
          <section><p>آيفون: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية.</p><p>أندرويد: Chrome ← القائمة ← تثبيت التطبيق.</p></section>
          <p className="hint">إشعارات آيفون متاحة من أيقونة الشاشة الرئيسية على iOS 16.4 أو أحدث.</p>
          {standalone&&<p>نسخة الشاشة الرئيسية ✓</p>}
          <Button onClick={()=>setPanel('pair')}>الربط</Button>
        </>:<>
          {status.state==='paired'?<section>
            <p className="pair-state"><Check/>الجهازان مرتبطان</p>
            <p className="hint">{status.otherReady?'إشعارات الجهاز الآخر مفعّلة':'إشعارات الجهاز الآخر غير مفعّلة'}</p>
          </section>:<>
            <section>
              {status.canCreate?<Button disabled={busy} onClick={()=>void perform(async()=>{const result=await api(status.canRecover?'recover':'create',{});setCode(result.code);await refresh();})}>{status.canRecover?'استعادة الربط':'إنشاء رمز ربط'}</Button>:<Button asChild><a href="/signin-with-chatgpt?return_to=%2F%3Fpair%3D1" target="_top">دخول مالك التطبيق</a></Button>}
              {code&&<><output className="pair-code">{code}</output><p className="hint">صالح لعشر دقائق</p></>}
            </section>
            {status.state==='new'&&<section>
              <label htmlFor="pair-code">رمز الربط</label>
              <Input id="pair-code" inputMode="numeric" autoComplete="off" dir="ltr" maxLength={6} placeholder="000000" value={entry} onChange={e=>setEntry(e.target.value.replace(/[٠-٩۰-۹]/g,d=>String(d.charCodeAt(0)%(d.charCodeAt(0)>1775?1776:1632))).replace(/\D/g,''))}/>
              <Button disabled={busy||entry.length!==6} onClick={()=>void perform(async()=>{await api('join',{code:entry});setEntry('');setCode('');await refresh();})}>ربط</Button>
            </section>}
          </>}
          {status.state!=='new'&&<section>
            {subscriptionMatches===false&&<p className="hint">الإشعارات مرتبطة بنسخة أخرى من التطبيق</p>}
            <Button disabled={busy} onClick={enableNotifications}><Bell/>{status.pushReady&&permission==='granted'?'إصلاح الإشعارات':'تفعيل الإشعارات'}</Button>
            <Button variant="ghost" disabled={busy} onClick={testNotifications}>اختبار الإشعارات</Button>
            {localTest&&<p className="hint" role="status">{localTest}</p>}
            {!confirmUnlink?<Button variant="ghost" disabled={busy} onClick={()=>setConfirmUnlink(true)}><Unlink/>فصل الربط</Button>:<div className="unlink-confirm">
              <p>فصل الربط يوقف التواصل مع الجهاز الآخر. يمكن إنشاء رمز جديد بعدها.</p>
              <Button className="danger-button" disabled={busy} onClick={()=>void perform(async()=>{await api('unlink',{});setCode('');setEntry('');setReceived('');setFeedback('');setConfirmUnlink(false);await refresh();})}>تأكيد الفصل</Button>
              <Button variant="ghost" disabled={busy} onClick={()=>setConfirmUnlink(false)}>إلغاء</Button>
            </div>}
          </section>}
          <Button variant="ghost" onClick={()=>setPanel('install')}>تثبيت التطبيق</Button>
        </>}
        {error&&<p className="error" role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  </main>;
}
