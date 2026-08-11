export const candidateOnlyPipelineDisclosure = {
  layoutModel: "PaddleOCR-VL 1.6",
  semanticModel: "MedGemma 1.5 4B",
  evaluationGate: "medical-document-eval.v1",
  disposition: "자동 결과는 후보로만 제시하고 사람의 확인 전에는 저장하지 않음",
} as const;
