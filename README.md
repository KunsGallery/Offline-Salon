# Offline Salon Interactive Studio Pro

`local` 모드는 Firebase 설정 없이 동작합니다.
`firestore` 모드는 여러 기기 실시간 운영용입니다.

## 환경 변수

`.env.local` 예시:

```bash
VITE_REALTIME_MODE=firestore

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_REALTIME_MODE=local`일 때는 Firebase credentials 없이도 실행됩니다.

## 실행

```bash
npm run dev
```

```bash
npm run build
```

## Firestore Rules 주의사항

`firestore.rules.example`의 공개 규칙은 리허설/폐쇄형 테스트용입니다.

이 규칙은 링크를 아는 모든 사람이 세션/질문/응답 데이터를 수정할 수 있으므로, 실제 공개 운영 전에는 관리자 인증과 권한 분리가 필요합니다.

현재 참여자 좋아요/수정 기능은 비로그인 참여자를 기준으로 하므로, `participantId`는 브라우저 `localStorage` 기반입니다.
공개 대규모 운영에서는 익명 Auth 또는 세션 토큰 기반 검증으로 보강해야 합니다.

## 권한 구조

Public Read:
- Host Display
- Participant App

Public Write:
- Participant response create
- Participant lastSeen update
- Participant own-response update
- Participant response like toggle

Admin Only:
- session create/update/delete
- question create/update/delete/reorder/activate
- response hide/restore/delete
- showResults toggle
- CSV export
- reset session
- end session

## Firestore 모드 테스트 체크리스트

### 테스트 1 - 관리자 세션 생성
1. `/admin` 접속
2. 새 세션 생성
3. Firestore Console에서 `sessions` 문서 확인
4. 세션 제목 수정
5. Firestore Console에서 값 변경 확인

### 테스트 2 - 질문 생성/활성화
1. `/admin/:sessionId` 접속
2. 질문 생성
3. Firestore Console에서 `sessions/{sessionId}/questions` 확인
4. 질문 활성화
5. `sessions/{sessionId}.currentQuestionId` 확인
6. `showResults` 토글 확인

### 테스트 3 - 여러 기기 실시간 참여
1. PC에서 `/admin/:sessionId` 열기
2. PC 또는 TV에서 `/host/:sessionId` 열기
3. 모바일에서 `/client/:sessionId` 열기
4. 모바일에서 닉네임 입력
5. 답변 제출
6. 다른 모바일에서 같은 질문에 좋아요를 눌러 Host에 반짝임이 표시되는지 확인
7. Admin과 Host에 즉시 반영되는지 확인

### 테스트 4 - 결과 공개/숨김
1. Admin에서 `결과 공개` OFF
2. Host에서 `답변 수집 중` 상태 확인
3. Admin에서 `결과 공개` ON
4. Host에서 시각화 표시 확인

### 테스트 5 - 답변 숨김/복원
1. 참여자가 text 또는 wordcloud 답변 제출
2. Admin에서 답변 숨김
3. Host에서 해당 답변이 사라지는지 확인
4. Admin에서 복원
5. Host에 다시 표시되는지 확인

### 테스트 6 - 답변 수정
1. 참여자가 답변 제출
2. Client에서 수정하기 버튼 클릭
3. 기존 답변이 입력 폼으로 돌아오는지 확인
4. 수정 후 제출
5. Host와 Admin에 같은 response 문서가 실시간으로 갱신되는지 확인

## 관리자 로그인 설정

1. Firebase Console 접속
2. Authentication 활성화
3. Sign-in method에서 Google 제공업체 활성화
4. 프로젝트 지원 이메일 선택
5. Authentication > Settings > Authorized domains에서 현재 도메인 확인
   - `localhost`
   - `127.0.0.1`
   - 배포 도메인
6. `.env.local`에 Firebase Web App config 입력
7. `VITE_REALTIME_MODE=firestore` 설정
8. `npm run dev`
9. `/login`에서 Google 계정으로 로그인

Local mode에서는 관리자 로그인 없이 테스트할 수 있습니다.
Firestore mode에서는 관리자 화면 접근에 로그인이 필요합니다.

Google 로그인은 팝업 차단이나 모바일 Safari 환경에서 redirect fallback이 동작할 수 있습니다.

## 관리자 권한 예시

`firestore.rules.auth.example`는 로그인 기반 관리자 권한 분리 예시입니다.

더 안전한 운영을 위해서는 특정 관리자 이메일 allowlist, custom claims, 또는 `/admins/{uid}` 문서 기반 권한 확인을 검토해야 합니다.

주의:
- Firestore rules 문법은 배포 전에 Firebase Console에서 반드시 검증해야 합니다.
- 이메일 allowlist는 운영 정책상 관리가 쉬운 대신, custom claims보다 통제가 약할 수 있습니다.

## Google 로그인 테스트

### Firestore mode
1. `.env.local`에 `VITE_REALTIME_MODE=firestore` 설정
2. `/admin` 접속
3. `/login`으로 이동하는지 확인
4. `Google로 로그인` 클릭
5. Google 계정 선택
6. `/admin`으로 복귀하는지 확인
7. AdminStatusBar에 이메일이 표시되는지 확인
8. 세션 생성, 질문 생성, Host 열기, Client QR 접속, 응답 제출까지 확인

### 비로그인 상태
1. 로그아웃
2. `/admin` 접근 시 `/login`으로 이동하는지 확인
3. `/host/:sessionId`는 로그인 없이 열리는지 확인
4. `/client/:sessionId`는 로그인 없이 답변 제출이 가능한지 확인

## 행사 전 체크리스트

### 네트워크
- 행사장 Wi-Fi 확인
- 관리자 노트북, 호스트 디스플레이, 참여자 모바일이 같은 인터넷 환경에서 접속 가능한지 확인
- 모바일 데이터 환경에서도 Client 링크 접속 가능한지 확인

### 화면
- Host 화면을 실제 모니터/프로젝터에 띄워보기
- QR 코드가 2~3m 거리에서도 인식되는지 확인
- 질문 텍스트가 멀리서도 읽히는지 확인

### 데이터
- 리허설용 세션과 실제 운영용 세션 분리
- 행사 시작 전 responses 초기화
- CSV export 테스트
- 세션 종료 버튼 테스트

### 백업
- Firestore가 불안정할 경우 local 모드 사용 가능 여부 확인
- QR 링크를 별도로 메모
- 관리자 노트북 충전기 준비
- Host 화면 새로고침 시 복구되는지 확인
