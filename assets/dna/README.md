# DNA Health Intelligence — Development Kit

이 폴더는 `지금 바로 실행 가능한 MVP`와 `운영 전환 가능한 스키마`를 빠르게 구축하기 위한 시작점입니다.

## 현재 목표 (v0.1)
- PDF/사진/이미지/DICOM/CSV, DNA raw data를 **안전하게 등록**
- 결과 데이터의 **source-of-truth 스키마화**
- 정규화/검증 후 LLM/분석 엔진이 소비할 수 있는 **공통 패브릭 이벤트** 생성
- 개인정보 최소화 및 감사 로그 확보

## 개발 원칙
1. **증분 배포 가능성**: 한 번에 하나의 작은 패스만 배포
2. **재사용 스키마 우선**: 모든 파이프라인 입력은 JSON Schema로 강제
3. **프라이버시 우선**: 업로드 바이트는 원문 해시만 저장하고, 민감 항목은 접근 제한
4. **검증 가능한 근거 체인**: 정규화 전후 checksum + version + producer 정보 남김

## 다음 스텝
- API endpoint + worker 큐 + DB 저장소 연결
- 규칙 엔진/임계치 테이블 확정
- 실사용자 온보딩 UX 및 인증/권한

## 빠른 실행 체크리스트

```bash
# 1) 샘플 CSV 파싱/분석
python assets/dna/scripts/health_pipeline.py assets/dna/fixtures/sample_baseline.csv --subject-id demo

# 2) 업로드 이벤트 생성(로컬)
python assets/dna/scripts/emit.py csv_upload assets/dna/fixtures/sample_baseline.csv --actor demo-user

# 3) 기본 회귀 테스트
python assets/dna/scripts/test_health_pipeline.py
```

각 스크립트는 외부 의존성 없이 동작하도록 구성되어 있으며, 추후 단계에서
- `jsonschema` 기반 정밀 검증
- 실제 API/큐 연동
- LLM 기반 상세 인사이트 생성
으로 확장 가능합니다.
