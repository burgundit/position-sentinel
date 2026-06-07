# Position Sentinel Dev

경제지표와 뉴스 메모를 바탕으로 보유 종목의 롱 포지션 유지 여부를 점검하는 웹 기반 도구입니다.

## 현재 구조

- `app/index.html`: 웹앱 화면
- `app/styles.css`: 디자인
- `app/app.js`: 분석 로직
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

서버 없이 파일로만 열 수도 있습니다.

```powershell
start app\index.html
```

Python 테스트는 아래처럼 실행합니다.

```powershell
.venv\Scripts\Activate.ps1
python main.py
```

## 다음 개발 단계

1. Git 사용자 이름과 이메일 설정
2. 첫 커밋 만들기
3. GitHub 저장소 생성
4. 이 프로젝트를 GitHub에 연결
5. 뉴스/경제지표 API 연결
6. 보유 종목 저장 기능 추가
