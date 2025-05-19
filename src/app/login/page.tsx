"use client";

import { useState, useEffect, Suspense } from "react";
import { Form, Input, Button, Card, message, Spin } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { SafetyOutlined } from "@ant-design/icons";

// 使用SearchParams的组件，单独抽离
function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPath = searchParams.get("from") || "/";
  const isTestMode = searchParams.get("test_auth") === "1";

  useEffect(() => {
    // 检查是否从本地访问
    const hostname = window.location.hostname;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && !isTestMode) {
      setIsLocal(true);
      // 如果是本地访问且不是测试模式，自动重定向到主页
      router.push("/");
    }
  }, [router, isTestMode]);

  const onFinish = async (values: {token: string}) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        message.success("登录成功");
        // 登录成功后重定向到原来的页面，保留测试模式参数
        const redirectPath = isTestMode && fromPath !== "/" 
          ? `${fromPath}${fromPath.includes('?') ? '&' : '?'}test_auth=1` 
          : fromPath;
        router.push(redirectPath);
      } else {
        message.error(data.message || "验证码错误");
      }
    } catch (error) {
      console.error("登录失败:", error);
      message.error("登录失败，请稍后重试");
    } finally {
      setLoading(false);
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
        {isTestMode && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            测试模式已启用
          </div>
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