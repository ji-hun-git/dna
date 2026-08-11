export const candidateOnlyPipelineDisclosure = {
  layoutModel: "PaddleOCR-VL 1.6",
  semanticModel: "MedGemma 1.5 4B",
  evaluationGate: "medical-document-eval.v1",
  executionBoundary: "오프라인 실행 · 네트워크 없음",
  artifactPolicy: "runner와 모델의 SHA-256이 모두 일치해야 실행",
  disposition: "자동 결과는 후보로만 제시하고 사람의 확인 전에는 저장하지 않음",
} as const;
