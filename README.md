# iPhone PWA 알림 테스트

iPhone에서 PWA(Web App)로 푸시 알림이 도착하는지 직접 테스트할 수 있는 최소 예제입니다.

## 사전 조건

- iOS 16.4 이상
- Safari에서 사이트를 **홈 화면에 추가**해서 실행
- HTTPS 환경(로컬 테스트는 `localhost` 가능, 실기기 접속은 HTTPS 권장)

## 실행 방법

```bash
npm install
npx web-push generate-vapid-keys
```

생성된 키를 환경 변수로 설정 후 실행:

```bash
export VAPID_PUBLIC_KEY="<public key>"
export VAPID_PRIVATE_KEY="<private key>"
export VAPID_SUBJECT="mailto:you@example.com"
npm start
```

## iPhone 테스트 순서

1. 서버 주소를 iPhone Safari로 엽니다.
2. 공유 버튼 → **홈 화면에 추가**.
3. 홈 화면의 앱 아이콘으로 다시 실행합니다.
4. `1) 알림 권한 + 구독` 버튼을 눌러 권한/구독을 완료합니다.
5. `2) 테스트 알림 보내기` 버튼을 눌러 푸시를 발송합니다.
6. 잠금 화면 또는 알림 센터에서 수신 여부를 확인합니다.

## 파일 구조

- `server.js`: 정적 파일 제공 + 구독 저장 + 테스트 알림 발송 API
- `public/sw.js`: 푸시 수신/클릭 처리 Service Worker
- `public/app.js`: 권한 요청, 구독, 서버 알림 요청
- `public/manifest.json`: PWA 매니페스트

## 참고

- 이 예제는 구독 정보를 메모리에만 저장합니다(서버 재시작 시 초기화).
- 실제 서비스에서는 구독 정보를 DB에 저장하고 사용자별로 관리하세요.
