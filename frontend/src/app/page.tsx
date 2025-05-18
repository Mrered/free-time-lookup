"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Layout, Menu, message as antdMessage } from "antd";
import UploadPanel from "./components/UploadPanel";
import ManagePanel from "./components/ManagePanel";
import { MenuOutlined } from "@ant-design/icons";
import { Drawer, Button as AntdButton } from "antd";

const { Sider, Content } = Layout;

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
  const [selectedKey, setSelectedKey] = useState("upload");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isTest = process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "preview" || process.env.NODE_ENV === "development";

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 获取数据库内容
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" });
      const result = await res.json();
      console.log("fetchData result:", result);
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
    fetchData();
  }, []);

  // 上传处理
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
      fetchData();
    } catch (err) {
      setMessage("上传失败: " + (err as any).message);
      antdMessage.error("上传失败");
    } finally {
      setUploading(false);
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
      fetchData();
    } catch (err) {
      setMessage("清空失败: " + (err as any).message);
      antdMessage.error("清空失败");
    } finally {
      setUploading(false);
    }
  };

  // 删除操作
  const handleDelete = async (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    await fetch(`${apiUrl}/api/upload-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "excel_data", value: newData }),
    });
    antdMessage.success("删除成功");
    fetchData();
  };

  // 编辑操作（待实现）
  const handleEdit = (idx: number) => {
    antdMessage.info("编辑功能待实现");
  };

  // 新增操作（待实现）
  const handleAdd = () => {
    antdMessage.info("新增功能待实现");
  };

  // 恢复备份
  const handleRestoreBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/restore-backup`, { method: "POST" });
      const result = await res.json();
      if (res.ok) {
        antdMessage.success(result.message || "恢复成功");
        fetchData();
      } else {
        antdMessage.error(result.message || "恢复失败");
      }
    } catch (err) {
      antdMessage.error("恢复失败");
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { key: "upload", label: "数据上传" },
    { key: "manage", label: "数据管理" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isNarrow && (
        <Sider width={200} style={{ background: "#fff", boxShadow: "2px 0 8px #f0f1f2" }}>
          <div className="text-2xl font-bold text-center py-6 text-blue-700 tracking-wide select-none">控制台</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={e => setSelectedKey(e.key as string)}
            items={menuItems}
            style={{ height: "100%", borderRight: 0, fontSize: 16 }}
          />
        </Sider>
      )}
      {isNarrow && (
        <>
          <AntdButton
            type="primary"
            shape="circle"
            icon={<MenuOutlined />}
            size="large"
            style={{ position: "fixed", left: 24, bottom: 24, zIndex: 1100, boxShadow: "0 2px 8px #ccc" }}
            onClick={() => setDrawerOpen(true)}
          />
          <Drawer
            placement="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            bodyStyle={{ padding: 0 }}
            width={220}
            style={{ zIndex: 1200 }}
          >
            <div className="text-2xl font-bold text-center py-6 text-blue-700 tracking-wide select-none">控制台</div>
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              onClick={e => {
                setSelectedKey(e.key as string);
                setDrawerOpen(false);
              }}
              items={menuItems}
              style={{ height: "100%", borderRight: 0, fontSize: 16 }}
            />
          </Drawer>
        </>
      )}
      <Layout>
        <Content style={{ margin: 32, background: "#f8fafc", borderRadius: 16, boxShadow: "0 2px 16px #e6e6e6", minHeight: 600, padding: 32 }}>
          {isNarrow ? (
            <>
              {selectedKey === "upload" && (
                <UploadPanel
                  uploading={uploading}
                  message={message}
                  isTest={isTest}
                  onFileChange={handleFileChange}
                  onClear={handleClear}
                />
              )}
              {selectedKey === "manage" && (
                <ManagePanel
                  data={data}
                  loading={loading}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e6e6e6', padding: 32, minHeight: 500 }}>
              {selectedKey === "upload" && (
                <UploadPanel
                  uploading={uploading}
                  message={message}
                  isTest={isTest}
                  onFileChange={handleFileChange}
                  onClear={handleClear}
                />
              )}
              {selectedKey === "manage" && (
                <ManagePanel
                  data={data}
                  loading={loading}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
