export const candidateOnlyPipelineDisclosure = {
  layoutModel: "PaddleOCR-VL 1.6",
  semanticModel: "MedGemma 1.5 4B",
  evaluationGate: "출시 전 의료 문서 평가를 통과해야 함",
  executionBoundary: "기기 안에서 오프라인으로 실행할 계획",
  artifactPolicy: "실행 프로그램과 모델의 파일 확인값이 모두 맞을 때만 사용",
  disposition: "자동 결과는 후보만 보여주고 사용자가 확인하기 전에는 저장하지 않음",
} as const;
