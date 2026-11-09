# 김의 여정 · Gim Journey

종자 → 양식 → 경매 → 1차 가공 → 2차 가공 → 유통, 김 밸류체인 여섯 단계를 디지털 트윈으로 직접 돌려 보는 시연용 웹사이트입니다.
서버 없이 GitHub Pages 에서 그대로 돌아갑니다.

| 화면 | 주소 | 내용 |
|---|---|---|
| 시작 | `#home` | 김 양식장 항공 영상 배경, 체험 시작 / 데이터 보기 버튼, 휴대폰용 QR |
| 여정 | `#journey` | 재배량 슬라이더 하나로 여섯 단계 산출·매출이 사슬처럼 함께 움직임, 단계별 매출 그래프 |
| 공장 대시보드 | `#stage-1` ~ `#stage-6` | 3D 디지털 트윈, 공정 흐름도(숫자가 그림 위에 실시간 표시), 기계별 파라미터, 매출·ROI·수율·품질 KPI, AI 최적화, 돌발 시나리오 |
| 데이터 | `#data`, `#data-video` | 실험 CSV 표(스크롤·정렬·검색·열 통계), Depth 카메라 영상 세로 피드(아래로 넘기기) |

디자인은 두 가지입니다. **A**는 어두운 시네마틱 화면, **B**는 밝은 비즈니스 애널리틱스 화면이고 오른쪽 위 **A·B** 버튼으로 바꿉니다(아래 3장).

> 대시보드 숫자는 시연용 **시뮬레이션**입니다(화면 오른쪽 위 SIMULATION 표시). 시작 화면의 수출 통계(2025년 11.3억 달러, +13.7%)만 실제 발표 수치입니다.

---

## 1. 저장소와 GitHub Pages

- 저장소: https://github.com/sjb8032/gim-journey
- 사이트: https://sjb8032.github.io/gim-journey/
  (켜는 곳: 저장소 **Settings → Pages** 에서 Source **Deploy from a branch**, Branch **main / (root)**)

내 컴퓨터로 받기 (Windows PowerShell, 한 줄씩 실행):

```powershell
cd "$([Environment]::GetFolderPath('Desktop'))\sjb8032_git"
git clone https://github.com/sjb8032/gim-journey.git
cd gim-journey
```

고친 뒤 다시 올리기 (1~2분 뒤 사이트에 반영):

```powershell
git add .
git commit -m "수정 내용"
git push
```

`.nojekyll` 파일은 지우지 마세요 (GitHub 의 Jekyll 변환을 끄는 파일입니다).

### (권장) AI 에셋을 저장소에 넣기

이미지 7장, 배경 영상 1개, 3D 모델 6개는 Higgsfield 로 만들었고 지금은 Higgsfield CDN 주소를 바로 불러옵니다.
시연장 와이파이가 약하거나, CDN 이 3D 모델 요청을 막는 경우를 대비해 **올리기 전에 한 번** 아래를 실행해 두세요.

```powershell
pip install pillow
python tools/fetch_assets.py
git add .
git commit -m "AI 에셋 내려받기"
git push
```

`pillow` 는 이미지를 WebP 로 줄이는 데만 씁니다(없어도 동작). `python` 을 못 찾는다고 나오면 `py tools/fetch_assets.py` 로 실행하세요.

- `assets/img`, `assets/media`, `assets/models` 에 파일이 생기고 `assets/assets.json` 의 `preferLocal` 이 `true` 로 바뀝니다.
- ffmpeg 가 있으면 배경 영상을 웹용으로 다시 압축합니다.
- 3D 모델이 무거우면 `python tools/fetch_assets.py --glb-compress` (Node.js 필요)로 텍스처를 1024px 로 줄입니다.
- 이 단계를 건너뛰어도 사이트는 돌아갑니다. 3D 모델을 못 불러오면 직접 만든 기계 모델로 자동 대체됩니다.

### 내 컴퓨터에서 미리 보기

`index.html` 을 더블클릭하면 브라우저 보안 정책 때문에 동작하지 않습니다. 간단한 로컬 서버로 여세요.

```bash
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```

---

## 2. 내 실험 데이터 넣기

