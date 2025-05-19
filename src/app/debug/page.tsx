"use client";

import { useState, useEffect } from "react";
import { Card, Button, Descriptions, Spin, Alert, Badge, Input, Form, message } from "antd";
import { ReloadOutlined, KeyOutlined } from "@ant-design/icons";

interface TotpInfo {
  secretLength: number;
  secretFirstChars: string;
  currentToken: string;
  totpToken: string;
  tokensMatch: boolean;
  isBase32: boolean;
  remainingSeconds: number;
  digits: number;
  step: number;
  timeSync: {
    isSynced: boolean;
    offset: number;
  };
  isAuthenticated: boolean;
}

export default function DebugPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totpInfo, setTotpInfo] = useState<TotpInfo | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [verifyLoading, setVerifyLoading] = useState(false);
  
  // 获取TOTP调试信息
  const fetchTotpInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/debug/totp', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "获取TOTP信息失败");
      }
      
      const data = await response.json();
      
      if (data.success && data.totpInfo) {
        setTotpInfo(data.totpInfo);
        setCountdown(data.totpInfo.remainingSeconds);
      } else {
        throw new Error(data.message || "获取TOTP信息失败");
      }
    } catch (error) {
      console.error("获取TOTP信息错误:", error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };
  
  // 验证手动输入的验证码
  const verifyToken = async (values: { token: string }) => {
    setVerifyLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        message.success("验证成功，已登录");
        // 刷新页面以更新认证状态
        window.location.reload();
      } else {
        message.error(data.message || "验证失败");
      }
    } catch (error) {
      console.error("验证错误:", error);
      message.error("验证请求失败");
    } finally {
      setVerifyLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchTotpInfo();
  }, []);
  
  // 倒计时效果
  useEffect(() => {
    if (countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // 自动刷新令牌信息
          fetchTotpInfo();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown]);
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Card
        title="TOTP 调试信息"
        extra={
          <Button 
            icon={<ReloadOutlined />}
            onClick={fetchTotpInfo}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" tip="正在获取TOTP信息..." />
          </div>
        ) : error ? (
          <Alert
            type="error"
            message="获取TOTP信息失败"
            description={error}
            showIcon
          />
        ) : totpInfo ? (
          <>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="认证状态">
                {totpInfo.isAuthenticated ? (
                  <Badge status="success" text="已登录" />
                ) : (
                  <Badge status="error" text="未登录" />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="密钥长度">{totpInfo.secretLength}</Descriptions.Item>
              <Descriptions.Item label="密钥开头">{totpInfo.secretFirstChars}</Descriptions.Item>
              <Descriptions.Item label="是否为Base32编码">
                {totpInfo.isBase32 ? (
                  <Badge status="success" text="是" />
                ) : (
                  <Badge status="error" text="否" />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="位数">{totpInfo.digits}</Descriptions.Item>
              <Descriptions.Item label="时间步长">{totpInfo.step}秒</Descriptions.Item>
              <Descriptions.Item label="当前验证码">
                <span className="font-mono text-xl font-bold">{totpInfo.currentToken}</span>
                <span className="ml-2 text-gray-500">
                  ({countdown}秒后刷新)
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="时间同步状态">
                {totpInfo.timeSync.isSynced ? (
                  <Badge status="success" text={`同步良好 (偏差: ${totpInfo.timeSync.offset}秒)`} />
                ) : (
                  <Badge status="warning" text={`同步偏差较大 (${totpInfo.timeSync.offset}秒)`} />
                )}
              </Descriptions.Item>
            </Descriptions>
            
            <div className="mt-8">
              <Card title="手动验证" size="small">
                <Form
                  layout="inline"
                  onFinish={verifyToken}
                >
                  <Form.Item
                    name="token"
                    rules={[
                      { required: true, message: "请输入验证码" },
                      { len: 6, message: "验证码必须为6位" }
                    ]}
                  >
                    <Input 
                      prefix={<KeyOutlined />}
                      placeholder="输入6位验证码"
                      maxLength={6}
                    />
                  </Form.Item>
                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit"
                      loading={verifyLoading}
                    >
                      验证
                    </Button>
                  </Form.Item>
                </Form>
              </Card>
            </div>
            
            <div className="mt-8">
              <Alert
                message="调试说明"
                description={
                  <ul className="list-disc pl-5">
                    <li>上方显示了当前的TOTP配置信息和生成的验证码</li>
                    <li>您可以使用当前验证码进行手动验证</li>
                    <li>验证码每30秒更新一次，倒计时结束后将自动刷新</li>
                    <li>验证成功后，认证状态将更新为"已登录"</li>
                  </ul>
                }
                type="info"
                showIcon
              />
            </div>
          </>
        ) : (
          <Alert
            type="warning"
            message="未获取到TOTP信息"
            description="请检查服务器配置和环境变量"
            showIcon
          />
        )}
      </Card>
    </div>
  );
} 