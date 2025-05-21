import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/utils/redis";

// 姓名脱敏函数
function maskName(name: string): string {
  if (!name) return "";
  if (name.length < 2) return name;
  return name[0] + "*" + name.slice(2);
}

export async function GET(req: NextRequest) {
  try {
    const redis = await getRedis();
    const value = await redis.get("excel_data");
    const allData: any[] = value ? JSON.parse(value) : [];

    // 获取今天日期字符串（假设数据有date字段，格式为YYYY-MM-DD）
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // 只保留当天的数据，并脱敏姓名
    const filtered = allData
      // .filter((item: any) => item.date === todayStr)
      .map((item: any) => ({ ...item, name: maskName(item.name) }));

    return NextResponse.json({ success: true, data: filtered });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 