지금 들어 있는 CSV 와 Depth 영상은 **화면 구성을 보여 주기 위한 합성 샘플**입니다(화면에 SAMPLE 표시). 실제 데이터로 바꾸세요.

### 스크립트로 (권장)

```bash
# CSV: data/csv 로 복사하고 목록 맨 앞에 등록
python tools/add_data.py csv 김실험.csv --title "김 실험 데이터"

# 5분 Depth 영상: 720p 로 압축하고, 화면에서 30초씩 끊어 아래로 넘기며 보기
python tools/add_data.py video depth_5min.mp4 --title "컨베이어 Depth" --split 30 --depth-min 300 --depth-max 1500

# 영상이 너무 커서(100MB 초과) 올라가지 않으면: 30초짜리 파일 여러 개로 실제 분할
python tools/add_data.py video depth_5min.mp4 --title "컨베이어 Depth" --clips 30

# 샘플 항목 빼기
python tools/add_data.py clear-samples
```

영상 작업에는 ffmpeg 가 필요합니다. RealSense 녹화 파일이 `.bag` 이라면 먼저 `python tools/bag_to_mp4.py 녹화.bag --out depth.mp4` 로 mp4 를 만드세요 (실제 .bag 으로는 아직 검증하지 못한 스크립트입니다).

### 직접 고치기

`data/manifest.json` 이 목록입니다.

```json
{
  "csv": [{ "title": "김 실험 데이터", "file": "data/csv/내파일.csv" }],
  "videos": [
    { "title": "컨베이어 Depth", "file": "data/videos/depth.mp4", "kind": "depth",
      "split": 30, "depthMin": 300, "depthMax": 1500 }
  ]
}
```

| 키 | 뜻 |
|---|---|
| `sample: true` | SAMPLE 표시. 실제 데이터에는 빼세요 |
| `split` | 한 파일을 N초씩 끊어 세로 피드에 나눠 보여 줌 |
| `kind` | `depth` 또는 `rgb` |
| `depthMin`, `depthMax` | 오른쪽 색 막대에 표시할 거리(mm). 없으면 막대를 숨김 |
| `nearIsWarm: false` | 가까운 곳이 파란색인 컬러맵(예: RealSense Jet)이면 색 막대를 뒤집음 |

- CSV 는 UTF-8, Excel 에서 저장한 CP949(EUC-KR) 모두 자동 인식합니다. 쉼표·탭·세미콜론 구분자도 자동입니다.
- 시연 중에는 CSV·영상 파일을 페이지에 **끌어다 놓기**만 해도 바로 열립니다 (그 기기에서만 보이고 저장소에는 올라가지 않습니다).

---

## 3. 시연 운영 팁

- **F** 키 또는 오른쪽 위 버튼: 전체 화면
- 여정 화면의 **자동 시연**: 여섯 공장을 차례로 돌며 AI 최적화를 실행합니다. 화면을 누르면 멈춥니다.
- 주소 끝에 `?kiosk` 를 붙이면(`.../gim-journey/?kiosk`) 75초 동안 아무도 만지지 않을 때 자동으로 초기화하고 자동 시연을 시작합니다. 부스에 화면을 세워 둘 때 쓰세요.
- 공장 화면에서 **← →** 키로 이전/다음 단계, 데이터 영상 화면에서 **↑ ↓** 로 영상 넘기기, **스페이스**로 일시정지
- 3D 화면 오른쪽 아래 레이어 버튼으로 그래픽 효과(빛 번짐·그림자)를 끌 수 있습니다. 노트북이 느리면 자동으로 꺼집니다.
- 체험 흐름 추천: 재배량을 1,000톤 이상으로 올림 → 빨간 병목 확인 → AI 최적화 → 시나리오(보일러 고장 등) → 다시 AI 최적화

### 디자인 A·B 바꾸기

| | A (기본) | B |
|---|---|---|
| 느낌 | 어두운 밤바다·공장, 빛 번짐 효과 | 밝은 작업 화면, 네이비·블루, 흰 카드 |
| 글꼴 | Hahmlet · IBM Plex Sans KR | Inter · Pretendard · JetBrains Mono |
| 3D | 어두운 공장 | 밝은 낮 조명, 흰 설비 |

