import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json({ message: "缺少 key 或 value" }, { status: 400 });
    }
    await redis.set(key, JSON.stringify(value));
    return NextResponse.json({ message: "写入成功" });
  } catch (err: any) {
    return NextResponse.json({ message: "写入失败: " + err.message }, { status: 500 });
  }
} 