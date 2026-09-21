# PEAR PLAY 운영 메모

## 기능 흐름

1. 관리자 세션 편집에서 `PEAR PLAY` 모듈을 선택하고 저장합니다.
2. 리모컨에서 `PEAR PLAY` 화면을 엽니다.
3. 참가자는 QR로 들어와 사진 한 장을 업로드합니다.
4. 사진은 R2의 `sessions/{sessionId}/pear/...` 경로에 저장되고 호스트 대기 목록에 나타납니다.
5. 호스트가 사진을 선택하면 호스트 화면에 사진이 크게 열립니다.
6. 리모컨에서 `토끼 탐정의 추리 시작`을 눌러야 Netlify Function `pear-play`가 사진을 분석하고 웹 검색으로 실제 작품 후보를 확인합니다.
7. 분석 결과는 Firestore `sessions/{sessionId}/participants/{participantId}.pearPairing`에 저장됩니다.
8. 호스트는 `작품 공개하기`를 눌러야 작품 이미지와 작가, 제목, 연도, 크기, 재료 캡션을 공개할 수 있습니다.
9. `CASE BOARD`에서 공개된 모든 Pair를 한 화면에 모읍니다.

## Netlify 환경변수

Netlify의 `Offline Salon` 사이트에서 **Site configuration → Environment variables**에 아래 값을 등록합니다.

```text
OPENAI_API_KEY=sk-...
PEAR_PLAY_MODEL=gpt-5.6
PEAR_PLAY_ALLOWED_ORIGINS=https://salon.unframe.kr
```

`OPENAI_API_KEY`는 브라우저 변수로 만들지 말고 Netlify Functions 런타임에만 둡니다. 값을 등록하거나 수정한 뒤에는 반드시 새 배포가 필요합니다.

기존 R2 참가자 업로드 환경변수와 Firebase 환경변수도 운영 환경에 남아 있어야 합니다.

## 운영 전 확인

- `salon.unframe.kr`에서 사진 업로드가 완료되는지 확인합니다.
- AI 결과의 작품 카드에 제목, 작가, 이미지, 출처 링크가 표시되는지 확인합니다.
- 출처 링크가 없는 후보는 실제 진행 화면에서 사용하지 않습니다.
- AI 요청은 이미지 분석과 웹 검색을 함께 사용하므로 사용량과 비용을 확인합니다.
- 분석 실패 시 참가자는 다시 사진을 선택할 수 있고, 기존에 완료한 Pair는 Firestore에 남습니다.

## 로컬 테스트

`.env.local` 또는 Netlify Dev 환경에서 `OPENAI_API_KEY`를 설정한 뒤 다음을 실행합니다.

```bash
npm run dev
npx netlify dev
```

AI Function만 확인하려면 Firebase 익명 로그인 토큰이 필요하므로 브라우저의 실제 참가 흐름에서 테스트합니다.
