import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "已成功退出登录" });
  response.cookies.set({
    name: "auth-token",
    value: "",
    expires: new Date(0),
    path: "/",
  });
  return response;
} 