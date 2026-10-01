# 4.17.6 정상 배포 콘솔 게이트

원본 `npm publish --access public`의 콘솔 출력. 평가기와 모수는 변경하지 않았다. 문서 저장 시 줄 끝 공백만 걷었다.

```text
페이지 경계: 10/10 쌍 통과
✅ 페이지 게이트 통과 (10/10 쌍 전수 일치)
게이트: 59/59 통과
✅ reflow 게이트 통과 (100% ≥ 100%)
# redact 벤치 — 합성 케이스 313개 (정답 스팬 284, 음성 케이스 102)
모듈: /Users/mong-e/workspace/kordoc/dist/index.js

### 프로필 default — 룰: rrn,phone,email,card,account,brn,passport,driver
룰        TP   FP   FN   P      R      F1     exact
rrn        45    0    0  1.000  1.000  1.000  1.000
phone      74    0    0  1.000  1.000  1.000  1.000
email      20    0    0  1.000  1.000  1.000  1.000
card        8    0    0  1.000  1.000  1.000  1.000
account    21    0    0  1.000  1.000  1.000  1.000
passport    5    0    0  1.000  1.000  1.000  1.000
driver      5    0    0  1.000  1.000  1.000  1.000
brn         8    0    0  1.000  1.000  1.000  1.000
micro     186    0    0  1.000  1.000  1.000  1.000
masking   186    0    0  1.000  1.000  1.000   (유형 무관)
음성 절(neg/*) 오탐: 0

### 프로필 all — 룰: rrn,phone,email,card,account,passport,driver,brn,crn,ip,name,address
룰        TP   FP   FN   P      R      F1     exact
rrn        45    0    0  1.000  1.000  1.000  1.000
phone      74    0    0  1.000  1.000  1.000  1.000
email      20    0    0  1.000  1.000  1.000  1.000
card        8    0    0  1.000  1.000  1.000  1.000
account    21    0    0  1.000  1.000  1.000  1.000
passport    5    0    0  1.000  1.000  1.000  1.000
driver      5    0    0  1.000  1.000  1.000  1.000
brn         8    0    0  1.000  1.000  1.000  1.000
crn         5    0    0  1.000  1.000  1.000  1.000
ip          3    0    0  1.000  1.000  1.000  1.000
name       75    0    3  1.000  0.962  0.980  1.000
address    12    0    0  1.000  1.000  1.000  1.000
micro     281    0    3  1.000  0.989  0.995  1.000
masking   281    0    3  1.000  0.989  0.995   (유형 무관)
음성 절(neg/*) 오탐: 0

### 절별 (all 프로필) — 정답 찾음/전체, 오탐
  rrn/hyphen           11/11
  rrn/spacing          2/2
  rrn/dash             4/4
  rrn/fullwidth        2/2
  rrn/bare             8/8
  rrn/premasked        4/4
  rrn/foreigner        5/5
  rrn/post2020         3/3
  crn/labeled          5/5
  crn/unlabeled        1/1
  phone/mobile         10/10
  phone/landline       13/13
  phone/internet       3/3
  phone/rep            4/4
  phone/intl           4/4
  phone/paren          6/6
  phone/fullwidth      1/1
  phone/range          1/1
  email/basic          6/6
  email/context        6/6
  card/basic           4/4
  card/amex            2/2
  card/bare            2/2
  account/hyphen       14/14
  account/bare         7/7
  brn/basic            10/10
  passport/basic       6/6
  driver/basic         5/5
  ip/basic             3/3
  md/markers           4/4
  phone/spaced         2/2
  email/short          1/1
  phone/fax-real       1/1
  multi/mixed          9/9
  rrn/combined-label   7/7
  list/comma           18/18
  phone/spaced-sep     10/10
  account/last-digit   4/4
  neg/postal           1/1
  neg/misc             1/1
  name/label           6/6
  name/role            10/10
  name/title           14/14
  name/title-extra     4/4
  name/honorific       4/4
  name/phone           6/6
  name/age             2/2
  name/header          3/3
  name/signoff         7/7
  name/bare            0/3
  neg/name             2/2
  address/road         7/7
  address/lot          4/4
  address/apt          1/1
  address/label        1/1

### 오류 (all 프로필, 경계 차이 제외 — --verbose 로 전부) 3건
  [miss] name/bare name: "이수아"
  [miss] name/bare name: "김소율"
  [miss] name/bare name: "최민서"

### 난수 표면형 (시드 20260923, 양성 3000 + 나열 750 · 음성 3000) — 번호형 룰 전부
  rrn       재현 375/375 (1.000)
  phone     재현 375/375 (1.000)
  email     재현 375/375 (1.000)
  card      재현 375/375 (1.000)
  account   재현 375/375 (1.000)
  brn       재현 375/375 (1.000)
  passport  재현 375/375 (1.000)
  driver    재현 375/375 (1.000)
  list      재현 750/750 (1.000)
  음성 오탐 0 · 양성 문장 주변 오탐 0

### 외부 정답 (스키프트 benchmark_v3, 473문장) — all 룰, 기관명 149개는 모수 밖
유형      TP   FP   FN   P      R      F1     exact
name      361    0   50  1.000  0.878  0.935  0.997
address   141    0    0  1.000  1.000  1.000  1.000
phone      65    0    0  1.000  1.000  1.000  1.000
email       3    0    0  1.000  1.000  1.000  1.000
rrn         1    0    0  1.000  1.000  1.000  1.000
micro     571    0   50  1.000  0.919  0.958  0.998
기관명 스팬과 겹친 탐지(오탐으로 셈): 0 · 부정 예 오탐: 0
범주별 — 찾음/정답, 오탐
  address_only             20/20
  complex                  71/74
  medical_insurance        38/38
  N01_엔티티없음                  -
  N02_행정구역만                  -
  N03_기관직위                   -
  N04_문서번호_금액                -
  negative                   -
  org_org_bank             5/6
  org_org_bare             1/2
  org_org_company          9/11
  org_org_foundation       5/5
  org_org_government       10/11
  person_admin             43/47
  person_court             113/114
  person_double_surname    7/7
  person_foreign           8/8
  person_news              57/61
  person_short             10/10
  T01_담당자안내                48/50
  T02_부서팀연락처               16/16
  T03_임원명단                 4/4
  T04_법인나열                   -
  T05_공문서식                 9/9
  T07_시설주소                 13/13
  T08_청구인정보                11/12
  T10_희소유형                 2/2
  T11_장문                   8/8
  T12_주소단독                 25/25
  transcript               38/68
  (놓침·오탐 50건 — --verbose 로 목록)

✅ 게이트 통과
```
