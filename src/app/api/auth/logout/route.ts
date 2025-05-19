import { NextResponse } from "next/server";

export async function POST() {
  try {
    // 创建响应
    const response = NextResponse.json({
      success: true,
      message: "已成功退出登录"
    });
    
    // 清除认证cookie
    response.cookies.set({
      name: "auth-token",
      value: "",
      expires: new Date(0), // 设置为过期的日期
      path: "/",
    });
    
    return response;
  } catch (error) {
    console.error("退出登录失败:", error);
    return NextResponse.json(
      { success: false, message: "退出登录时发生错误" },
      { status: 500 }
    );
  }
} 