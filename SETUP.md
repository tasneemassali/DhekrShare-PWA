# Set up ذِكر ❤️ from your iPhone

This is the new **PWA** project. You do not need Apple Developer enrollment, TestFlight, Xcode, Firebase, or a Mac. The old native app repository is separate and unchanged.

## 1. Open the app

Open this address in **Safari**:

https://dhekrshare-pwa.hbmw2mmpvk.chatgpt.site

The link can open on both phones. **Only the first phone needs the owner's ChatGPT sign-in to create a pairing code. The second phone does not need to sign in or receive a separate site-sharing invitation.** Never share your password.

If the first phone shows **دخول صاحبة التطبيق**, tap it and sign in with the same ChatGPT account that owns this Site. After returning, open **ربط الجهازين** and create the code.

## 2. Add it to each iPhone's Home Screen

1. In Safari, tap **Share** (the square with an upward arrow).
2. Choose **Add to Home Screen / إضافة إلى الشاشة الرئيسية**. Scroll through the actions if needed.
3. Keep the name **ذِكر ❤️** and tap **Add / إضافة**.
4. Close Safari and open the new icon on the Home Screen.
5. Repeat on your sister's phone.

Both phones need iOS 16.4 or later. Check Settings → General → About → iOS Version. On supported versions, the installed web app can receive notifications without being kept open on screen.

**Install first, pair second.** Safari and a Home Screen installation may have different storage. Pairing in the browser tab first can consume a slot for the wrong installation.

## 3. Pair the installed apps

On your phone:

1. Tap the link icon or **ربط الجهازين**. If shown, tap **دخول صاحبة التطبيق** and sign in with your own ChatGPT account.
2. Tap **إنشاء رمز ربط**. If an unfinished pair was started in Safari, use **استعادة الربط على هذا الجهاز** to move it to the installed app and receive a fresh code.
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

- **Owner sign-in requested:** this is only for creating a code on the first phone. On the second phone use **إدخال رمز الربط** directly.
- **Previously saw a login error on the second phone:** fully close and reopen the app to load the repaired version. The second phone should now accept the code without ChatGPT sign-in.
- **No notification option:** add the site to the Home Screen, open that icon, and check iOS 16.4+.
- **Other device not ready:** enable notifications and reopen the app on that device.
- **Success but no banner:** check Focus, notification settings and connectivity. Success means push-service acceptance, not proof that the phone displayed it.
- **No internet:** reconnect and retry deliberately. The app does not queue or automatically resend reminders.
- **Expired code:** the original first installation can generate a new code.
- **Pair started in the wrong browser:** sign in as the owner and choose **استعادة الربط على هذا الجهاز**. This works only before the second phone joins.
- **Third device or deleted installation after pairing:** administrator recovery is needed; there is no public takeover/reset button.

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

### Safari says “Response served by service worker has redirections”

The updated app no longer intercepts page navigation or sign-in redirects. Open the main app link in Safari, wait a few seconds for its notification worker to update, then reopen the app and retry sign-in. Do not delete the app or clear website data: that can remove your device pairing cookie. A fresh launch requires an internet connection.
