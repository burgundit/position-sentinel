# Position Sentinel Dev

경제지표와 뉴스 메모를 바탕으로 보유 종목의 롱 포지션 유지 여부를 점검하는 웹 기반 도구입니다.

## 현재 구조

- `app/index.html`: 웹앱 화면
- `app/styles.css`: 디자인
- `app/app.js`: 분석 로직
- `main.py`: Python 개발환경 테스트 파일
- `.venv/`: Python 가상환경

## 지금 실행하기

웹앱은 별도 서버 없이 바로 열 수 있습니다.

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
5. Python 백엔드 추가
6. 뉴스/경제지표 API 연결
