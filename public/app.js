const statusEl = document.getElementById('status');
const btnInstallHint = document.getElementById('btn-install-hint');
const btnEnable = document.getElementById('btn-enable');
const btnSend = document.getElementById('btn-send');

const setStatus = (message) => {
  statusEl.textContent = message;
};

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

btnInstallHint.addEventListener('click', () => {
  alert('Safari 공유 버튼 → 홈 화면에 추가 후, 홈 화면 아이콘으로 앱을 다시 실행하세요.');
});

btnEnable.addEventListener('click', async () => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('이 브라우저는 Service Worker 또는 Push API를 지원하지 않습니다.');
      return;
    }

    const swReg = await navigator.serviceWorker.register('/sw.js');
    const configRes = await fetch('/config');
    const { vapidPublicKey } = await configRes.json();

    if (!vapidPublicKey) {
      setStatus('서버에 VAPID_PUBLIC_KEY가 설정되지 않았습니다. README를 확인하세요.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setStatus('알림 권한이 거부되었습니다. iPhone 설정에서 허용하세요.');
      return;
    }

    const subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    await fetch('/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    setStatus('구독 완료 ✅\n이제 "테스트 알림 보내기"를 누르세요.');
  } catch (error) {
    setStatus(`구독 중 오류: ${error.message}`);
  }
});

btnSend.addEventListener('click', async () => {
  try {
    const res = await fetch('/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'iPhone PWA 푸시 테스트',
        body: '정상 수신되면 성공입니다.',
        url: '/'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus(`알림 전송 실패: ${data.message}`);
      return;
    }

    setStatus('알림 전송 요청 완료 ✅\n잠금 화면/알림 센터를 확인하세요.');
  } catch (error) {
    setStatus(`알림 전송 오류: ${error.message}`);
  }
});

setStatus('준비됨. 먼저 PWA를 홈 화면에 추가하세요.');
