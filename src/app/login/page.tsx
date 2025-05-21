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
  const [loginErrors, setLoginErrors] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/console";

  const onFinish = async (values: {token: string}) => {
    setLoginErrors([]);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (response.ok) {
        router.push(from);
      } else {
        setLoginErrors([data.message || "验证码错误"]);
      }
    } catch (error) {
      setLoginErrors(["登录请求失败，请检查网络连接"]);
    } finally {
      setLoading(false);
    }
  };

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