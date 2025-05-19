import { NextRequest, NextResponse } from "next/server";
import { totp, authenticator } from "otplib";

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
  logInfo("开始处理登录请求");
  
  try {
    // 获取请求体中的验证码
    const body = await req.json();
    const { token } = body;
    
    logInfo("收到登录请求体", { 
      token: token ? token.substring(0, 2) + '***' : "未提供",
      tokenLength: token?.length
    });
    
    // 验证必填字段
    if (!token) {
      logError("验证码不能为空");
      return NextResponse.json(
        { success: false, message: "验证码不能为空" },
        { status: 400 }
      );
    }

    // 从环境变量获取TOTP密钥
    const secret = process.env.TOTP_SECRET;
    
    logInfo("TOTP_SECRET环境变量", { 
      exists: !!secret,
      value: secret ? secret.substring(0, 4) + "..." : "未设置" 
    });
    
    if (!secret) {
      logError("TOTP_SECRET环境变量未设置");
      return NextResponse.json(
        { success: false, message: "系统配置错误" },
        { status: 500 }
      );
    }

    // 检查密钥是否是有效的base32编码
    const isBase32 = isValidBase32(secret);
    logInfo("TOTP密钥检查", { 
      length: secret.length,
      firstChars: secret.substring(0, 4),
      isBase32
    });
    
    if (!isBase32) {
      logError("TOTP密钥不是有效的base32编码");
      return NextResponse.json(
        { success: false, message: "系统配置错误：密钥格式无效" },
        { status: 500 }
      );
    }
    
    try {
      // 设置authenticator选项
      authenticator.options = { 
        digits: 6,
        step: 30,
        window: 1  // 允许±1个时间窗口的偏差
      };
      
      logInfo("authenticator配置已设置", { 
        digits: authenticator.options.digits, 
        step: authenticator.options.step,
        window: authenticator.options.window
      });
      
      // 生成当前token用于调试
      const currentToken = authenticator.generate(secret);
      
      logInfo("当前TOTP令牌", { 
        current: currentToken,
        userToken: token
      });
      
      // 验证TOTP
      logInfo("开始验证TOTP", { token, secretLength: secret.length });
      
      const isValid = authenticator.verify({ token, secret });
      
      logInfo("authenticator验证结果", { isValid });
      
      if (isValid) {
        // 创建认证令牌
        const authToken = btoa(`admin:${Date.now()}`);
        logInfo("验证成功，生成认证令牌");
        
        // 设置令牌到Cookie中
        const response = NextResponse.json({ 
          success: true, 
          message: "登录成功",
          user: DEFAULT_USER
        });
        
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
      } 
      
      // 如果authenticator验证失败，尝试使用totp库
      totp.options = {
        digits: 6,
        step: 30,
        window: 1
      };
      
      const totpValid = totp.verify({
        token,
        secret
      });
      
      logInfo("totp库验证结果", { totpValid });
      
      if (totpValid) {
        // 创建认证令牌
        const authToken = btoa(`admin:${Date.now()}`);
        logInfo("totp验证成功，生成认证令牌");
        
        // 设置令牌到Cookie中
        const response = NextResponse.json({ 
          success: true, 
          message: "登录成功",
          user: DEFAULT_USER
        });
        
        response.cookies.set({
          name: "auth-token",
          value: authToken,
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: TOKEN_EXPIRY / 1000,
          path: "/",
        });
        
        return response;
      }
      
      // 两种验证都失败
      logError("验证码无效或已过期", { 
        token, 
        currentTimeEpoch: Math.floor(Date.now() / 1000)
      });
      return NextResponse.json(
        { success: false, message: "验证码无效或已过期" },
        { status: 401 }
      );
    } catch (error) {
      logError("TOTP验证错误", error);
      return NextResponse.json(
        { success: false, message: "验证失败，请检查验证码是否正确" },
        { status: 400 }
      );
    }
  } catch (error) {
    logError("登录处理错误", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
} 