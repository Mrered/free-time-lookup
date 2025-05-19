import { useRef, useState } from "react";
import { Button } from "antd";

interface UploadPanelProps {
  uploading: boolean;
  message: string;
  isTest: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

export default function UploadPanel({ uploading, message, isTest, onFileChange, onClear }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-full flex flex-col items-center gap-6">
      <h1 className="text-3xl font-bold mb-2 text-blue-700">Excel 数据上传</h1>
      <p className="text-gray-600 text-center mb-2">请选择一个 Excel 文件（.xlsx/.xls），上传后将自动写入 Redis KV 数据库。</p>
      <label className="w-full flex flex-col items-center cursor-pointer">
        <span className="mb-2 text-lg font-medium text-gray-700">选择 Excel 文件</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          ref={fileInputRef}
          onChange={onFileChange}
          disabled={uploading}
          className="hidden"
        />
        <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow mt-2 transition-all duration-150">
          {uploading ? "上传中..." : "点击上传"}
        </span>
      </label>
      {isTest && (
        <Button
          onClick={onClear}
          loading={uploading}
          danger
          type="primary"
          className="w-full"
        >
          清空数据库（仅测试环境可见）
        </Button>
      )}
      {message && <div className="w-full text-center text-blue-600 font-medium mt-2">{message}</div>}
      <div className="w-full mt-4 text-xs text-gray-400 text-center">
        <p>如需清空所有数据，请点击下方红色按钮（仅测试环境可见）。</p>
      </div>
    </div>
  );
} 