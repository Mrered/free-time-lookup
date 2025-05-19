import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/utils/redis";

export async function POST(req: NextRequest) {
  try {
    const redis = await getRedis();
    await redis.flushDb();
    return NextResponse.json({ message: "数据库已清空" });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json({ message: "清空失败: " + error.message }, { status: 500 });
  }
} 