import type { Metadata } from "next";
import { MyData } from "@/components/my-data/MyData";

export const metadata: Metadata = {
  title: "나의 데이터",
  description: "직접 확인한 기록을 한 칸씩 시간 순서로 보고, 값과 출처를 확인하는 화면",
};

export default function MyDataPage() {
  return <MyData />;
}
