"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Input, Button, message, Tabs, Upload, Avatar } from "antd";
import { UserOutlined, LockOutlined, UploadOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";

interface UserProfileModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
}

interface UserData {
  username: string;
  displayName: string;
  avatar: string | null;
}

export default function UserProfileModal({ open, onCancel, onSuccess }: UserProfileModalProps) {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  
  // 获取用户信息
  const fetchUserData = async () => {
    try {
      const res = await fetch("/api/auth/user", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUserData(data.user);
          setAvatarUrl(data.user.avatar);
          
          // 设置表单初始值
          profileForm.setFieldsValue({
            username: data.user.username,
            displayName: data.user.displayName || data.user.username
          });
        }
      }
    } catch (error) {
      console.error("获取用户信息失败:", error);
      message.error("获取用户信息失败");
    }
  };
  
  // 组件挂载时获取用户信息
  useEffect(() => {
    if (open) {
      fetchUserData();
      // 重置表单
      profileForm.resetFields();
      passwordForm.resetFields();
      setFileList([]);
    }
  }, [open, profileForm, passwordForm]);
  
  // 更新个人信息
  const handleUpdateProfile = async (values: any) => {
    setLoading(true);
    try {
      const updateData = {
        displayName: values.displayName,
        avatar: avatarUrl
      };
      
      const res = await fetch("/api/auth/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        message.success("个人信息已更新");
        if (onSuccess) onSuccess();
      } else {
        message.error(result.message || "更新失败");
      }
    } catch (error) {
      console.error("更新个人信息失败:", error);
      message.error("更新个人信息失败");
    } finally {
      setLoading(false);
    }
  };
  
  // 更新密码
  const handleUpdatePassword = async (values: any) => {
    setLoading(true);
    try {
      const updateData = {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      };
      
      const res = await fetch("/api/auth/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        message.success("密码已更新");
        passwordForm.resetFields();
        if (onSuccess) onSuccess();
      } else {
        message.error(result.message || "更新密码失败");
      }
    } catch (error) {
      console.error("更新密码失败:", error);
      message.error("更新密码失败");
    } finally {
      setLoading(false);
    }
  };
  
  // 处理头像上传
  const handleAvatarChange = (info: any) => {
    if (info.file.status === 'uploading') {
      return;
    }
    
    if (info.file.status === 'done') {
      // 获取Base64格式的图片数据
      getBase64(info.file.originFileObj, (url: string) => {
        setAvatarUrl(url);
        setFileList([info.file]);
      });
    }
  };
  
  // 将File对象转换为Base64字符串
  const getBase64 = (file: File, callback: (url: string) => void) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => callback(reader.result as string));
    reader.readAsDataURL(file);
  };
  
  // 上传前处理
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件!');
    }
    
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片必须小于2MB!');
    }
    
    // 直接在客户端处理图片，不实际上传到服务器
    if (isImage && isLt2M) {
      getBase64(file, (url: string) => {
        setAvatarUrl(url);
        setFileList([{
          uid: '-1',
          name: file.name,
          status: 'done',
          url: url,
        }]);
      });
    }
    
    // 阻止默认上传行为
    return false;
  };
  
  // 自定义上传按钮
  const uploadButton = (
    <div>
      <UploadOutlined />
      <div style={{ marginTop: 8 }}>上传头像</div>
    </div>
  );
  
  const tabItems = [
    {
      key: "profile",
      label: "个人信息",
      children: (
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
        >
          <div className="flex justify-center mb-6">
            <Upload
              name="avatar"
              listType="picture-circle"
              className="avatar-uploader"
              showUploadList={false}
              beforeUpload={beforeUpload}
              onChange={handleAvatarChange}
              fileList={fileList}
            >
              {avatarUrl ? (
                <Avatar 
                  src={avatarUrl} 
                  size={80}
                  alt="头像" 
                />
              ) : (
                uploadButton
              )}
            </Upload>
          </div>
          
          <Form.Item
            name="username"
            label="用户名"
          >
            <Input disabled prefix={<UserOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[
              { required: true, message: "请输入显示名称" },
              { min: 2, message: "名称至少2个字符" }
            ]}
          >
            <Input placeholder="请输入显示名称" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              保存信息
            </Button>
          </Form.Item>
        </Form>
      )
    },
    {
      key: "password",
      label: "修改密码",
      children: (
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleUpdatePassword}
        >
          <Form.Item
            name="currentPassword"
            label="当前密码"
            rules={[
              { required: true, message: "请输入当前密码" }
            ]}
          >
            <Input.Password placeholder="请输入当前密码" prefix={<LockOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少6个字符" }
            ]}
          >
            <Input.Password placeholder="请输入新密码" prefix={<LockOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" prefix={<LockOutlined />} />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              更新密码
            </Button>
          </Form.Item>
        </Form>
      )
    }
  ];
  
  return (
    <Modal
      title="用户设置"
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={400}
    >
      <Tabs
        defaultActiveKey="profile"
        items={tabItems}
      />
    </Modal>
  );
} 