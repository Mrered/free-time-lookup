import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";

// 令牌过期时间（24小时）
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

// 默认用户信息（不再需要存储在数据库中）
const DEFAULT_USER = {
  displayName: "管理员",
  avatar: null
};

// 辅助函数 - 记录日志到控制台
const logInfo = (message: string, data?: Record<string, unknown>) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    ...(data && { data })
  };
  console.log(`[TOTP_AUTH_INFO] ${JSON.stringify(logEntry)}`);
};

const logError = (message: string, error?: unknown) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    error: error instanceof Error ? error.message : error
  };
  console.error(`[TOTP_AUTH_ERROR] ${JSON.stringify(logEntry)}`);
};

// 检查是否是有效的base32编码字符串
const isValidBase32 = (str: string): boolean => {
  return /^[A-Z2-7]+=*$/i.test(str);
};

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    const secret = process.env.TOTP_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, message: "TOTP_SECRET未配置" }, { status: 500 });
    }
    authenticator.options = { digits: 6, step: 30, window: 1 };
    const isValid = authenticator.check(token, secret);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "验证码无效" }, { status: 401 });
    }
    // 生成session token（简单实现，生产建议用JWT或更安全方案）
    const authToken = Buffer.from(`admin:${Date.now()}`).toString('base64');
    const response = NextResponse.json({ success: true, message: "登录成功", user: { username: "admin" } });
    response.cookies.set({
      name: "auth-token",
      value: authToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 5 * 60, // 5分钟
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: "服务器错误" }, { status: 500 });
  }
} 