import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// 简单的用户验证，实际项目中应使用更安全的方式存储和验证
const VALID_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

// 令牌过期时间（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // 获取请求体中的用户名和密码
    const { username, password } = await req.json();

    // 验证用户名和密码
    if (
      username === VALID_CREDENTIALS.username &&
      password === VALID_CREDENTIALS.password
    ) {
      // 创建简单的认证令牌（实际应用中应使用更安全的JWT或其他方式）
      const token = btoa(`${username}:${Date.now()}`);
      
      // 设置令牌到Cookie中，过期时间为24小时
      const response = NextResponse.json({ 
        success: true, 
        message: "登录成功" 
      });
      
      // 在响应中设置cookie
      response.cookies.set({
        name: "auth-token",
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: TOKEN_EXPIRY / 1000, // 以秒为单位
        path: "/",
      });

      return response;
    }

    // 用户名或密码错误
    return NextResponse.json(
      { success: false, message: "用户名或密码错误" },
      { status: 401 }
    );
  } catch (error) {
    console.error("登录处理错误:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
} 