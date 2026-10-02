// A deliberate repair tap must issue a fresh browser subscription even when
// the server still has an old subscription and considers notifications ready.
export async function renewSubscription(registration, applicationServerKey) {
  const old = await registration.pushManager.getSubscription();
  if (old) {
    await old.unsubscribe();
    if (await registration.pushManager.getSubscription()) {
      throw new Error('تعذّر تجديد اشتراك الإشعارات.');
    }
  }
  return registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
}
