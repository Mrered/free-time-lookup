"use client";

import { useState, useEffect, Suspense } from "react";
import { Button, Dropdown, message, Avatar, Spin } from "antd";
import { UserOutlined, LogoutOutlined, SettingOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import UserProfileModal from "./UserProfileModal";

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

interface UserData {
  username: string;
  displayName: string;
  avatar: string | null;
}

// 带有useSearchParams的内部组件
function UserMenuContent() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTestMode = searchParams.get("test_auth") === "1";

  // 获取用户信息
  const fetchUserData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/user", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUserData(data.user);
        }
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 检查是否本地主机访问
    const hostname = window.location.hostname;
    setIsLocalhost(hostname === "localhost" || hostname === "127.0.0.1");
    
    // 检查登录状态
    const hasToken = !!getAuthToken();
    setIsLoggedIn(hasToken);
    
    // 如果已登录，获取用户信息
    if (hasToken) {
      fetchUserData();
    }
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
        setUserData(null);
        
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

  // 打开用户配置模态框
  const openProfileModal = () => {
    setProfileModalOpen(true);
  };

  // 关闭用户配置模态框
  const closeProfileModal = () => {
    setProfileModalOpen(false);
  };

  // 用户信息更新成功回调
  const handleProfileUpdateSuccess = () => {
    fetchUserData();
  };

  // 如果是本地访问且不是测试模式，显示本地访问提示
  if (isLocalhost && !isTestMode) {
    return (
      <div className="flex items-center">
        <span className="mr-2 text-sm text-gray-500">本地访问模式</span>
      </div>
    );
  }

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

  // 加载中状态
  if (loading && !userData) {
    return <Spin size="small" />;
  }

  return (
    <>
      <Dropdown
        menu={{
          items: [
            {
              key: "profile",
              label: "用户设置",
              icon: <SettingOutlined />,
              onClick: openProfileModal,
            },
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
            src={userData?.avatar} 
            size="small" 
            className="mr-2" 
          />
          <span className="text-sm">
            {userData?.displayName || userData?.username || "管理员"}
            {isTestMode && <span className="text-xs text-yellow-500 ml-1">[测试]</span>}
          </span>
        </div>
      </Dropdown>

      {/* 用户配置模态框 */}
      <UserProfileModal 
        open={profileModalOpen} 
        onCancel={closeProfileModal} 
        onSuccess={handleProfileUpdateSuccess}
      />
    </>
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