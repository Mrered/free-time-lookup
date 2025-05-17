import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function POST(req: NextRequest) {
  try {
    await redis.flushdb();
    return NextResponse.json({ message: "数据库已清空" });
  } catch (err: any) {
    return NextResponse.json({ message: "清空失败: " + err.message }, { status: 500 });
  }
} 