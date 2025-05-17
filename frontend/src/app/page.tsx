"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Image from "next/image";
import { Tabs, Table, Button, Popconfirm, message as antdMessage } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

// 需要识别的时间段列名
const TIME_BLOCKS = [
  "7:30-13:00",
  "14:00-19:00",
  "8:30-12:00",
  "14:00-17:30"
];

interface DataRow {
  name: string;
  class: string;
  weekday: number;
  isTheory: boolean;
  periods: number[];
  weekType: boolean | null;
  timeBlocks: string[];
}

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTest = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";
  const [tabKey, setTabKey] = useState("upload");
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取数据库内容
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" });
      const result = await res.json();
      if (Array.isArray(result.value)) {
        setData(result.value);
      } else if (typeof result.value === "string") {
        setData(JSON.parse(result.value));
      } else {
        setData([]);
      }
    } catch (err) {
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tabKey === "manage") {
      fetchData();
    }
  }, [tabKey]);

  // 处理Excel上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows: any[][] = allRows.slice(2);
      const idxName = 0;
      const idxClass = 1;
      const idxWeekday = 2;
      const idxTheory = 3;
      const idxWeekType = 12;
      const periodIdxs = [4,5,6,7,8,9,10,11];
      const timeBlockIdxs = [13,14,15,16];

      const json = rows.filter(row => row.length > 0 && row[idxName]).map((row: any[]) => {
        const isTheory = !!row[idxTheory];
        const periods = isTheory ? periodIdxs.map((i, idx) => row[i] ? idx+1 : null).filter(v => v !== null) : [];
        let weekType = null;
        if (!isTheory) {
          if (row[idxWeekType] === 1 || row[idxWeekType] === "1") weekType = true;
          else if (row[idxWeekType] === 0 || row[idxWeekType] === "0") weekType = false;
        }
        const timeBlocks = timeBlockIdxs.map((i, idx) => row[i] ? TIME_BLOCKS[idx] : null).filter(Boolean);
        return {
          name: row[idxName],
          class: row[idxClass],
          weekday: Number(row[idxWeekday]),
          isTheory,
          periods,
          weekType,
          timeBlocks
        };
      });
      const res = await fetch(`${apiUrl}/api/upload-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "excel_data", value: json }),
      });
      const result = await res.json();
      setMessage(result.message || "上传成功");
      antdMessage.success("上传成功");
    } catch (err) {
      setMessage("上传失败: " + (err as any).message);
      antdMessage.error("上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 清空数据库
  const handleClear = async () => {
    setUploading(true);
    setMessage("");
    try {
      const res = await fetch(`${apiUrl}/api/clear-kv`, { method: "POST" });
      const result = await res.json();
      setMessage(result.message || "已清空");
      antdMessage.success("已清空");
      if (tabKey === "manage") fetchData();
    } catch (err) {
      setMessage("清空失败: " + (err as any).message);
      antdMessage.error("清空失败");
    } finally {
      setUploading(false);
    }
  };

  // 表格列定义
  const columns: ColumnsType<DataRow> = [
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "班级", dataIndex: "class", key: "class" },
    { title: "星期", dataIndex: "weekday", key: "weekday" },
    { title: "理论/实训", dataIndex: "isTheory", key: "isTheory", render: v => v ? "理论" : "实训" },
    { title: "节次", dataIndex: "periods", key: "periods", render: v => v && v.length ? v.join(",") : "-" },
    { title: "单双周", dataIndex: "weekType", key: "weekType", render: v => v === null ? "-" : (v ? "单周" : "双周") },
    { title: "时间段", dataIndex: "timeBlocks", key: "timeBlocks", render: v => v && v.length ? v.join(",") : "-" },
    {
      title: "操作",
      key: "action",
      render: (_, record, idx) => (
        <span>
          <Button icon={<EditOutlined />} size="small" style={{ marginRight: 8 }} disabled>编辑</Button>
          <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => handleDelete(idx)} okText="确定" cancelText="取消">
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </span>
      )
    }
  ];

  // 删除操作
  const handleDelete = async (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    // 更新到数据库
    await fetch(`${apiUrl}/api/upload-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "excel_data", value: newData }),
    });
    antdMessage.success("删除成功");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 gap-8 bg-gray-50">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-8 flex flex-col items-center gap-6 border border-gray-200">
        <Tabs
          activeKey={tabKey}
          onChange={setTabKey}
          items={[
            {
              key: "upload",
              label: "数据上传",
              children: (
                <div className="w-full flex flex-col items-center gap-6">
                  <h1 className="text-3xl font-bold mb-2 text-blue-700">Excel 数据上传</h1>
                  <p className="text-gray-600 text-center mb-2">请选择一个 Excel 文件（.xlsx/.xls），上传后将自动写入 Redis KV 数据库。</p>
                  <label className="w-full flex flex-col items-center cursor-pointer">
                    <span className="mb-2 text-lg font-medium text-gray-700">选择 Excel 文件</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="hidden"
                    />
                    <span className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow mt-2 transition-all duration-150">
                      {uploading ? "上传中..." : "点击上传"}
                    </span>
                  </label>
                  {isTest && (
                    <Button
                      onClick={handleClear}
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
              )
            },
            {
              key: "manage",
              label: "数据管理",
              children: (
                <div className="w-full">
                  <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} disabled>新增（待实现）</Button>
                  <Table
                    columns={columns}
                    dataSource={data}
                    rowKey={(_, idx) => String(idx)}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
