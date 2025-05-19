"use client";

import { useState, useEffect } from "react";
import { Form, Input, Button, Card, message, Spin, Alert } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [isLocal, setIsLocal] = useState(false);
  const [isRegistrationEnabled, setIsRegistrationEnabled] = useState<boolean | null>(null);
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

  const onFinish = async (values: RegisterFormValues) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: values.username,
          password: values.password,
          displayName: values.displayName
        }),
      });

      const data = await response.json();

      if (response.ok) {
        message.success("注册成功");
        // 注册成功后重定向到原来的页面，保留测试模式参数
        const redirectPath = isTestMode && fromPath !== "/" 
          ? `${fromPath}${fromPath.includes('?') ? '&' : '?'}test_auth=1` 
          : fromPath;
        router.push(redirectPath);
      } else {
        message.error(data.message || "注册失败");
      }
    } catch (error) {
      console.error("注册失败:", error);
      message.error("注册失败，请稍后重试");
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

  if (isRegistrationEnabled === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card 
          title={<div className="text-center text-xl font-bold">注册已关闭</div>} 
          style={{ width: 400, maxWidth: "90%" }}
          className="shadow-md"
        >
          <Alert 
            message="注册功能已关闭" 
            description="管理员已关闭注册功能，请联系管理员获取账号。" 
            type="warning" 
            showIcon 
          />
          <div className="mt-4 text-center">
            <Link href="/login" className="text-blue-500 hover:underline">
              返回登录
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card 
        title={<div className="text-center text-xl font-bold">用户注册</div>} 
        style={{ width: 400, maxWidth: "90%" }}
        className="shadow-md"
      >
        {isTestMode && (
          <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
            测试模式已启用
          </div>
        )}
        <Form
          name="register"
          layout="vertical"
          initialValues={{ remember: true }}
          onFinish={onFinish}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少3个字符" }
            ]}
          >
            <Input placeholder="请输入用户名" autoComplete="username" />
          </Form.Item>

          <Form.Item
            label="显示名称"
            name="displayName"
            rules={[
              { min: 2, message: "显示名称至少2个字符" }
            ]}
          >
            <Input placeholder="请输入显示名称（选填）" />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少6个字符" }
            ]}
          >
            <Input.Password placeholder="请输入密码" autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入密码" autoComplete="new-password" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="mt-4"
            >
              注册
            </Button>
          </Form.Item>
          
          <div className="text-center">
            <Link href="/login" className="text-blue-500 hover:underline">
              已有账号？返回登录
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
} 