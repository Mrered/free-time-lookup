import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 是否处于开发环境
const isDevelopment = process.env.NODE_ENV === 'development';

// 不需要验证的路径列表
const PUBLIC_PATHS = ['/'];

// 仅在开发环境允许访问的路径
const DEV_ONLY_PATHS = ['/debug', '/api/debug'];

// 日志记录函数
const logInfo = (message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    ...(data && { data })
  };
  console.log(`[MIDDLEWARE_INFO] ${JSON.stringify(logEntry)}`);
};

export function middleware(request: NextRequest) {
  const { pathname, hostname, searchParams } = request.nextUrl;
  
  logInfo("中间件处理请求", { 
    pathname, 
    hostname,
    method: request.method,
    hasAuthCookie: !!request.cookies.get('auth-token'),
    isDevelopment
  });
  
  // 检查是否启用测试模式（使用查询参数test_auth=1）
  const isTestMode = searchParams.get('test_auth') === '1';
  
  // 如果尝试访问注册页面，直接重定向到主页
  if (pathname.startsWith('/register')) {
    logInfo("拦截注册页面访问，重定向到主页");
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // 如果是通过localhost或127.0.0.1访问，且不是测试模式，无需验证
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && !isTestMode) {
    logInfo("本地访问，跳过验证");
    return NextResponse.next();
  }
  
  // 只允许根路径公开
  if (pathname === '/' || pathname === '/login') {
    logInfo("访问公开路径，跳过验证", { pathname });
    return NextResponse.next();
  }
  
  // 如果在开发环境中访问调试页面，允许访问
  if (isDevelopment && DEV_ONLY_PATHS.some(path => pathname.startsWith(path))) {
    logInfo("开发环境访问调试页面，允许访问", { pathname });
    return NextResponse.next();
  }
  
  // 检查API路径
  if (pathname.startsWith('/api/')) {
    logInfo("检查API路径的授权", { pathname });
    
    // 对API请求进行验证
    const authToken = request.cookies.get('auth-token')?.value;
    
    if (!authToken) {
      logInfo("API请求未授权，返回401", { pathname });
      return new NextResponse(
        JSON.stringify({ success: false, message: '未授权访问' }),
        { 
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }
    
    logInfo("API请求已授权", { pathname });
    return NextResponse.next();
  }
  
  // 检查用户是否已登录
  const authToken = request.cookies.get('auth-token')?.value;
  
  // 如果没有登录，重定向到登录页面
  if (!authToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', pathname);
    // 保留测试模式参数
    if (isTestMode) {
      url.searchParams.set('test_auth', '1');
    }
    
    logInfo("用户未登录，重定向到登录页面", { 
      redirectUrl: url.toString(),
      originalPath: pathname
    });
    
    return NextResponse.redirect(url);
  }
  
  logInfo("用户已登录，允许访问", { pathname });
  return NextResponse.next();
}

// 配置匹配的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * 1. 静态文件 (_next/, favicon.ico 等)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}; 