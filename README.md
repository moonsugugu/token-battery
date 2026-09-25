# 토큰배터리 (TokenBattery)

<img src="assets/icon.png" width="96" align="right" alt="토큰배터리 아이콘">

Claude와 Codex 토큰 사용 한도를 **배터리처럼 한눈에** 보여주는 Windows 데스크톱 위젯이에요. 5시간 창의 리셋은 시각 또는 남은 시간으로 고를 수 있고, 주간 한도는 항상 `2일`처럼 남은 기간으로 표시해요.
테마마다 전용으로 그린 배경과 서로 다른 캐릭터 듀오가 잔량에 따라 표정과 움직임을 바꿔요.

made by [🏠 문수네집](https://moonsunezip.com) · [📸 Instagram](https://www.instagram.com/moonsune.zip/) · [✨ moonsune.zip](https://moonsunezip.com)

## 기능

- **모드 3가지**
  - 미니: 퍼센트와 리셋 시간만 보이는 초소형
  - 캐릭터: 캐릭터 두 명, 남은 한도, 5시간 리셋 표시와 주간 남은 날짜
  - 전체: 오늘의 상태, 다음 회복, 구독 관리, BGM
- **디자인 10가지**: 사이버 · 엔진 코어 · 마스코트 · 아케이드(도트) · 글래스 · CRT · 인더스트리얼 · 가든 · 애니 · 에디토리얼. 테마마다 전용 히어로 아트와 서로 다른 캐릭터 듀오가 적용돼요.
- **캐릭터 반응 애니메이션**: 사용량에 따라 캐릭터 표정이 5단계로 바뀌고, 각 테마·캐릭터별 10프레임 시트로 배경은 고정한 채 눈 깜빡임과 작은 움직임을 보여줘요.
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

Windows에서는 `실행.vbs`를 더블클릭하거나 바탕화면의 **TokenBattery** 바로가기를 실행하면 돼요.
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

## 릴스 타이틀 · 훅 문구

| 언어 | 타이틀 | 훅 |
| --- | --- | --- |
| 한국어 | Claude·Codex 토큰, 이제 배터리처럼 보여요 | 오늘 얼마나 쓸 수 있는지, 다음 충전은 언제인지 한눈에. |
| English | Claude & Codex tokens, now shown like a battery | See what’s left—and when your next reset is. |
| 日本語 | Claude・Codex の使用量をバッテリーみたいに | 残りの利用枠と、次のリセットがひと目でわかる。 |
| 简体中文 | Claude 和 Codex 的额度，现在像电池一样显示 | 剩余多少、何时重置，一眼就知道。 |
| Español | Claude y Codex, ahora como una batería | Mira cuánto te queda y cuándo se reinicia. |

프로젝트: [github.com/moonsugugu/token-battery](https://github.com/moonsugugu/token-battery)

## 릴스 만들기

1. `python tools/reel/capture.py <영문 경로 앱 폴더> output/frames`로 시연용 값으로 장면을 캡처해요. 실제 설정은 건드리지 않아요.
2. 문수네집 릴스 스킬 엔진으로 `tools/reel/token-battery.reel.json`을 렌더링해요.
   - 위치: `~/.claude/skills/문수네집-릴스-만들기/scripts/reel_engine.py`
3. 결과물은 `output/token-battery-reel.mp4`와 커버 jpg예요. `output/`은 저장소에 올라가지 않아요.

## 참고

- 한국 금융·키보드 보안 프로그램(AhnLab Safe Transaction, nProtect 등)이 깔린 PC에서는 Chromium 렌더러 샌드박스가 시작하자마자 멈춰요.
  - 위젯이 이걸 처음 감지하면 `%APPDATA%\ai-usage-widget\no-sandbox.flag`를 남기고 샌드박스 없이 다시 실행해요.
  - 화면 코드는 `contextIsolation`으로 Node 접근이 막혀 있어요.
- 문제가 생기면 `%APPDATA%\ai-usage-widget\widget.log`를 확인하세요.
- 아이콘 다시 만들기: `npx electron tools/make-icons.js` → `python tools/make-ico.py`
