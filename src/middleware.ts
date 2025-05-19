import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 不需要验证的路径列表
const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export function middleware(request: NextRequest) {
  const { pathname, hostname, searchParams } = request.nextUrl;
  
  // 检查是否启用测试模式（使用查询参数test_auth=1）
  const isTestMode = searchParams.get('test_auth') === '1';
  
  // 如果是通过localhost或127.0.0.1访问，且不是测试模式，无需验证
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && !isTestMode) {
    return NextResponse.next();
  }
  
  // 如果访问的是公开路径，无需验证
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // 检查API路径
  if (pathname.startsWith('/api/')) {
    // 对API请求进行验证
    const authToken = request.cookies.get('auth-token')?.value;
    
    if (!authToken) {
      return new NextResponse(
        JSON.stringify({ success: false, message: '未授权访问' }),
        { 
          status: 401,
          headers: { 'content-type': 'application/json' }
        }
      );
    }
    
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
    return NextResponse.redirect(url);
  }
  
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