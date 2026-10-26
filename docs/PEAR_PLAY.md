# PEAR PLAY 운영 메모

## 기능 흐름

1. 관리자 세션 편집에서 `PEAR PLAY` 모듈을 선택하고 저장합니다.
2. 리모컨에서 `PEAR PLAY` 화면을 엽니다.
3. 참가자는 QR로 들어와 사진 한 장을 업로드합니다.
4. 사진은 R2의 `sessions/{sessionId}/pear/...` 경로에 저장되고 호스트 대기 목록에 나타납니다.
5. 호스트가 사진을 선택하면 호스트 화면에 사진이 크게 열립니다.
6. 관리자 리모컨에서 `토끼 탐정의 추리 시작`을 눌러야 Netlify Function `pear-play`가 사진을 분석하고 웹 검색으로 실제 작품 후보를 확인합니다.
   - 추리를 시작하면 리모컨이 가벼운 1차 관찰(`observe`)을 함께 요청합니다. 사진 속 단서 3개와 정리 한 줄을 받아, 본 검색이 도는 동안 호스트 화면에서 토끼 탐정이 자막으로 말하고 돋보기와 단서 쪽지로 보여줍니다.
   - 본 검색 중에는 AI가 실제로 검색한 검색어가 `실제 검색어` 자막으로 나옵니다. 1차 관찰이 15초 안에 오지 않거나 실패하면 준비된 대본 문구로 채웁니다.
   - 관찰 자막이 보이도록 결과는 추리 시작 후 최소 12초가 지나야 공개 단계로 넘어갑니다.
7. 분석 결과는 Firestore `sessions/{sessionId}/participants/{participantId}.pearPairing`에 저장됩니다.
8. 호스트는 `작품 공개하기`를 눌러야 작품 이미지와 작가, 제목, 연도, 크기, 재료 캡션을 공개할 수 있습니다.
9. `CASE BOARD`에서 공개된 모든 Pair를 한 화면에 모읍니다.

### 사진 접수 연출

- 새 사진이 들어오면 조수가 보드까지 걸어가 가방에서 사진을 꺼내 핀으로 꽂고 제자리로 돌아옵니다. 사진이 한꺼번에 몰리면 짧은 동작으로 이어 붙입니다.
- 보드의 첫 사진, 그리고 여섯 번째마다 한 번(대기 중인 사진이 없을 때)은 손 클로즈업 컷이 끼어듭니다.
- 동작 줄이기 설정을 켠 기기에서는 애니메이션 없이 바로 붙습니다.

## Netlify 환경변수

Netlify의 `Offline Salon` 사이트에서 **Site configuration → Environment variables**에 아래 값을 등록합니다.

```text
OPENAI_API_KEY=sk-...
PEAR_PLAY_MODEL=gpt-5.6
# 선택: 1차 관찰에만 다른(더 빠른) 모델을 쓰려면 지정합니다. 비우면 PEAR_PLAY_MODEL을 씁니다.
PEAR_PLAY_OBSERVE_MODEL=
PEAR_PLAY_ALLOWED_ORIGINS=https://salon.unframe.kr
```

`pear-play` 함수는 `ADMIN_EMAILS`에 등록된 관리자 로그인 토큰만 받습니다. 사진 주소는 `R2_PUBLIC_BASE_URL` 아래 `sessions/` 경로여야 하며, 이 값이 없으면 함수가 503을 반환합니다. 익명 참가자는 AI 분석을 직접 호출할 수 없습니다. 사진 한 장을 추리할 때마다 AI 호출이 두 번(저해상도 1차 관찰 1회 + 웹 검색 분석 1회) 들어갑니다.

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
