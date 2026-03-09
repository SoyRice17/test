const express = require('express');
const path = require('path');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3000;

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:test@example.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn('[WARN] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 환경 변수가 없습니다.');
  console.warn('       push 전송 API는 동작하지 않지만, 앱은 실행됩니다.');
}

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/config', (req, res) => {
  res.json({ vapidPublicKey: vapidPublicKey || null });
});

let latestSubscription = null;

app.post('/subscribe', (req, res) => {
  latestSubscription = req.body;
  res.status(201).json({ ok: true });
});

app.post('/notify', async (req, res) => {
  if (!latestSubscription) {
    return res.status(400).json({ ok: false, message: '아직 구독(subscription)이 없습니다.' });
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return res.status(500).json({ ok: false, message: 'VAPID 키 환경 변수가 설정되지 않았습니다.' });
  }

  const payload = JSON.stringify({
    title: req.body?.title || 'iPhone PWA 테스트 알림',
    body: req.body?.body || '알림이 정상적으로 도착했습니다 🎉',
    url: req.body?.url || '/'
  });

  try {
    await webpush.sendNotification(latestSubscription, payload);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
