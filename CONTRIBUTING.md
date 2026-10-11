# 기여 안내

1. 저장소를 fork 하거나(외부), collaborator 라면 바로 브랜치를 만듭니다: `git checkout -b feat/무엇`
2. `npm run dev` 로 확인하고 `npm run build` 가 통과하는지 봅니다.
3. PR 을 보냅니다. 제목은 "무엇을 왜" 한 줄, 본문에 스크린샷 한 장이면 충분합니다.

규칙은 세 가지뿐입니다.
- 화면은 `src/lib/repo` 의 `Repo` 인터페이스만 호출합니다. 데이터 형태를 바꾸려면 `src/types` 를 먼저 고칩니다.
- 새 화면은 `src/app/<경로>/page.tsx` 하나로 시작하고, 재사용 UI 만 `src/components` 로 뺍니다.
- 색·간격은 `globals.css` 의 토큰(`--primary`, `.card`, `.chip`, `.btn`)을 씁니다. 새 색을 만들지 않습니다.

## 문서와 이미지

- 소개와 핵심 흐름은 루트 README에, 실행·설정은 `docs/guides/`에 작성합니다.
- 설계는 `docs/design/`, 과거 검증 기록은 `docs/archive/`에 보관합니다.
- README 이미지는 `docs/assets/`에 두고 문서를 이동할 때 상대 링크도 함께 갱신합니다.
- 문서 탐색은 [문서 목록](docs/README.md), 로컬 실행은 [개발 가이드](docs/guides/DEVELOPMENT.md)를 참고하세요.
