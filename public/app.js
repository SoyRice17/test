const statusEl = document.getElementById('status');
const btnInstallHint = document.getElementById('btn-install-hint');
const btnEnable = document.getElementById('btn-enable');
const btnSend = document.getElementById('btn-send');

const setStatus = (message) => {
  statusEl.textContent = message;
};

const isStandaloneMode = () => {
  const byNavigator = typeof navigator.standalone === 'boolean' && navigator.standalone;
  const byMediaQuery = window.matchMedia('(display-mode: standalone)').matches;
  return byNavigator || byMediaQuery;
};

const getIosVersion = () => {
  const iosMatch = navigator.userAgent.match(/OS (\d+)[._](\d+)/i);
  if (!iosMatch) {
    return null;
  }

  return {
    major: Number(iosMatch[1]),
    minor: Number(iosMatch[2])
  };
};

const compareVersion = (current, min) => {
  if (!current) return -1;
  if (current.major !== min.major) {
    return current.major > min.major ? 1 : -1;
  }
  if (current.minor !== min.minor) {
    return current.minor > min.minor ? 1 : -1;
  }
  return 0;
};

const validatePushEnvironment = () => {
  const errors = [];
  const warnings = [];
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!window.isSecureContext) {
    errors.push('HTTPS 환경이 아닙니다. iPhone 실기기에서는 HTTPS(또는 localhost)에서만 동작합니다.');
  }

  if (!('Notification' in window)) {
    errors.push('이 브라우저는 Notification API를 지원하지 않습니다.');
  }

  if (!('serviceWorker' in navigator)) {
    errors.push('이 브라우저는 Service Worker를 지원하지 않습니다.');
  }

  if (!('PushManager' in window)) {
    errors.push('이 브라우저는 Push API를 지원하지 않습니다.');
  }

  if (isIos) {
    const version = getIosVersion();
    if (compareVersion(version, { major: 16, minor: 4 }) < 0) {
      errors.push('iOS 16.4 이상에서만 웹 푸시를 지원합니다. iOS를 업데이트해 주세요.');
    }

    if (!isStandaloneMode()) {
      errors.push('Safari 탭에서는 권한 요청이 차단됩니다. 홈 화면에 추가 후 앱 아이콘으로 실행하세요.');
    }
  } else {
    warnings.push('현재 iOS 기기가 아닙니다. iPhone 실기기에서 최종 검증하세요.');
  }

  return { errors, warnings };
};

const renderValidationStatus = () => {
  const { errors, warnings } = validatePushEnvironment();
  const lines = [];

  if (errors.length === 0) {
    lines.push('환경 점검 통과 ✅');
  } else {
    lines.push('환경 점검 실패 ❌');
    errors.forEach((error) => lines.push(`- ${error}`));
  }

  warnings.forEach((warning) => lines.push(`- 참고: ${warning}`));
  setStatus(lines.join('\n'));

  return errors.length === 0;
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
    if (!renderValidationStatus()) {
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
    if (error.name === 'NotAllowedError') {
      setStatus('알림 권한이 차단되었습니다. iPhone 설정 > 알림에서 허용 후 다시 시도하세요.');
      return;
    }

    if (error.name === 'InvalidStateError') {
      setStatus('홈 화면 앱이 아닌 상태로 보입니다. 앱 아이콘으로 다시 실행한 뒤 시도하세요.');
      return;
    }

    setStatus(`구독 중 오류: ${error.message} (${error.name})`);
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

renderValidationStatus();
