"use client";

import { useState, useEffect, Suspense } from "react";
import { Button, Dropdown, message, Avatar, Spin } from "antd";
import { UserOutlined, LogoutOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";

// 从cookie中读取token
function getAuthToken() {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "auth-token") {
      return value;
    }
  }
  return null;
}

// 带有useSearchParams的内部组件
function UserMenuContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTestMode = searchParams.get("test_auth") === "1";

  useEffect(() => {
    // 检查登录状态
    const hasToken = !!getAuthToken();
    setIsLoggedIn(hasToken);
  }, []);

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
        setIsLoggedIn(false);
        
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

  // 如果是测试模式但未登录，显示测试模式提示
  if (isTestMode && !isLoggedIn) {
    return (
      <div className="flex items-center">
        <span className="mr-2 text-sm text-yellow-500">测试模式</span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null; // 未登录状态下不显示
  }

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: "logout",
            label: "退出登录",
            icon: <LogoutOutlined />,
            onClick: handleLogout,
          },
        ],
      }}
    >
      <div className="flex items-center cursor-pointer hover:opacity-80">
        <Avatar 
          icon={<UserOutlined />}
          size="small" 
          className="mr-2" 
        />
        <span className="text-sm">
          管理员
          {isTestMode && <span className="text-xs text-yellow-500 ml-1">[测试]</span>}
        </span>
      </div>
    </Dropdown>
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