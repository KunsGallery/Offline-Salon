# Offline Salon Interactive Studio Pro

공통 운영 기능, 범용 좋아요, 참여자별 결과 갤러리와 다음 활동 확장 규칙은 [Offline Salon Core](docs/OFFLINE_SALON_CORE.md)에 정리되어 있습니다.

9월 전시 포도 활동의 운영 방식과 참고 전시 리스트 구조는 [9월 전시 포도](docs/SEPTEMBER_EXHIBITION_GRAPE.md)에 정리되어 있습니다.

`local` 모드는 Firebase 설정 없이 동작합니다.
`firestore` 모드는 여러 기기 실시간 운영용입니다.

## 환경 변수

`.env.local` 예시:

```bash
VITE_REALTIME_MODE=firestore

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
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

R2 Function까지 포함한 로컬 통합 실행은 `npx netlify dev`를 사용합니다.

## Firestore Rules 주의사항

`firestore.rules.example`의 공개 규칙은 리허설/폐쇄형 테스트용입니다.

이 규칙은 링크를 아는 모든 사람이 세션/질문/응답 데이터를 수정할 수 있으므로, 실제 공개 운영 전에는 관리자 인증과 권한 분리가 필요합니다.

실제 운영에는 `firestore.rules.auth.example`을 사용합니다. 배포 전 관리자 이메일 목록을 Netlify `ADMIN_EMAILS`와 같게 바꾸고, Firebase Authentication에서 **Google**과 **익명** 로그인을 모두 켜야 합니다.

참여자는 Firebase 익명 로그인 후 참여자 문서에 자신의 `uid`를 저장합니다. 이후 참여자 정보, 응답 수정, 좋아요는 그 `uid`와 일치할 때만 허용됩니다. 응답의 숨김·좋아요 수·작성자를 참여자가 임의로 바꿀 수 없고, PEAR PLAY 분석 결과는 관리자만 기록합니다.

이 규칙 이전에 만들어진 참여자 문서에는 `uid`가 없어 수정할 수 없습니다. 규칙은 행사 중이 아닌 시점에 배포하세요.

체크인 명단(이름·이메일·전화 뒷자리)은 공개 세션 문서가 아니라 관리자만 읽는 `sessions/{sessionId}/checkins/{applicationId}`에 저장합니다. 예전 세션 문서에 남은 `checkinApplications` 배열은 관리자가 `/admin` 목록이나 해당 세션의 체크인 화면을 열 때 하위 컬렉션으로 옮겨지고 세션 문서에서 삭제됩니다.

### 보안 규칙 테스트

`firestore.rules.auth.example`은 Firebase 에뮬레이터 테스트(`tests/rules/firestore-rules.mjs`)로 검증합니다. 에뮬레이터에는 Java 11 이상이 필요합니다.

```bash
brew install openjdk@21
```

```bash
PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH" npm run test:rules
```

규칙을 바꿀 때는 Console에 배포하기 전에 이 테스트를 먼저 통과시킵니다. 테스트의 관리자 이메일은 규칙 파일의 예시 값(`your-admin-email@example.com`)을 사용하므로, 실제 이메일로 바꾼 사본은 저장소에 커밋하지 않습니다.

## 권한 구조

Public Read:
- Host Display
- Participant App

Participant Write (익명 로그인 uid 확인):
- Participant own document create/update (nickname, avatar, grape, PEAR photo hand-in)
- Participant response create
- Participant own-response update
- Participant response like toggle (own like only)

Admin Only:
- session create/update/delete
- question create/update/delete/reorder/activate
- artwork/PDF create/update/delete/reorder
- private artwork title/artist/description read/write
- Cloudflare R2 upload URL issue/delete
- response hide/restore/delete
- showResults toggle
- CSV export
- reset session
- end session
- check-in roster read/write
- PEAR PLAY AI investigation (Netlify Function, `ADMIN_EMAILS`)

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

## 포스터 자동 컬러

새 세션 생성 화면에서 포스터를 선택하면 브라우저에서 대표 색상 3개를 추출합니다. 외부 AI나 이미지 분석 서버로 포스터를 보내지 않으며, 추출된 색은 관리자·Host·Client·Remote 화면의 주요 색상으로 사용됩니다.

기존 세션은 `/admin/:sessionId`의 `세션 준비 → 포스터·테마`에서 포스터를 교체할 수 있습니다. 저장 전에 실제 버튼·배경·강조색 미리보기가 표시됩니다.

## Artwork Title Lab

1. 세션 관리자 화면에서 작품 이미지, 실제 작품명, 작가, 설명을 등록합니다.
2. `화면에 띄우기`를 누르면 Host 화면에 작품이 크게 표시되고 Client는 작품명 제출 화면으로 전환됩니다.
3. 제목이 도착할 때마다 Host 화면에 익명 캡션이 추가됩니다.
4. `투표` 단계에서는 Client가 제목에 좋아요를 보낼 수 있습니다.
5. 좋아요가 많은 제목은 Host 화면에서 커지고 황금색으로 변합니다.
6. `정답 공개`에서 실제 작품 정보가 표시됩니다.

같은 작품을 다시 시작하면 새로운 내부 질문과 `runId`가 생성되어 이전 진행과 응답이 분리됩니다.

## PDF Presentation

- `/admin/:sessionId`에서 50MB 미만 PDF를 등록합니다.
- 업로드 시 페이지 수와 첫 페이지 표지가 자동 생성됩니다.
- `발표 시작`을 누르면 `/host/:sessionId`가 PDF 전체 화면으로 전환됩니다.
- 관리자 화면의 두 번째 QR을 휴대폰으로 스캔해 `/remote/:sessionId` 리모컨에서 이전·다음 페이지를 제어합니다.
- 하단 `질문 화면`을 누르면 기존 실시간 질문 화면으로 돌아갑니다.
- Client 화면은 PDF 발표 중 앞 화면을 보도록 안내하는 동반 화면으로 전환됩니다.

PPTX는 현재 지원하지 않습니다.

이미지와 PDF는 Firebase Storage가 아닌 Cloudflare R2에 저장합니다. API 키 입력 위치와 CORS 설정은 [`docs/R2_SETUP.md`](docs/R2_SETUP.md), 행사 진행 순서는 [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md)를 확인하세요.

로컬 모드의 미디어는 현재 브라우저 탭에서만 유지되는 리허설용입니다. 실제 행사와 여러 기기 동기화에는 Firestore 모드를 사용하세요.

## Join 체크인 연동

세션 설정의 `Join 살롱 ID`에는 Join 프로젝트의 `salonEvents` 문서 ID를 입력하고 저장합니다. 이 값은 Join의 체크인 요청에서 사용하는 `salonId`와 같아야 합니다.

Salon Netlify에는 `JOIN_CHECKIN_SHARED_SECRET`을 등록하고, Join Netlify에는 같은 값을 `SALON_CHECKIN_SHARED_SECRET`으로 등록합니다. 이 값은 기존에 찾아오는 시크릿이 아니라 두 프로젝트가 공유할 새 랜덤 문자열입니다. 예를 들어 터미널에서 `openssl rand -hex 32`로 생성할 수 있으며, 브라우저 환경변수(`VITE_` 접두사)로 등록하면 안 됩니다.

Join QR 체크인 요청은 Salon 서버 함수가 처리합니다. Join 검증이 성공하거나 이미 체크인된 상태일 때만 Salon 출석 명단을 갱신하며, 알림톡 발송 실패는 입장 완료와 별도로 명단에서 확인할 수 있습니다.

입장 완료는 Join 출석 트랜잭션 응답 직후 표시하고, Salon 명단 저장은 순차적으로 진행합니다. 저장 실패한 참가자는 최근 입장 영역의 재시도 목록에 남으며, 다음 참가자의 QR 스캔을 막지 않습니다. 여러 체크인 기기의 명단 저장은 Firestore 트랜잭션으로 병합합니다. QR 인식 순간 화면을 정지하고 표시하며, 입장 확인 후 1.2초에 스캔을 재개합니다.

브라우저 콘솔의 `[checkin-timing]`에는 QR 디코드(기본 스캐너), Join 응답, Salon 명단 저장 시간이 기록됩니다. Salon 응답의 `Server-Timing`에는 Join 조회·출석 트랜잭션·프록시 요청 시간이 포함됩니다. QR 원문과 참가자 개인정보는 성능 로그에 기록하지 않습니다. Join은 Request/Context 함수 형식으로 배포해야 `context.waitUntil()`을 통해 환영 알림 발송을 응답 이후에도 실행할 수 있습니다.

체크인 화면 회귀 테스트: `VITE_REALTIME_MODE=local npm run test:e2e -- tests/admin-media.spec.js --grep 'check-in core|Join QR|camera freezes|Salon saves|QR-only fallback'`.

## PEAR PLAY 사전 조사와 역추리

PEAR PLAY를 활성화한 세션의 관리자 `세션 준비 → 역추리 사전 조사`에서 사진을 등록하면 기존 사진 분석 API로 연관 작품을 찾아 세션에 저장합니다. 여러 장은 순서대로 업로드·조사하며, 실패한 사진은 개별적으로 다시 조사할 수 있습니다. 사전 조사는 현재 호스트 화면을 바꾸지 않습니다.

모임 당일 모바일 리모컨의 `사전 조사 · 역추리` 목록에서 조사 완료 사진을 누르면 토끼 탐정의 보드에 찾은 작품 하나만 표시됩니다. 참가자 휴대폰에도 같은 작품만 표시합니다. `원본 사진 공개`로 두 이미지를 나란히 보여주고, `연결 이유 보기`로 설명을 공개합니다. `작품만 다시 보기`로 추측 단계로 돌아갈 수 있습니다. 당일 공개에는 AI 요청을 다시 보내지 않습니다.

사전 조사 자료는 `pearPreparedCases`, 선택은 `stage.pearPreparedCaseId`로 저장합니다. 참가자 접수·인원·코르크 보드 목록에 사전 자료를 섞지 않습니다. 실서비스의 원본은 R2에 저장되며, 로컬 모드의 업로드 URL은 기존 미디어와 동일하게 현재 브라우저의 미리보기 전용입니다. 공개 단계는 화면 표시를 제어하며, 원본을 세션 데이터에서 암호화하거나 비공개로 보관하는 기능은 아닙니다.
