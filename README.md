# Position Sentinel Dev

경제지표와 뉴스 메모를 바탕으로 보유 종목의 롱 포지션 유지 여부를 점검하는 웹 기반 도구입니다.
기본 판단 기간은 최소 1년 보유입니다.

## 현재 구조

- `app/index.html`: 웹앱 화면
- `app/styles.css`: 디자인
- `app/app.js`: 화면 상태, 이벤트 연결, 분석 결과 렌더링
- `app/modules/analysis.js`: 브라우저 fallback용 점수 계산과 판단 기준
- `app/modules/api.js`: 서버 API 호출
- `app/modules/dom.js`: 화면 요소 참조
- `app/modules/holdings.js`: 보유종목 파싱과 입력 문자열 변환
- `app/modules/symbols.js`: 종목 별칭과 티커 정규화
- `app/modules/utils.js`: 공통 포맷/문자열 유틸
- `server.py`: 기존 실행 명령을 유지하는 Python 서버 진입점
- `backend/server.py`: Python 서버, 분석 API, 포트폴리오 저장 API, Yahoo Finance 조회
- `backend/symbols.py`: 서버용 종목 별칭, 티커 정규화, KRX/Yahoo 종목 검색
- `run_server.bat`: Windows 실행용 서버 시작 파일
- `main.py`: Python 개발환경 테스트 파일
- `.venv/`: Python 가상환경

## 지금 실행하기

웹앱은 Python 서버로 실행하는 방식을 권장합니다.

```powershell
python server.py
```

또는 Windows에서 아래 파일을 더블클릭해도 됩니다.

```text
run_server.bat
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:8000
```

## VS Code 작업환경

저장소에는 `.vscode/` 기본 설정이 포함되어 있습니다.

- `Run server`: VS Code 작업 실행 메뉴에서 Python 서버를 시작합니다.
- `Check Python syntax`: `server.py`, `main.py` 문법을 빠르게 확인합니다.
- `Check JS syntax`: 프론트엔드 JavaScript 모듈 문법을 확인합니다.
- `Check all`: Python, JavaScript, Git 상태를 한 번에 확인합니다.
- `Git status`: 현재 Git 변경 상태를 확인합니다.
- Python 인터프리터는 `.venv\Scripts\python.exe`를 기본값으로 잡습니다.

GitHub Actions도 설정되어 있어 `main` 브랜치에 push하거나 pull request를 만들면 Python/JavaScript 문법 검사가 자동 실행됩니다.

서버로 실행하면 `저장` 버튼으로 보유 종목과 지표 설정을 저장하고, `불러오기` 버튼으로 다시 가져올 수 있습니다.
저장 파일은 `data/portfolio.json`에 만들어지며 GitHub에는 올라가지 않습니다.

보유 종목은 티커 또는 종목명으로 입력할 수 있습니다.
입력 패널의 `종목 API 검색`에서 종목명이나 티커를 조회한 뒤 후보를 선택하면 보유 종목 편집 표에 자동 추가됩니다.
편집 표에서 비중과 테마를 바로 수정하거나 종목을 삭제할 수 있고, `동일비중` 버튼으로 전체 종목 비중을 맞출 수 있습니다.
한국 종목명은 공공데이터포털 KRX 상장종목정보 API 키가 있으면 KRX를 먼저 조회하고, 키가 없으면 앱의 별칭 사전과 Yahoo Finance 검색으로 대체합니다.
미국 종목명은 Yahoo Finance 검색으로 티커를 찾습니다.
예: `Apple` → `AAPL`, `Berkshire Hathaway` → `BRK-B`, `삼성전자` → `005930.KS`, `PLUS 고배당주` → `161510.KS`.
한글 미국주식명은 대표 종목 별칭을 우선 지원합니다. 예: `팔란티어` → `PLTR`, `브로드컴` → `AVGO`, `일라이릴리` → `LLY`, `타이완반도체` → `TSM`, `아이온큐` → `IONQ`.
국내 6자리 코드만 입력해도 기본적으로 `.KS`를 붙여 조회합니다. 예: `005930` → `005930.KS`.
코스닥 종목처럼 `.KQ`가 필요한 경우에는 `091990.KQ`처럼 Yahoo 티커를 직접 입력하세요.
비중을 모두 생략하면 보유 종목을 동일비중으로 계산합니다.

KRX 종목 검색을 쓰려면 공공데이터포털에서 `금융위원회_KRX상장종목정보` 활용 신청 후 받은 인증키를 환경변수로 설정합니다.

```powershell
$env:DATA_GO_KR_API_KEY="발급받은_인증키"
python server.py
```

`주가/추세 데이터 반영`을 켜면 Yahoo Finance에서 현재가, 전일 대비, 20일 평균 기준 추세를 가져와 판단 점수에 참고합니다.
최소 1년 롱 기준에서는 단기 추세 영향도를 낮게 반영합니다.
외부 데이터 조회에 실패해도 기존 뉴스/거시 분석은 계속 동작합니다.

점수 로직은 종목 성격도 함께 반영합니다.
예를 들어 고성장/고밸류 종목은 고금리와 시장 하락에 더 민감하게 감점하고, 방어/배당 종목은 기본 안정성을 일부 반영합니다.
단기 가격 변동보다 1년 이익 전망, 사업 경쟁력, 규제/소송 같은 장기 thesis 훼손 여부를 더 중요하게 봅니다.
결과표의 사유 항목에서 `스타일` 점수와 분류를 확인할 수 있습니다.

`대내외 환경`의 `자동 입력`은 Yahoo Finance 시장 프록시를 사용합니다.
금리는 `^TNX`, 시장 추세는 `SPY`, 경기 모멘텀은 `XLY/XLP`, 인플레이션 압력은 `TIP/IEF`를 참고합니다.
이는 공식 경제지표 발표치가 아니라 빠른 판단 보조용 시장 기반 제안입니다.

`뉴스 자동`은 보유 종목 티커를 기준으로 Yahoo Finance RSS 헤드라인을 가져와 `주요 뉴스/메모`에 채웁니다.
현재는 제목/요약 기반의 빠른 메모이며, 원문 전문 분석은 이후 뉴스 API 또는 별도 기사 수집 기능으로 확장할 수 있습니다.

서버 없이 파일로만 열 수도 있습니다.

```powershell
start app\index.html
```

Python 테스트는 아래처럼 실행합니다.

```powershell
.venv\Scripts\Activate.ps1
python main.py
```

## 완료된 기능

- Python 개발환경 구성
- Git/GitHub 저장소 연결
- 웹 기반 입력/분석 화면
- Python 백엔드 분석 API
- 종목명/티커 API 검색 및 보유 종목 자동 추가
- 공공데이터포털 KRX 상장종목정보 API 연동 옵션
- 보유 종목과 지표 설정 저장/불러오기
- Yahoo Finance 기반 현재가, 전일 대비, 20일 평균 추세 반영
- Yahoo Finance RSS 기반 종목 뉴스 메모 자동 입력
- 고성장/방어/배당/경기민감 등 종목 성격 기반 점수 보정
- 외부 데이터 조회 실패 시 기존 분석으로 계속 진행

## 다음 개발 단계

1. Yahoo Finance 조회를 병렬화해서 종목이 많아도 분석이 빠르게 끝나게 만들기
2. 조회 중/실패 상태를 화면에 더 명확하게 표시하기
3. 뉴스 데이터 API 연결 또는 RSS 메모 품질 개선
4. 경제지표 API 연결
5. 판단 점수 가중치 설정 화면 추가
