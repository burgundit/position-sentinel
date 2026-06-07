# Position Sentinel Dev

경제지표와 뉴스 메모를 바탕으로 보유 종목의 롱 포지션 유지 여부를 점검하는 웹 기반 도구입니다.

## 현재 구조

- `app/index.html`: 웹앱 화면
- `app/styles.css`: 디자인
- `app/app.js`: 화면 상태, 저장/불러오기, 분석 결과 렌더링
- `server.py`: Python 서버, 분석 API, 포트폴리오 저장 API, Yahoo Finance 조회
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

서버로 실행하면 `저장` 버튼으로 보유 종목과 지표 설정을 저장하고, `불러오기` 버튼으로 다시 가져올 수 있습니다.
저장 파일은 `data/portfolio.json`에 만들어지며 GitHub에는 올라가지 않습니다.

`주가/추세 데이터 반영`을 켜면 Yahoo Finance에서 현재가, 전일 대비, 20일 평균 기준 추세를 가져와 판단 점수에 반영합니다.
외부 데이터 조회에 실패해도 기존 뉴스/거시 분석은 계속 동작합니다.

`대내외 환경`의 `자동 입력`은 Yahoo Finance 시장 프록시를 사용합니다.
금리는 `^TNX`, 시장 추세는 `SPY`, 경기 모멘텀은 `XLY/XLP`, 인플레이션 압력은 `TIP/IEF`를 참고합니다.
이는 공식 경제지표 발표치가 아니라 빠른 판단 보조용 시장 기반 제안입니다.

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
- 보유 종목과 지표 설정 저장/불러오기
- Yahoo Finance 기반 현재가, 전일 대비, 20일 평균 추세 반영
- 외부 데이터 조회 실패 시 기존 분석으로 계속 진행

## 다음 개발 단계

1. Yahoo Finance 조회를 병렬화해서 종목이 많아도 분석이 빠르게 끝나게 만들기
2. 조회 중/실패 상태를 화면에 더 명확하게 표시하기
3. 뉴스 데이터 API 연결
4. 경제지표 API 연결
5. 판단 점수 가중치 설정 화면 추가
