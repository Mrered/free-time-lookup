"use client";

import { Suspense } from "react";
import { Button, Popconfirm, message, Spin } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

// 带有useSearchParams的内部组件
function UserMenuContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTestMode = searchParams.get("test_auth") === "1";

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        message.success("已退出登录");
        
        // 重定向到登录页面，保留测试模式参数
        const loginPath = isTestMode ? "/login?test_auth=1" : "/login";
        router.push(loginPath);
      } else {
        message.error("退出登录失败");
      }
    } catch (error) {
      console.error("退出登录出错:", error);
      message.error("退出登录时发生错误");
    }
  };

  return (
    <Popconfirm
      title="确认退出登录"
      description="您确定要退出登录吗？"
      onConfirm={handleLogout}
      okText="确认"
      cancelText="取消"
      placement="top"
    >
      <Button 
        type="primary" 
        icon={<LogoutOutlined />}
        danger
        size="large"
        block
        style={{
          height: "46px",
          fontSize: "16px",
          boxShadow: "0 2px 8px rgba(255, 0, 0, 0.2)",
          borderColor: "#ff4d4f"
        }}
      >
        安全退出
      </Button>
    </Popconfirm>
  );
}

// 导出带有Suspense的组件
export default function UserMenu() {
  return (
    <Suspense fallback={<Spin size="small" />}>
      <UserMenuContent />
    </Suspense>
  );
} 