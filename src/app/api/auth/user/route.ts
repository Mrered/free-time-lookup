import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const USER_KEY = "auth_user";

// 获取用户信息
export async function GET(req: NextRequest) {
  try {
    // 验证用户是否已登录
    const authToken = req.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { success: false, message: "未授权访问" },
        { status: 401 }
      );
    }

    // 从数据库获取用户信息
    const res = await fetch(new URL(`/api/upload-excel?key=${USER_KEY}`, req.nextUrl.origin), { 
      method: "GET",
      headers: {
        "Cache-Control": "no-cache"
      }
    });
    
    const result = await res.json();
    
    // 如果没有找到用户数据，初始化默认用户
    if (!result.value) {
      const defaultUser = {
        username: "admin",
        password: "admin123",
        displayName: "管理员",
        avatar: null
      };
      
      await fetch(new URL('/api/upload-excel', req.nextUrl.origin), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: USER_KEY, value: defaultUser }),
      });
      
      return NextResponse.json({ 
        success: true, 
        user: { 
          username: defaultUser.username,
          displayName: defaultUser.displayName,
          avatar: defaultUser.avatar
        } 
      });
    }
    
    // 解析用户数据
    const userData = typeof result.value === "string" 
      ? JSON.parse(result.value)
      : result.value;
    
    // 返回用户信息，但不包含密码
    return NextResponse.json({ 
      success: true, 
      user: {
        username: userData.username,
        displayName: userData.displayName,
        avatar: userData.avatar
      }
    });
  } catch (error) {
    console.error("获取用户信息失败:", error);
    return NextResponse.json(
      { success: false, message: "获取用户信息失败" },
      { status: 500 }
    );
  }
}

// 更新用户信息
export async function PUT(req: NextRequest) {
  try {
    // 验证用户是否已登录
    const authToken = req.cookies.get('auth-token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { success: false, message: "未授权访问" },
        { status: 401 }
      );
    }

    // 获取请求体
    const updateData = await req.json();
    
    // 从数据库获取当前用户信息
    const res = await fetch(new URL(`/api/upload-excel?key=${USER_KEY}`, req.nextUrl.origin), { method: "GET" });
    const result = await res.json();
    
    if (!result.value) {
      return NextResponse.json(
        { success: false, message: "用户数据不存在" },
        { status: 404 }
      );
    }
    
    // 解析用户数据
    const userData = typeof result.value === "string" 
      ? JSON.parse(result.value)
      : result.value;
    
    // 如果更新密码，需要验证旧密码
    if (updateData.newPassword) {
      if (updateData.currentPassword !== userData.password) {
        return NextResponse.json(
          { success: false, message: "当前密码不正确" },
          { status: 400 }
        );
      }
      
      // 更新密码
      userData.password = updateData.newPassword;
    }
    
    // 更新显示名称
    if (updateData.displayName) {
      userData.displayName = updateData.displayName;
    }
    
    // 更新头像
    if (updateData.avatar !== undefined) {
      userData.avatar = updateData.avatar;
    }
    
    // 保存更新后的用户数据
    await fetch(new URL('/api/upload-excel', req.nextUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: USER_KEY, value: userData }),
    });
    
    // 返回更新后的用户信息（不包含密码）
    return NextResponse.json({ 
      success: true, 
      user: {
        username: userData.username,
        displayName: userData.displayName,
        avatar: userData.avatar
      },
      message: "用户信息已更新"
    });
  } catch (error) {
    console.error("更新用户信息失败:", error);
    return NextResponse.json(
      { success: false, message: "更新用户信息失败" },
      { status: 500 }
    );
  }
} 