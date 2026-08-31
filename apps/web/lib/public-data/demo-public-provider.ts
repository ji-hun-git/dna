import { z } from "zod";

const sourceContractSchema = z.object({
  id: z.enum(["hira-hospital-information", "hira-non-covered-price"]),
  agency: z.literal("건강보험심사평가원"),
  datasetName: z.string().min(1),
  catalogUrl: z.string().url().startsWith("https://www.data.go.kr/"),
  format: z.literal("XML REST API"),
  connectionState: z.literal("not-connected"),
}).strict();

export const providerDemoRecordSchema = z.object({
  id: z.string().regex(/^demo-provider-[a-z0-9-]+$/),
  providerName: z.enum(["가나다종합병원", "라모아건강검진센터", "바른봄의원", "다온부산병원"]),
  providerType: z.enum(["종합병원", "병원", "의원", "건강검진센터"]),
  region: z.enum(["서울", "부산"]),
  address: z.string().endsWith("예시 주소"),
  telephone: z.null(),
  sourceContractId: z.literal("hira-hospital-information"),
  disclosure: z.literal("synthetic-not-a-real-provider"),
}).strict();

export const priceDemoRecordSchema = z.object({
  id: z.string().regex(/^demo-price-[a-z0-9-]+$/),
  providerName: z.enum(["가나다종합병원", "다온부산병원"]),
  providerType: z.enum(["종합병원", "병원"]),
  region: z.enum(["서울", "부산"]),
  itemCode: z.string().startsWith("DEMO-"),
  itemName: z.string().endsWith("· 예시 항목"),
  currentAmountWon: z.number().int().positive(),
  effectivePeriod: z.literal("예시 적용 기간"),
  sourceContractId: z.literal("hira-non-covered-price"),
  disclosure: z.literal("synthetic-not-a-quote"),
}).strict();

export const publicProviderDemoSchema = z.object({
  schemaVersion: z.literal("public-provider-demo.v1"),
  generatedAt: z.literal("2026-08-12T00:00:00+09:00"),
  liveApiCalls: z.literal(0),
  environment: z.literal("synthetic-demo"),
  sortRule: z.literal("provider-name-ko-ascending"),
  sources: z.array(sourceContractSchema).length(2),
  providers: z.array(providerDemoRecordSchema).min(1),
  prices: z.array(priceDemoRecordSchema).min(1),
}).strict();

export const publicProviderDemo = publicProviderDemoSchema.parse({
  schemaVersion: "public-provider-demo.v1",
  generatedAt: "2026-08-12T00:00:00+09:00",
  liveApiCalls: 0,
  environment: "synthetic-demo",
  sortRule: "provider-name-ko-ascending",
  sources: [
    {
      id: "hira-hospital-information",
      agency: "건강보험심사평가원",
      datasetName: "건강보험심사평가원_병원정보서비스",
      catalogUrl: "https://www.data.go.kr/data/15001698/openapi.do",
      format: "XML REST API",
      connectionState: "not-connected",
    },
    {
      id: "hira-non-covered-price",
      agency: "건강보험심사평가원",
      datasetName: "건강보험심사평가원_비급여진료비정보조회서비스",
      catalogUrl: "https://www.data.go.kr/data/15001700/openapi.do",
      format: "XML REST API",
      connectionState: "not-connected",
    },
  ],
  providers: [
    {
      id: "demo-provider-gana-seoul",
      providerName: "가나다종합병원",
      providerType: "종합병원",
      region: "서울",
      address: "서울특별시 · 예시 주소",
      telephone: null,
      sourceContractId: "hira-hospital-information",
      disclosure: "synthetic-not-a-real-provider",
    },
    {
      id: "demo-provider-ramoa-seoul",
      providerName: "라모아건강검진센터",
      providerType: "건강검진센터",
      region: "서울",
      address: "서울특별시 · 예시 주소",
      telephone: null,
      sourceContractId: "hira-hospital-information",
      disclosure: "synthetic-not-a-real-provider",
    },
    {
      id: "demo-provider-bareun-seoul",
      providerName: "바른봄의원",
      providerType: "의원",
      region: "서울",
      address: "서울특별시 · 예시 주소",
      telephone: null,
      sourceContractId: "hira-hospital-information",
      disclosure: "synthetic-not-a-real-provider",
    },
    {
      id: "demo-provider-daon-busan",
      providerName: "다온부산병원",
      providerType: "병원",
      region: "부산",
      address: "부산광역시 · 예시 주소",
      telephone: null,
      sourceContractId: "hira-hospital-information",
      disclosure: "synthetic-not-a-real-provider",
    },
  ],
  prices: [
    {
      id: "demo-price-mri-gana",
      providerName: "가나다종합병원",
      providerType: "종합병원",
      region: "서울",
      itemCode: "DEMO-MRI-BRAIN",
      itemName: "뇌 MRI · 예시 항목",
      currentAmountWon: 480000,
      effectivePeriod: "예시 적용 기간",
      sourceContractId: "hira-non-covered-price",
      disclosure: "synthetic-not-a-quote",
    },
    {
      id: "demo-price-mri-daon",
      providerName: "다온부산병원",
      providerType: "병원",
      region: "부산",
      itemCode: "DEMO-MRI-BRAIN",
      itemName: "뇌 MRI · 예시 항목",
      currentAmountWon: 530000,
      effectivePeriod: "예시 적용 기간",
      sourceContractId: "hira-non-covered-price",
      disclosure: "synthetic-not-a-quote",
    },
    {
      id: "demo-price-endoscopy-gana",
      providerName: "가나다종합병원",
      providerType: "종합병원",
      region: "서울",
      itemCode: "DEMO-ENDOSCOPY-SEDATION",
      itemName: "수면 내시경 관리료 · 예시 항목",
      currentAmountWon: 97000,
      effectivePeriod: "예시 적용 기간",
      sourceContractId: "hira-non-covered-price",
      disclosure: "synthetic-not-a-quote",
    },
  ],
});

export type ProviderDemoRecord = z.infer<typeof providerDemoRecordSchema>;
export type PriceDemoRecord = z.infer<typeof priceDemoRecordSchema>;
