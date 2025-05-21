import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/utils/redis";

const SEMESTER_KEY = "semester_info";

// 数据结构示例：
// {
//   year: 2024,
//   semester: "春季" | "秋季",
//   firstMonday: "2024-02-26",
//   holidays: [
//     { name: "清明节", start: "2024-04-04", end: "2024-04-06" },
//     ...
//   ]
// }

export async function GET() {
  try {
    const redis = await getRedis();
    const value = await redis.get(SEMESTER_KEY);
    return NextResponse.json({ value: value ? JSON.parse(value) : null });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ message: "读取失败: " + error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const redis = await getRedis();
    const body = await req.json();
    // 校验字段
    if (!body.year || !body.semester || !body.firstMonday) {
      return NextResponse.json({ message: "缺少 year/semester/firstMonday" }, { status: 400 });
    }
    // holidays 可选，若有则校验格式
    if (body.holidays && !Array.isArray(body.holidays)) {
      return NextResponse.json({ message: "holidays 必须为数组" }, { status: 400 });
    }
    await redis.set(SEMESTER_KEY, JSON.stringify(body));
    return NextResponse.json({ message: "保存成功" });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ message: "保存失败: " + error.message }, { status: 500 });
  }
} 