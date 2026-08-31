# 실데이터·로그인·MyHealthWay·의료 AI 창업자 실행표

**검토 기준일:** 2026-08-30

**현재 상태:** 신청 준비만 가능. 이 문서는 실데이터 처리, 외부 계정 변경, 키 발급, 연동 활성화 또는 의료기기 적합성을 승인하지 않는다.

## 먼저 지킬 경계

- Kakao와 Naver 로그인은 사용자의 로그인 신원을 확인하는 수단이다. 건강정보 제공 동의나 MyHealthWay 접근 권한을 대신하지 않는다.
- MyHealthWay(건강정보 고속도로)는 일반 공개 API 키가 아니다. 활용서비스 개발기관 회원가입, 지정심사, 테스트베드와 보안요건을 거쳐야 한다.
- 건강정보와 유전정보는 민감정보다. 실제 이용자의 PDF, 검사결과, DICOM, CSV, DNA 결과 또는 공공기관 개인기록은 법적 근거와 별도 동의, 안전조치, 운영 승인이 모두 갖춰지기 전에는 개발환경에 넣지 않는다.
- Client Secret, access/refresh token, 인증서 개인키, 주민등록번호, 환자번호와 원본 의료문서는 Git, 이슈, 채팅, 스크린샷, CI 로그에 넣지 않는다. 이 저장소에는 Secret Manager 좌표와 버전 식별자만 기록할 수 있다.
- 현재 제품은 합성 fixture만 받도록 막혀 있다. 아래 신청이 끝나도 별도의 창업자 활성화 승인과 release gate PASS 없이는 이 제한을 해제하지 않는다.

## Jason이 한 번에 준비할 비밀이 아닌 자료

| 항목 | 준비물 | 저장할 결과 |
|---|---|---|
| 법인/기관 | 사업자등록 정보, 법인명, 대표·담당자 연락처, 서비스 소개, 개인정보처리방침 초안, 이용약관 초안 | 승인 문서 번호·날짜·담당자만 governance 기록에 남김 |
| 도메인 | production/staging 도메인, HTTPS 인증서 계획, 정확한 로그인 callback 경로 | 승인된 origin과 callback 목록 |
| 보안 책임 | 개인정보보호 책임자, 보안 책임자, 사고 연락망, 처리위탁·클라우드 후보 | 이름/역할/승인일, 계약·심사 문서 위치 |
| 운영 인프라 | 한국 리전 후보, 고정 outbound IP, KMS/Secret Manager, 분리된 object/queue/database, 삭제·백업 계획 | 리소스 ID와 정책 증거; 키 값은 제외 |
| 제품 목적 | “사용자 자료에서 측정값 후보를 추출해 본인이 확인”이라는 현 단계 intended use | 승인된 문구와 금지 claim 목록 |

## 1. Kakao 로그인

