
# 🌎 Earth 3D Modeling

WebGL과 GLSL을 활용한 **지구 3D 모델링 시뮬레이션** 프로젝트입니다.

위도·경도 기반으로 지구를 생성하고, NASA 위성 텍스처와 지형 정보를 적용하여 지구의 자전, 조명 변화, 사용자 상호작용을 구현했습니다.

## 주요 기능

- **지구 모델링**: 위도·경도 좌표를 이용한 구면 메시 생성
- **텍스처 매핑**: NASA 위성 이미지를 활용한 지구 표면 표현
- **지형 표현**: 지형 영상의 밝기값을 이용한 정점 변위
- **지구 자전**: 자동 자전 및 23.4° 자전축 기울기
- **마우스 회전**: Arcball + Quaternion 기반 3D 회전
- **태양광 조명**: GLSL 기반 Ambient, Diffuse, Specular 조명
- **태양 방향 조절**: 슬라이더를 통한 조명 방향 변경
- **공전 미니맵**: 태양 방향과 연동되는 지구 공전 위치 시각화

## 개발 환경

- HTML / CSS
- JavaScript
- WebGL
- GLSL
- HTML Canvas 2D

## 프로젝트 구조

```text
Earth-3D-Modeling/
├── index.html
├── main.js
├── download_assets.py
└── assets/
    ├── earth_day.png
    └── earth_relief.jpg
```

## 실행 방법

프로젝트 폴더에서 로컬 서버를 실행합니다.

```bash
python -m http.server 8000
```

브라우저에서 다음 주소로 접속합니다.

`http://localhost:8000`

## 조작 방법

| 조작 | 기능 |
|---|---|
| 마우스 드래그 | 지구 자유 회전 |
| 마우스 휠 | 확대 / 축소 |
| Space | 자동 자전 정지 / 재개 |
| R | 시점 초기화 |
| 태양 방향 슬라이더 | 태양광 방향 변경 및 미니맵 연동 |

## AI 도구 활용

개발 과정에서 ChatGPT를 보조적으로 활용했습니다.

- NASA 위성 텍스처 자료 및 다운로드 방법 탐색
- GLSL Fragment Shader의 조명 및 색상 처리 코드 오류 수정
- 초반 작성한 구현에서 부자연스러운 회전으로 인해 Arcball 및 Quaternion 기반 회전 구현으로 수정하고자 기본적인 예시 코드를 제시 받아 이를 수정 보완하며 활용
- HTML/CSS 배경색 추천 및 오류 해결
- README 작성 시 발생한 오류 해결 (문법 수정)

## 참고 자료

- [NASA Scientific Visualization Studio](https://svs.gsfc.nasa.gov/)
- [NASA Earth Observatory](https://earthobservatory.nasa.gov/)
- [MDN WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API)
