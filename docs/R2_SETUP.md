# Cloudflare R2 연결 가이드

Offline-Salon은 Firebase Storage를 사용하지 않습니다. 이미지와 PDF는 Cloudflare R2에 저장하고, Netlify Function이 관리자 로그인을 확인한 뒤 5분짜리 업로드 URL을 발급합니다. R2 비밀키가 브라우저 번들에 포함되지 않는 구조입니다.

## 1. Cloudflare에서 준비

1. Cloudflare Dashboard → **R2 Object Storage** → **Create bucket**
2. 예시 이름: `offline-salon-media`
3. Bucket → **Settings → Custom Domains**에서 `assets.example.com` 같은 도메인을 연결합니다.
   - 빠른 테스트는 `r2.dev` Public Development URL도 가능하지만 운영용으로는 Custom Domain을 권장합니다.
4. R2 Overview → **Manage R2 API Tokens → Create API token**
5. 권한은 **Object Read & Write**, 대상은 위 버킷 하나로 제한합니다.
6. 생성 직후 표시되는 `Access Key ID`와 `Secret Access Key`를 안전하게 보관합니다. Secret은 다시 표시되지 않습니다.

## 2. R2 CORS 설정

Bucket → Settings → CORS Policy에서 루트의 `r2-cors.example.json` 내용을 붙여넣고 다음 주소를 실제 값으로 바꿉니다.

- `https://YOUR-SITE.netlify.app`
- 실제 서비스 도메인
- 로컬 Netlify CLI를 쓸 경우 `http://localhost:8888`

브라우저는 사전서명된 R2 S3 API 주소로 직접 `PUT`하므로 `PUT`, `Content-Type`, `Cache-Control` 허용이 반드시 필요합니다.

## 3. Netlify 환경 변수 입력 위치

Netlify Dashboard → 해당 Site → **Project configuration → Environment variables**에서 아래 값을 추가합니다. 가능하면 Scope를 **Functions**로 설정합니다.

| 변수 | 입력 값 |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 API Token의 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token의 Secret Access Key |
| `R2_BUCKET_NAME` | 예: `offline-salon-media` |
| `R2_PUBLIC_BASE_URL` | 예: `https://assets.example.com` (끝 `/` 제외) |
| `R2_ALLOWED_ORIGINS` | Netlify 주소와 실제 도메인을 쉼표로 구분 |
| `ADMIN_EMAILS` | 업로드를 허용할 Google 이메일, 여러 개면 쉼표 구분 |
| `FIREBASE_PROJECT_ID` | Firebase 프로젝트 ID (`VITE_FIREBASE_PROJECT_ID`와 같은 값) |

중요: 이 변수들은 절대 `VITE_` 접두사를 붙이지 않습니다. `VITE_` 변수는 브라우저에 공개됩니다.

별도 Firebase 서비스계정 JSON이나 Private Key는 필요하지 않습니다. Function은 Firebase의 공개 서명 인증서로 ID 토큰의 서명·만료·발급 프로젝트를 검증한 뒤 `ADMIN_EMAILS`를 확인합니다.

환경 변수를 저장한 뒤 새 Deploy를 실행해야 Function에 반영됩니다.

로컬에서 Firestore와 R2까지 함께 시험할 때는 `npm run dev` 대신 저장소 루트에서 `npx netlify dev`를 실행하고 `http://localhost:8888`로 접속합니다. `.env` 또는 Netlify CLI에 같은 서버 환경 변수가 있어야 합니다.

## 4. 기존 Firebase 웹 환경 변수

Firestore 실시간 기능과 Google 관리자 로그인은 계속 Firebase를 사용합니다. 아래 값은 기존처럼 Netlify Build 환경 변수에 둡니다.

```text
VITE_REALTIME_MODE=firestore
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_FIREBASE_STORAGE_BUCKET`은 더 이상 필요하지 않습니다.

## 5. 배포 후 확인

먼저 Firebase Console → Firestore Database → Rules에서 `firestore.rules.auth.example` 내용을 운영 규칙으로 반영하고 `your-admin-email@example.com`을 실제 관리자 이메일로 바꿔 Publish합니다. 새 `artworks`, `artworkSecrets`, `decks` 하위 컬렉션 규칙이 없으면 파일은 R2에 올라가도 자료 정보 저장이 거부됩니다.

1. 관리자 Google 로그인
2. 세션 → 세션 준비 → `Cloudflare R2 연결됨` 확인
3. 작은 JPG 작품 하나 등록
4. 작은 PDF 하나 등록
5. R2 Bucket의 `sessions/{sessionId}/...` 경로에 파일이 생겼는지 확인
6. Host와 모바일 리모컨에서 이미지/PDF가 열리는지 확인

오류 메시지별 확인:

- `R2_NOT_CONFIGURED`: Netlify 환경 변수 누락
- `AUTH_REQUIRED`: 관리자 로그인 토큰 없음
- `ADMIN_REQUIRED`: `ADMIN_EMAILS` 또는 Firebase `admin` custom claim 불일치
- `403/SignatureDoesNotMatch`: R2 API 키, Content-Type 또는 CORS 확인
- 브라우저 `CORS` 오류: R2 Bucket CORS의 서비스 Origin과 PUT 헤더 확인
