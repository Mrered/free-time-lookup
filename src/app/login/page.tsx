"use client";

import { useState, useEffect, Suspense } from "react";
import { Form, Input, Button, Card, message, Spin, Alert } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { SafetyOutlined } from "@ant-design/icons";

// 客户端日志记录函数
const logInfo = (message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    ...(data && { data })
  };
  console.log(`[TOTP_CLIENT_INFO] ${JSON.stringify(logEntry)}`);
};

const logError = (message: string, error?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    ...(error && { error: error instanceof Error ? error.message : error })
  };
  console.error(`[TOTP_CLIENT_ERROR] ${JSON.stringify(logEntry)}`);
};

// 使用SearchParams的组件，单独抽离
function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [loginErrors, setLoginErrors] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTestMode = searchParams.get("test_auth") === "1";

  useEffect(() => {
    logInfo("登录组件已挂载", { isTestMode });
    
    // 检查是否从本地访问
    const hostname = window.location.hostname;
    logInfo("检查主机名", { hostname });
    
    if ((hostname === "localhost" || hostname === "127.0.0.1") && !isTestMode) {
      setIsLocal(true);
      logInfo("检测到本地访问，准备重定向到主页");
      // 如果是本地访问且不是测试模式，自动重定向到主页
      router.push("/");
    }
  }, [router, isTestMode]);

  const onFinish = async (values: {token: string}) => {
    logInfo("表单提交", { token: "******" });
    setLoginErrors([]);
    setLoading(true);
    
    try {
      logInfo("发送登录请求");
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      logInfo("收到登录响应", { 
        status: response.status, 
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      const data = await response.json();
      logInfo("登录响应数据", { success: data.success, message: data.message });

      if (response.ok) {
        logInfo("登录成功，准备重定向到控制台");
        message.success("登录成功");
        
        // 登录成功后始终重定向到控制台（根路径），仅保留测试模式参数
        const redirectPath = isTestMode ? "/?test_auth=1" : "/";
        
        logInfo("执行重定向", { redirectPath });
        router.push(redirectPath);
        
        // 确保导航完成
        setTimeout(() => {
          if (window.location.pathname === "/login") {
            logInfo("重定向未生效，再次尝试", { currentPath: window.location.pathname });
            window.location.href = redirectPath;
          }
        }, 1000);
      } else {
        logError("登录失败", { message: data.message });
        message.error(data.message || "验证码错误");
        setLoginErrors([data.message || "验证码错误"]);
      }
    } catch (error) {
      logError("登录请求异常", error);
      console.error("登录失败详情:", error);
      message.error("登录失败，请稍后重试");
      setLoginErrors(["登录请求失败，请检查网络连接"]);
    } finally {
      setLoading(false);
      logInfo("登录流程完成");
    }
  };

  if (isLocal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin tip="检测到本地访问，正在跳转..." />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card 
        title={<div className="text-center text-xl font-bold">兴趣班空余时间查询系统</div>} 
        style={{ width: 400, maxWidth: "90%" }}
        className="shadow-md"
      >
        {loginErrors.length > 0 && (
          <Alert
            type="error"
            message="登录失败"
            description={
              <ul className="pl-5 mt-2 list-disc">
                {loginErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            className="mb-4"
            showIcon
          />
        )}
        
        <Form
          name="login"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item
            label="TOTP验证码"
            name="token"
            rules={[
              { required: true, message: "请输入验证码" },
              { len: 6, message: "验证码必须为6位数字" },
              { pattern: /^\d+$/, message: "验证码只能包含数字" }
            ]}
          >
            <Input 
              placeholder="请输入6位数字验证码" 
              autoComplete="one-time-code" 
              prefix={<SafetyOutlined />}
              maxLength={6}
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="mt-4"
              size="large"
            >
              验证并登录
            </Button>
          </Form.Item>
          
          <div className="text-xs text-gray-500 text-center mt-4">
            <p>请使用您的身份验证器应用扫描管理员提供的二维码，</p>
            <p>然后输入应用生成的6位验证码。</p>
          </div>
        </Form>
      </Card>
    </div>
  );
}

// 主页面组件，使用Suspense包裹
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Spin size="large" /></div>}>
      <LoginForm />
    </Suspense>
  );
} 