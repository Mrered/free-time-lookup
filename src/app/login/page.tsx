"use client";

import { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Spin } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface LoginFormValues {
  username: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPath = searchParams.get("from") || "/";
  const isTestMode = searchParams.get("test_auth") === "1";

  useEffect(() => {
    // 检查是否允许注册
    const allowRegistration = process.env.NEXT_PUBLIC_ALLOW_REGISTRATION === "true";
    setIsRegistrationEnabled(allowRegistration);
    
    // 检查是否从本地访问
    const hostname = window.location.hostname;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && !isTestMode) {
      setIsLocal(true);
      // 如果是本地访问且不是测试模式，自动重定向到主页
      router.push("/");
    }
  }, [router, isTestMode]);

  const onFinish = async (values: LoginFormValues) => {
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
        message.error(data.message || "用户名或密码错误");
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
            测试模式已启用，可以在本地测试登录功能。<br />
            用户名: admin<br />
            密码: admin123
          </div>
        )}
        <Form
          name="login"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="current-password" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="mt-4"
            >
              登录
            </Button>
          </Form.Item>
          
          {isRegistrationEnabled && (
            <div className="text-center">
              <Link 
                href={isTestMode ? "/register?test_auth=1" : "/register"} 
                className="text-blue-500 hover:underline"
              >
                没有账号？立即注册
              </Link>
            </div>
          )}
        </Form>
      </Card>
    </div>
  );
} 