- 오른쪽 위 **A·B** 버튼이나 키보드 **T** 로 바꿉니다. 고른 디자인은 그 기기에 기억됩니다.
- 주소로 바로 열기: `.../gim-journey/?theme=b` (B), `?theme=a` (A). 키오스크와 함께 쓰려면 `?kiosk&theme=b`
- 처음 여는 사람에게 B를 기본으로 보여 주려면 `index.html` 맨 위 `<html lang="ko" data-theme="classic">` 의 `classic` 을 `analytics` 로 바꾸세요.
- B 디자인은 designmd.app 의 *SaaS Enterprise Analytics* 를 참고했습니다. B 전용 스타일은 `assets/css/theme-analytics.css`, 색 전환은 `assets/js/theme.js` 에 있습니다.

---

## 4. 숫자·공정 바꾸기

모든 단계 설정은 `assets/js/config.js` 한 파일에 있습니다.

- `machines`: 공정 순서와 기계 이름, 3D 모양(`type`), 설계 용량(`cap`), 기본 손실률(`loss`)
- `params`: 기계별 파라미터 `P(id, 이름, 단위, 최소, 최대, 간격, 기본값, 최적값, 허용폭, 효과)`
  - 효과 `y` 손실 증가, `q` 품질 저하, `c` 처리 용량, `e` 에너지, `pm` 판매가, `lm` 손실(직선), `k` 인건비·자재비
- `econ`: 판매 단가, 에너지·자재 단가, 고정비, 설비 투자액(`capex`), 내용연수
- `scenarios`: 돌발 시나리오와 그 영향
- `DEFAULT_HARVEST`, `DESIGN_HARVEST`: 기본 재배량(600톤)과 설비가 버티는 기준(720톤)
- `INTRO_VIDEO`: 시작 화면 오른쪽에 띄우는 유튜브 영상. `youtube` 에 영상 ID(주소의 `v=` 뒤 값)를 넣으면 바뀌고, `null` 로 두면 숨깁니다. 화면이 좁으면(1100px 미만) 오른쪽 영상 대신 **다큐 보기** 버튼이 나옵니다.

계산식은 `assets/js/sim.js` 에 있습니다. 물량이 기계를 차례로 지나며 용량을 넘으면 넘친 만큼 버려지고(병목), 파라미터가 최적값에서 멀어질수록 손실·품질·에너지가 나빠집니다. AI 최적화는 각 파라미터를 격자로 훑어 그 단계의 영업이익이 가장 큰 값을 찾습니다.

---

## 5. 폴더 구조

```
index.html               화면 뼈대 (시작 · 여정 · 대시보드 · 데이터)
assets/
  css/style.css          디자인 (A, 공통)
  css/theme-analytics.css  디자인 B
  js/theme.js            디자인 A·B 전환
  js/main.js             화면 전환, 시작·여정 화면, 자동 시연
  js/config.js           단계·기계·파라미터·경제 설정  ← 숫자는 여기서
  js/sim.js              시뮬레이션 계산, AI 최적화
  js/dashboard.js        공장 대시보드
  js/twin.js, machines.js  3D 디지털 트윈 (three.js)
  js/flow.js             공정 흐름도
  js/charts.js           그래프
  js/worldmap.js         수출 지도
  js/data.js             CSV 표, 영상 피드
  assets.json            AI 이미지·영상·3D 모델 주소
  vendor/                three.js r170, qrcode-generator (MIT)
data/
  manifest.json          데이터 목록
  csv/, videos/          데이터 파일
tools/
  fetch_assets.py        AI 에셋 내려받기
  add_data.py            CSV·영상 등록
  bag_to_mp4.py          RealSense .bag → mp4
```

## 크레딧

- 3D: [three.js](https://threejs.org) (MIT)
- QR: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT)
- 이미지·배경 영상: Higgsfield (GPT Image, Kling) / 3D 기계 모델: Tripo (Higgsfield 경유)
- 지도 윤곽: Natural Earth (world-atlas)
- 김 수출 통계: 해양수산부 발표 (2026년 1월)
