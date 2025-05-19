import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// 用户数据存储密钥
const USER_KEY = "auth_user";

// 令牌过期时间（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    // 获取请求体中的用户名和密码
    const { username, password } = await req.json();

    // 从数据库获取用户信息
    const res = await fetch(new URL(`/api/upload-excel?key=${USER_KEY}`, req.nextUrl.origin), { 
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    
    const result = await res.json();
    
    let userData;
    
    // 如果没有找到用户数据，初始化默认用户
    if (!result.value) {
      userData = {
        username: "admin",
        password: "admin123",
        displayName: "管理员",
        avatar: null
      };
      
      await fetch(new URL('/api/upload-excel', req.nextUrl.origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: USER_KEY, value: userData }),
      });
    } else {
      // 解析用户数据
      userData = typeof result.value === "string" 
        ? JSON.parse(result.value)
        : result.value;
    }

    // 验证用户名和密码
    if (
      username === userData.username &&
      password === userData.password
    ) {
      // 创建简单的认证令牌（实际应用中应使用更安全的JWT或其他方式）
      const token = btoa(`${username}:${Date.now()}`);
      
      // 设置令牌到Cookie中，过期时间为24小时
      const response = NextResponse.json({ 
        success: true, 
        message: "登录成功",
        user: {
          username: userData.username,
          displayName: userData.displayName || userData.username,
          avatar: userData.avatar
        }
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