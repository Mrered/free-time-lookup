import { NextRequest, NextResponse } from "next/server";
import { totp } from "otplib";

// 令牌过期时间（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// 默认用户信息（不再需要存储在数据库中）
const DEFAULT_USER = {
  displayName: "管理员",
  avatar: null
};

export async function POST(req: NextRequest) {
  try {
    // 获取请求体中的验证码
    const { token } = await req.json();
    
    // 验证必填字段
    if (!token) {
      return NextResponse.json(
        { success: false, message: "验证码不能为空" },
        { status: 400 }
      );
    }

    // 从环境变量获取TOTP URL
    const totpUrl = process.env.TOTP_URL;
    
    if (!totpUrl) {
      console.error("TOTP_URL环境变量未设置");
      return NextResponse.json(
        { success: false, message: "系统配置错误" },
        { status: 500 }
      );
    }

    // 从URL提取密钥
    try {
      // 从URL提取参数
      const url = new URL(totpUrl);
      const params = new URLSearchParams(url.search);
      const secret = params.get('secret');
      
      if (!secret) {
        console.error("TOTP_URL中未找到secret参数");
        return NextResponse.json(
          { success: false, message: "系统配置错误" },
          { status: 500 }
        );
      }
      
      // 设置TOTP选项
      totp.options = { 
        digits: 6,
        step: 30
      };
      
      // 验证TOTP
      const isValid = totp.verify({
        token,
        secret
      });
      
      if (isValid) {
        // 创建认证令牌
        const authToken = btoa(`admin:${Date.now()}`);
        
        // 设置令牌到Cookie中
        const response = NextResponse.json({ 
          success: true, 
          message: "登录成功",
          user: DEFAULT_USER
        });
        
        // 在响应中设置cookie
        response.cookies.set({
          name: "auth-token",
          value: authToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: TOKEN_EXPIRY / 1000, // 以秒为单位
          path: "/",
        });

        return response;
      } else {
        return NextResponse.json(
          { success: false, message: "验证码无效或已过期" },
          { status: 401 }
        );
      }
    } catch (error) {
      console.error("TOTP URL解析错误:", error);
      return NextResponse.json(
        { success: false, message: "系统配置错误" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("登录处理错误:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
} 