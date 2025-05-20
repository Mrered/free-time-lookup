import { useRef } from "react";
import { Button } from "antd";
import { ReactNode } from "react";

interface UploadPanelProps {
  uploading: boolean;
  message: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  historyButtons?: ReactNode;
}

export default function UploadPanel({ uploading, message, onFileChange, onClear, historyButtons }: UploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="w-full flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold text-blue-700">Excel 数据上传</h1>
        {historyButtons && (
          <div className="flex items-center">
            {historyButtons}
          </div>
        )}
      </div>
      <p className="text-gray-600 text-center mb-2">请选择一个 Excel 文件（.xlsx/.xls），上传后将自动写入数据库。</p>
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
      {message && <div className="w-full text-center text-blue-600 font-medium mt-2">{message}</div>}
    </div>
  );
} 