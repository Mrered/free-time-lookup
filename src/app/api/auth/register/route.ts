import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// 用户数据存储密钥
const USER_KEY = "auth_user";

// 令牌过期时间（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// 检查是否允许注册
const isRegistrationEnabled = process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true";

export async function POST(req: NextRequest) {
  try {
    // 检查是否允许注册
    if (!isRegistrationEnabled) {
      return NextResponse.json(
        { success: false, message: "注册功能已关闭" },
        { status: 403 }
      );
    }

    // 获取请求体中的注册信息
    const { username, password, displayName } = await req.json();
    
    // 验证必填字段
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "用户名和密码不能为空" },
        { status: 400 }
      );
    }
    
    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: "密码至少需要6个字符" },
        { status: 400 }
      );
    }
    
    // 从数据库获取用户信息，检查用户名是否已存在
    // 在服务器组件中直接使用相对路径
    const res = await fetch(new URL(`/api/upload-excel?key=${USER_KEY}`, req.nextUrl.origin), { 
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    
    const result = await res.json();
    
    let existingUser = null;
    
    if (result.value) {
      // 解析用户数据
      existingUser = typeof result.value === "string" 
        ? JSON.parse(result.value)
        : result.value;
        
      // 检查用户名是否已存在
      if (existingUser.username === username) {
        return NextResponse.json(
          { success: false, message: "用户名已存在" },
          { status: 409 }
        );
      }
    }
    
    // 创建新用户
    const newUser = {
      username,
      password,
      displayName: displayName || username,
      avatar: null
    };
    
    // 保存新用户数据
    await fetch(new URL('/api/upload-excel', req.nextUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: USER_KEY, value: newUser }),
    });
    
    // 创建认证令牌
    const token = btoa(`${username}:${Date.now()}`);
    
    // 创建响应
    const response = NextResponse.json({ 
      success: true, 
      message: "注册成功",
      user: {
        username: newUser.username,
        displayName: newUser.displayName,
        avatar: newUser.avatar
      }
    });
    
    // 设置认证Cookie
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
  } catch (error) {
    console.error("注册处理错误:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
} 