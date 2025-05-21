import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const USER_KEY = "auth_user";

// 获取用户信息
export async function GET(req: NextRequest) {
  const authToken = req.cookies.get('auth-token')?.value;
  if (!authToken) {
    return NextResponse.json({ success: false, message: "未授权访问" }, { status: 401 });
  }
  // 这里只返回静态用户信息
  return NextResponse.json({ success: true, user: { username: "admin" } });
}

// 更新用户信息
export async function PUT(req: NextRequest) {
  const authToken = req.cookies.get('auth-token')?.value;
  if (!authToken) {
    return NextResponse.json({ success: false, message: "未授权访问" }, { status: 401 });
  }
  return NextResponse.json({ success: true, message: "更新成功" });
} 