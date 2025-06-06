import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/utils/redis";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    console.log("[POST] 环境变量 REDIS_URL:", process.env.REDIS_URL);
    const redis = await getRedis();
    console.log("[POST] Redis 连接成功");
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      console.log("[POST] 缺少 key 或 value", { key, value });
      return NextResponse.json({ message: "缺少 key 或 value" }, { status: 400 });
    }
    let newValue = value;
    if (Array.isArray(value)) {
      newValue = value.map((item) => {
        if (!item.uuid) {
          return { ...item, uuid: uuidv4() };
        }
        return item;
      });
    }
    await redis.set(key, JSON.stringify(newValue));
    console.log("[POST] 数据写入成功", { key, value });
    return NextResponse.json({ message: "写入成功" });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[POST] 写入失败", error);
    return NextResponse.json({ message: "写入失败: " + error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    console.log("[GET] 环境变量 REDIS_URL:", process.env.REDIS_URL);
    const redis = await getRedis();
    console.log("[GET] Redis 连接成功");
    const value = await redis.get("excel_data");
    console.log("[GET] 读取到的原始数据:", value);
    let arr = value ? JSON.parse(value) : [];
    if (Array.isArray(arr)) {
      arr = arr.map((item) => {
        if (!item.uuid) {
          return { ...item, uuid: uuidv4() };
        }
        return item;
      });
    }
    return NextResponse.json({ value: arr });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("[GET] 读取失败", error);
    return NextResponse.json({ message: "读取失败: " + error.message }, { status: 500 });
  }
} 