# Set up ذِكر ❤️ from your iPhone

This is the new **PWA** project. You do not need Apple Developer enrollment, TestFlight, Xcode, Firebase, or a Mac. The old native app repository is separate and unchanged.

## 1. Open the private app

Open this address in **Safari**:

https://dhekrshare-pwa.hbmw2mmpvk.chatgpt.site

Sign in with your own ChatGPT account if asked. The hosting platform protects this private site; the app itself has no names or profile screen.

**Before your sister opens the link:** grant her access using the Site's Share/access controls in ChatGPT. Keep access restricted to the two of you. Do not make the Site public and do not give her your password. If your account does not offer individual Site sharing, two-person access is blocked until an appropriate sharing/hosting option is available; a pairing code cannot bypass that restriction.

## 2. Add it to each iPhone's Home Screen

1. In Safari, tap **Share** (the square with an upward arrow).
2. Choose **Add to Home Screen / إضافة إلى الشاشة الرئيسية**. Scroll through the actions if needed.
3. Keep the name **ذِكر ❤️** and tap **Add / إضافة**.
4. Close Safari and open the new icon on the Home Screen.
5. Repeat on your sister's phone after she has private-site access.

Both phones need iOS 16.4 or later. Check Settings → General → About → iOS Version. On supported versions, the installed web app can receive notifications without being kept open on screen.

**Install first, pair second.** Safari and a Home Screen installation may have different storage. Pairing in the browser tab first can consume a slot for the wrong installation.

## 3. Pair the installed apps

On your phone:

1. Tap the link icon or **ربط الجهازين**.
2. Tap **إنشاء رمز ربط**.
3. Give your sister the displayed six-digit code. It expires after ten minutes.

On your sister's phone:

1. Open the installed icon and tap **ربط الجهازين**.
2. Under **إدخال رمز الربط**, enter the code.
3. Tap **ربط**.

Your phone checks periodically while open. You can also tap **تحديث حالة الربط**. Once paired, no third device can join. No names appear.

## 4. Allow notifications on both phones

1. Tap **تفعيل الإشعارات** in the app.
2. Tap **Allow / السماح** on Apple's permission prompt.
3. Repeat on the other phone.
4. Keep both apps open briefly so their subscriptions are saved.

If permission was denied, open iPhone Settings → Notifications → **ذِكر ❤️**, allow notifications, then reopen the installed app. If the option is absent, confirm you opened the installed icon rather than a Safari tab.

## 5. Test both directions

1. Lock your sister's phone.
2. Tap **استغفر الله ❤️** on your phone.
3. You should see **تم الذكر ❤️** after the push provider accepts the message.
4. Her notification should show **تذكير ❤️** and **استغفر الله**, without a sender name.
5. Send one back from her phone.

Try all seven buttons, dark mode, large text, and a notification while the receiver is using another app. The buttons pause for two seconds to prevent rapid taps. No iPhone vibration is promised: Safari does not support the vibration API.

## If something does not work

- **Access denied:** the Site owner must grant access through hosting sharing settings; pairing cannot grant Site access.
- **Login expired:** close/reopen the app and sign in with your own account.
- **No notification option:** add the site to the Home Screen, open that icon, and check iOS 16.4+.
- **Other device not ready:** enable notifications and reopen the app on that device.
- **Success but no banner:** check Focus, notification settings and connectivity. Success means push-service acceptance, not proof that the phone displayed it.
- **No internet:** reconnect and retry deliberately. The app does not queue or automatically resend reminders.
- **Expired code:** the original first installation can generate a new code.
- **Third device or deleted installation:** administrator recovery is needed; there is no public takeover/reset button.

## Administrator recovery and deletion

The hosted D1 database contains `pair` and `limits`. To intentionally reset both devices, an administrator can run these separately through the hosting/database administration interface:

```sql
DELETE FROM pair WHERE id = 1;
DELETE FROM limits;
```

This erases pairing and subscriptions and disconnects both phones. Then pair again from the two installed apps and enable notifications. Old cookies cannot send after reset. Deleting only one phone's app is not an administrator reset.

To stop using the service, delete these records and remove/disable the hosted Site. To rotate VAPID signing keys, set a new server-only pair and have both phones renew subscriptions; never paste private keys into GitHub or chat.

## GitHub privacy

At creation time, `tasneemassali/DhekrShare-PWA` was public. The connected GitHub tools could write files but could not change repository visibility. To make it private: repository **Settings → General → Danger Zone → Change repository visibility → Private**. Repository privacy and hosted Site access are separate settings. No server secrets are committed either way.