공식 시작점: [Kakao Developers 카카오 로그인 REST API](https://developers.kakao.com/docs/ko/kakaologin/rest-api)

1. 회사가 통제하는 Kakao Developers 관리자 계정과 앱을 만든다. 개인 계정 한 명에게 소유권을 묶지 말고 관리자·복구 절차를 정한다.
2. 앱의 REST API 키를 확인하고 카카오 로그인을 활성화한다.
3. production과 staging의 HTTPS redirect URI를 **정확한 경로까지** 등록한다. 운영 앱에는 localhost와 임시 tunnel 주소를 넣지 않는다.
4. 최소 동의항목만 설정한다. 이메일이 꼭 필요하지 않다면 요청하지 않는다. 의료정보 동의를 카카오 프로필 동의항목으로 대체하지 않는다.
5. 현재 기본 활성화되는 Client Secret을 별도 Secret Manager 버전으로 저장한다. 토큰 교환은 서버에서만 한다.
6. 구현 승인이 나면 요청별 고유 `state`를 생성·검증하고, OIDC를 쓰는 경우 `nonce`, issuer, audience, signature, expiry를 검증한다. provider의 고유 회원번호를 내부 계정에 연결하며 이메일만으로 Kakao/Naver 계정을 자동 병합하지 않는다.
7. 탈퇴·연결해제·토큰 만료/폐기와 키 회전 시나리오를 staging에서 통과한 뒤에만 운영 승인을 요청한다.

보관 예정 좌표 이름은 `GC_KAKAO_REST_API_KEY_SECRET_REF`와 `GC_KAKAO_CLIENT_SECRET_REF`다. 실제 값은 저장소나 브라우저 환경변수에 두지 않는다.

## 2. Naver 로그인

공식 시작점: [Naver 애플리케이션 등록](https://developers.naver.com/docs/common/openapiguide/appregister.md), [Naver 로그인 API 명세](https://developers.naver.com/docs/login/api/api.md)

1. 회사/단체가 통제하는 Naver 계정으로 개발자 센터의 `Application > 애플리케이션 등록`을 진행한다. 공식 문서도 단체 이용 시 단체 회원 사용을 권장한다.
2. 사용 API에서 Naver 로그인을 선택하고 PC/Mobile Web 서비스 URL 및 HTTPS callback URL을 등록한다.
3. 발급된 Client ID와 Client Secret을 서로 다른 Secret Manager 버전으로 저장한다. Client Secret은 비밀번호와 같은 값이며 노출 시 포털에서 재발급한다.
4. 서버가 authorization code를 token으로 교환한다. 요청마다 암호학적으로 충분한 일회성 `state`를 만들고 서버 세션과 callback에서 동일성을 검증한다.
5. 최소 프로필만 요청하고, provider 고유 ID를 연결 키로 사용한다. 로그아웃, 연결 해제, token revoke와 계정 삭제 후 재가입을 검증한다.
6. 포털에 표시되는 앱 이름·도메인·callback과 실제 운영값이 일치하는지 검수한 뒤 운영 승인을 요청한다.

보관 예정 좌표 이름은 `GC_NAVER_CLIENT_ID_SECRET_REF`와 `GC_NAVER_CLIENT_SECRET_REF`다. 실제 값은 서버 전용 secret에만 둔다.

## 3. MyHealthWay와 개인 건강보험 기록

공식 시작점: [활용서비스 개발기관 회원가입](https://www.myhealthway.go.kr/portal/index?page=Organization/Portal/PortalFunction/OrFunctionMember), [지정심사](https://myhealthway.go.kr/portal/index?page=Organization/Portal/PortalFunction/OrFunctionPerScreeing), [보호 및 활용](https://www.myhealthway.go.kr/portal/index?page=Individual/Portal/MediMyData/MydataProtect). 공식 문의는 1666-7598이다.

1. 건강정보 고속도로 포털에서 **활용서비스 개발기관**으로 기관 회원가입한다. 약관 동의, PASS/금융인증서 본인확인, 기관·관리자 정보가 필요하다.
2. 가입 후 지정심사를 신청한다. 서비스 목적, 데이터 흐름, 동의·철회, 보관·파기, 위탁, 사고대응, 접근통제, 암호화와 제출서류를 하나의 일관된 설계로 준비한다.
3. 승인 전에는 테스트베드 접근을 전제로 코드를 켜지 않는다. 지정심사 승인 후 제공되는 최신 기술규격과 계약조건을 받아 별도 revision/digest receipt로 보관한다.
4. 고정 IP, TLS/HTTPS, 서버·DB 암호화, 방화벽, 소스코드 및 모바일 앱 취약점 점검 등 공식 보안요건을 인프라에 반영하고 증거를 만든다.
5. 사용자 인증, 건강정보 제공·활용 동의, 철회, 최소 범위 조회, 삭제와 접속기록을 end-to-end로 테스트한다. MyHealthWay 화면에서 Kakao/Naver 인증을 지원하더라도 제품 로그인과 건강정보 동의는 별개로 처리한다.
6. 테스트베드 승인, 보안 심사, 계약, production endpoint와 운영 인증서가 모두 발급된 뒤 별도 운영 활성화 승인을 요청한다.

“건강보험 API”는 두 가지를 분리한다.

- 통계·공공데이터: 공공데이터포털/NHIS/HIRA가 공개한 비식별·집계 데이터의 개별 이용조건을 검토해 연구 runtime에서만 사용한다.
- 개인별 건강보험·진료기록: 사용자의 적법한 전송·제공 동의와 MyHealthWay 등 승인된 공식 경로가 없는 한 수집하지 않는다. 크롤링, 인증서 대행, 화면 자동화로 우회하지 않는다.

## 4. 실데이터와 PHI를 합법적으로 확보하는 순서

1. **지금:** 합성 데이터와 이용조건이 검토된 공개·비식별 데이터로 기능·보안·성능을 검증한다.
2. **그다음:** 개인정보/의료 전문 변호사와 개인정보보호 책임자가 처리 목적, 법적 근거, 민감정보 별도 동의, 보유기간, 파기, 처리위탁, 국외이전 여부, 정보주체 권리와 침해대응을 서면 승인한다. 개인정보 보호법 제23조는 건강정보를 민감정보로 보고 원칙적으로 처리를 제한하며, 별도 동의 또는 법률상 근거와 안전조치를 요구한다.
3. **기관 연구 데이터:** 병원/검진기관과 데이터 사용계약, 필요 시 IRB/기관 승인, 최소 데이터셋, 가명처리 방식, 반출심사와 안전한 분석구역을 먼저 확정한다. 기관이 “익명”이라고 부른다는 이유만으로 재식별 위험 검토를 생략하지 않는다.
4. **사용자 직접 업로드 pilot:** hosted object/IAM/queue 분리, non-root immutable images, malware signature 운영, observability, backup/restore, deletion replay, 외부 audit anchor, 400%/screen-reader 검증과 incident exercise가 PASS인 제한된 pilot에서만 시작한다.
5. 데이터 반입 전 모든 source에 `authority`, `purpose`, `consent/contract receipt`, `retention deadline`, `deletion route`, `dataset digest`, `owner`를 붙인다. 하나라도 없으면 fail closed다.

이는 법률 자문이 아니다. 실제 처리 전에 한국 법률·개인정보 전문가의 프로젝트별 서면 검토가 필요하다.

## 5. 의료 AI를 가져오는 순서

1. 먼저 intended use와 금지 claim을 고정한다. 현재 허용 범위는 “문서 구조와 측정값 **후보** 추출 + 사용자 확인”이며 진단, 정상/비정상 판정, 위험도 예측, 치료 추천은 금지한다.
2. PaddleOCR-VL/MedGemma 등 후보마다 정확한 model revision, 모든 파일 SHA-256, 라이선스·이용약관 승인, 취약점/악성코드 검사, 한국어 의료문서 평가셋과 model card를 만든다. `latest`나 부동 revision은 금지한다.
3. PHI 없이 합성·허가된 평가셋으로 필드 정확도, 누락, 문서별 실패, 과신, 재현성과 human-review 안전성을 검증한다.
4. 격리 runner는 immutable image digest, `--network=none`, read-only input/model, 무권한 사용자, 출력 schema와 source digest 결합을 강제한다. 모델 출력은 자동 건강기록이 되지 않는다.
5. 제품 설명이나 기능이 진단·예측·치료 등 의료목적으로 이동하기 전에 식약처에 분류·사전상담을 받고 최신 디지털의료제품/의료기기 절차를 따른다. 식약처는 [생성형 인공지능 의료기기 허가·심사 가이드라인](https://www.mfds.go.kr/brd/m_1060/view.do?Data_stts_gubun=C1004&company_cd=&company_nm=&itm_seq_1=0&itm_seq_2=0&multi_itm_seq=0&page=9&seq=15628&srchFr=&srchTo=&srchTp=0&srchWord=)을 제공한다.

구체적인 현 모델 runner 경계는 [medical-document-runner.md](../implementation/medical-document-runner.md)를 따른다.

## Jason이 신청 후 개발팀에 돌려줄 것

비밀 **값** 대신 아래 메타데이터만 전달한다.

| 필드 | 예시 형식 |
|---|---|
| provider/environment | `KAKAO / STAGING` |
| application 또는 심사 ID | 포털이 발급한 비밀이 아닌 식별자 |
| 승인된 origin/callback | 정확한 HTTPS URL 목록 |
| 승인/계약 receipt | 문서 ID, 버전, 승인일, 만료일, 승인자 |
| secret 좌표 | Secret Manager ARN/리소스명과 VersionId; secret 값 제외 |
| scope와 목적 | 승인된 최소 scope, 목적 문구 |
| 고정 IP/인증서 메타데이터 | IP/CIDR, 인증서 serial/expiry; private key 제외 |
| 운영 owner | 담당자 역할과 rotation/incident 연락망 |

이 packet이 완성되면 먼저 synthetic staging adapter를 구현하고, provider별 contract/security test를 통과시킨다. 그 뒤에도 `provider_and_real_data_activation`은 별도 founder approval이 있기 전까지 `DISABLED`다.
