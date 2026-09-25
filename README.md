# AI 크루 (AI CREW)

<img src="assets/icon.png" width="96" align="right" alt="AI 크루 아이콘">

Claude와 Codex의 **5시간·주간 사용 한도**를 화면 위에 항상 띄워 두는 Windows 데스크톱 위젯이에요.
테마마다 전용으로 그린 배경과 서로 다른 캐릭터 듀오가 남은 한도를 보여줘요.

made by [🏠 문수네집](https://moonsunezipbrand.vercel.app) · [📸 Instagram](https://www.instagram.com/moonsune.zip/) · [✨ moonsune.zip](https://moonsunezip.com)

## 기능

- **모드 3가지**
  - 미니: 퍼센트와 리셋 시간만 보이는 초소형
  - 캐릭터: 캐릭터 두 명, 남은 한도, 5시간·주간 리셋 시각
  - 전체: 오늘의 상태, 다음 회복, 구독 관리, BGM
- **디자인 10가지**: 사이버 · 엔진 코어 · 마스코트 · 아케이드(도트) · 글래스 · CRT · 인더스트리얼 · 가든 · 애니 · 에디토리얼. 테마마다 전용 히어로 아트와 서로 다른 캐릭터 듀오가 적용돼요.
- **사용량 알림**: 70 / 85 / 95%에 도달하면 윈도우 알림
- **구독 관리**: 여러 AI 구독의 결제일(D-day)과 월 합계, 실제 사용률 대비 비용 분석
- **코딩 BGM**: 분위기별 유튜브 긴 영상 검색
- **단축키**: 모드 전환(미니 → 캐릭터 → 전체 → 끄기)과 위젯 보이기/숨기기. 원하는 키로 바꿀 수 있어요.
- **크기 조절**: 아래쪽 양 모서리를 끌어서 조절하고, 두 번 누르면 원래 크기로 돌아가요.
- **5개 언어**: 한국어 · English · 日本語 · 简体中文 · Español

## 실행

```bash
npm install
npx electron .
```

Windows에서는 `실행.vbs`를 더블클릭해도 돼요.
Electron은 경로에 한글이 있거나 OneDrive 안에 있으면 화면이 뜨지 않아요. 그래서 `실행.vbs`는 앱을 `%LOCALAPPDATA%\ai-usage-widget`로 복사한 뒤 거기서 실행해요.

npm 11 이상에서 Electron 바이너리가 설치되지 않으면 아래 명령을 한 번 실행하세요.

```bash
npm install-scripts approve electron
```

## 사용량 데이터 출처

| 서비스 | 가져오는 곳 |
| --- | --- |
| Codex | `~/.codex/sessions/**.jsonl`의 `rate_limits` (로컬 로그, 네트워크 없음) |
| Claude | ① Claude Code 로그인 토큰 → ② 위젯 안에서 claude.ai 로그인 → ③ 직접 입력 |

Claude 사용량 API는 공식 공개 API가 아니라서 바뀔 수 있어요. 그때는 직접 입력으로 쓰면 돼요.

## 참고

- 한국 금융·키보드 보안 프로그램(AhnLab Safe Transaction, nProtect 등)이 깔린 PC에서는 Chromium 렌더러 샌드박스가 시작하자마자 멈춰요.
  - 위젯이 이걸 처음 감지하면 `%APPDATA%\ai-usage-widget\no-sandbox.flag`를 남기고 샌드박스 없이 다시 실행해요.
  - 화면 코드는 `contextIsolation`으로 Node 접근이 막혀 있어요.
- 문제가 생기면 `%APPDATA%\ai-usage-widget\widget.log`를 확인하세요.
- 아이콘 다시 만들기: `npx electron tools/make-icons.js` → `python tools/make-ico.py`
