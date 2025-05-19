import { NextRequest, NextResponse } from "next/server";
import { totp, authenticator } from "otplib";

// 检查是否是有效的base32编码字符串
const isValidBase32 = (str: string): boolean => {
  return /^[A-Z2-7]+=*$/i.test(str);
};

export async function GET(req: NextRequest) {
  console.log("调试API被请求");
  
  try {
    // 从环境变量获取TOTP密钥
    const secret = process.env.TOTP_SECRET;
    
    if (!secret) {
      console.error("TOTP_SECRET环境变量未设置");
      return NextResponse.json(
        { success: false, message: "TOTP_SECRET环境变量未设置" },
        { status: 500 }
      );
    }

    console.log("获取到TOTP_SECRET:", secret.substring(0, 4) + "...");

    // 检查密钥是否是有效的base32编码
    const isBase32 = isValidBase32(secret);
    console.log("密钥检查:", { 
      length: secret.length, 
      isBase32,
      firstChars: secret.substring(0, 4)
    });

    if (!isBase32) {
      console.error("TOTP密钥不是有效的base32编码");
      return NextResponse.json(
        { success: false, message: "TOTP密钥不是有效的base32编码" },
        { status: 500 }
      );
    }
    
    // 设置authenticator选项
    authenticator.options = { 
      digits: 6,
      step: 30,
      window: 1
    };

    // 获取各种时间信息
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / 30);
    const prevTimeStep = timeStep - 1;
    const nextTimeStep = timeStep + 1;
    
    // 生成当前令牌
    const currentToken = authenticator.generate(secret);
    
    // 也用totp库生成一次用于对比
    totp.options = {
      digits: 6,
      step: 30
    };
    const totpToken = totp.generate(secret);
    
    // 计算剩余有效时间
    const remainingSeconds = 30 - (now % 30);
    
    // 获取认证状态
    const authToken = req.cookies.get('auth-token')?.value;
    
    // 检测客户端时间同步问题
    const epochSeconds = Math.floor(Date.now() / 1000);
    const serverTimeOffset = Math.abs(epochSeconds - now);
    
    return NextResponse.json({
      success: true,
      message: "TOTP配置有效",
      totpInfo: {
        secretLength: secret.length,
        secretFirstChars: secret.substring(0, 4) + "...",
        isBase32,
        currentToken,
        totpToken, // 使用另一个库生成的令牌
        tokensMatch: currentToken === totpToken,
        remainingSeconds,
        currentEpochTime: now,
        timeStep: timeStep,
        timeWindow: {
          previous: prevTimeStep,
          current: timeStep,
          next: nextTimeStep
        },
        digits: authenticator.options.digits,
        step: authenticator.options.step,
        window: authenticator.options.window,
        timeSync: {
          serverTime: now,
          clientTime: epochSeconds,
          offset: serverTimeOffset,
          isSynced: serverTimeOffset < 5 // 小于5秒视为同步
        },
        isAuthenticated: !!authToken
      }
    });
  } catch (error) {
    console.error("调试API错误:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "服务器错误", 
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
} 