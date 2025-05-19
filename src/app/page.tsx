"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Layout, Menu, message as antdMessage, Modal, Form, Input, Switch, Select, Button as AntdButton } from "antd";
import UploadPanel from "./components/UploadPanel";
import ManagePanel from "./components/ManagePanel";
import { MenuOutlined } from "@ant-design/icons";
import { Drawer } from "antd";

const { Sider, Content } = Layout;

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

// 需要识别的时间段列名
const TIME_BLOCKS = [
  "7:30-13:00",
  "14:00-19:00",
  "8:30-12:00",
  "14:00-17:30"
];

const WEEKDAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const WEEK_TYPES = [true, false]; // true: 单周, false: 双周

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
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
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

  // 新增操作
  const handleAdd = () => {
    setAddModalOpen(true);
  };
  const handleAddCancel = () => {
    setAddModalOpen(false);
  };

  // 编辑操作
  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setEditRow(data[idx]);
    setEditModalOpen(true);
  };
  const handleEditCancel = () => {
    setEditModalOpen(false);
    setEditRow(null);
    setEditIdx(null);
    editForm.resetFields();
  };

  // 编辑弹窗表单
  const [weekPeriod, setWeekPeriod] = useState<number[][]>([]); // [[weekday, period], ...]
  const [weekTypeTimeBlock, setWeekTypeTimeBlock] = useState<[boolean, string][]>([]); // [[weekType, timeBlock], ...]

  useEffect(() => {
    if (editModalOpen && editRow) {
      console.log('[EditModal] 打开，editRow:', editRow);
      const setFields = {
        ...editRow,
        weekday: editRow.isTheory
          ? (typeof editRow.weekday === 'number' && editRow.weekday > 0 ? editRow.weekday : '')
          : undefined,
        periods: editRow.isTheory
          ? (Array.isArray(editRow.periods) && editRow.periods.length > 0 ? editRow.periods.map(Number) : [])
          : undefined,
        weekType: !editRow.isTheory ? editRow.weekType : undefined,
        timeBlocks: !editRow.isTheory ? editRow.timeBlocks : undefined,
      };
      console.log('[EditModal] setFieldsValue:', setFields);
      editForm.setFieldsValue(setFields);
    }
  }, [editModalOpen, editRow]);

  // 理论/实训切换时清空互斥数据
  const handleTheorySwitch = (checked: boolean) => {
    form.setFieldValue('isTheory', checked);
    if (checked) {
      setWeekTypeTimeBlock([]);
      form.setFieldValue('weekType', null);
      form.setFieldValue('timeBlocks', []);
    } else {
      setWeekPeriod([]);
      form.setFieldValue('weekday', 0);
      form.setFieldValue('periods', []);
    }
  };

  // 1. 理论：星期×节次二维表格
  function WeekPeriodTable({ value = [], onChange }: { value?: number[][], onChange?: (val: number[][]) => void }) {
    const selected = new Set((value || []).map(([w, p]) => `${w}-${p}`));
    const handleCellClick = (w: number, p: number) => {
      const key = `${w}-${p}`;
      let arr = value ? [...value] : [];
      if (selected.has(key)) {
        arr = arr.filter(([ww, pp]) => !(ww === w && pp === p));
      } else {
        arr.push([w, p]);
      }
      onChange?.(arr);
    };
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="border text-center" style={{ minWidth: 400, width: '100%' }}>
          <thead>
            <tr>
              <th></th>
              {WEEKDAYS.map(w => <th key={w}>周{['一','二','三','四','五'][w-1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map(p => (
              <tr key={p}>
                <td className="font-bold">{p}节</td>
                {WEEKDAYS.map(w => {
                  const checked = selected.has(`${w}-${p}`);
                  return (
                    <td key={w}>
                      <button
                        type="button"
                        className={`w-7 h-7 rounded ${checked ? 'bg-blue-500 text-white' : 'bg-gray-100'} border border-blue-200 focus:outline-none`}
                        onClick={() => handleCellClick(w, p)}
                      >
                        {checked ? '✔' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 2. 实训：单双周×时间段二维表格
  function WeekTypeTimeBlockTable({ value = [], onChange }: { value?: [boolean, string][], onChange?: (val: [boolean, string][]) => void }) {
    const selected = new Set((value || []).map(([w, t]) => `${w}-${t}`));
    const handleCellClick = (w: boolean, t: string) => {
      const key = `${w}-${t}`;
      let arr = value ? [...value] : [];
      if (selected.has(key)) {
        arr = arr.filter(([ww, tt]) => !(ww === w && tt === t));
      } else {
        arr.push([w, t]);
      }
      onChange?.(arr);
    };
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="border text-center" style={{ minWidth: 400, width: '100%' }}>
          <thead>
            <tr>
              <th></th>
              {TIME_BLOCKS.map(tb => <th key={tb}>{tb}</th>)}
            </tr>
          </thead>
          <tbody>
            {WEEK_TYPES.map(wt => (
              <tr key={wt ? '单周' : '双周'}>
                <td className="font-bold">{wt ? '单周' : '双周'}</td>
                {TIME_BLOCKS.map(tb => {
                  const checked = selected.has(`${wt}-${tb}`);
                  return (
                    <td key={tb}>
                      <button
                        type="button"
                        className={`w-16 h-7 rounded ${checked ? 'bg-blue-500 text-white' : 'bg-gray-100'} border border-blue-200 focus:outline-none`}
                        onClick={() => handleCellClick(wt, tb)}
                      >
                        {checked ? '✔' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // 编辑保存（单条）
  const handleEditSaveSingle = async () => {
    try {
      const values = await editForm.validateFields();
      if (editIdx === null) return;
      let newRow: DataRow = { ...data[editIdx], ...values };
      if (values.isTheory) {
        newRow.weekType = null;
        newRow.timeBlocks = [];
      } else {
        newRow.weekday = 0;
        newRow.periods = [];
      }
      const newData = [...data];
      newData[editIdx] = newRow;
      setData(newData);
      setEditModalOpen(false);
      setEditRow(null);
      setEditIdx(null);
      await fetch(`${apiUrl}/api/upload-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "excel_data", value: newData }),
      });
      antdMessage.success("修改成功");
      fetchData();
    } catch (err) {
      antdMessage.error("保存失败");
    }
  };

  // 保存时拆分多条数据写入
  const handleEditSaveWithCustom = async () => {
    try {
      const values = await form.validateFields();
      if (addModalOpen) {
        // 新增操作：每个"星期+节次"组合生成一条数据
        let newRows: DataRow[] = [];
        for (const [weekday, period] of weekPeriod) {
          newRows.push({
            ...values,
            weekday,
            periods: [period],
            weekType: null,
            timeBlocks: [],
          });
        }
        // 替换原有一条为多条
        const newData = [...data, ...newRows];
        setData(newData);
        setAddModalOpen(false);
        await fetch(`${apiUrl}/api/upload-excel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "excel_data", value: newData }),
        });
        antdMessage.success("新增成功");
        fetchData();
      } else if (editIdx !== null) {
        // 编辑操作：每个"星期+节次"组合生成一条数据
        let newRows: DataRow[] = [];
        for (const [weekday, period] of weekPeriod) {
          newRows.push({
            ...data[editIdx],
            ...values,
            weekday,
            periods: [period],
            weekType: null,
            timeBlocks: [],
          });
        }
        // 替换原有一条为多条
        const newData = [...data];
        newData.splice(editIdx, 1, ...newRows);
        setData(newData);
        setEditModalOpen(false);
        setEditRow(null);
        setEditIdx(null);
        await fetch(`${apiUrl}/api/upload-excel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "excel_data", value: newData }),
        });
        antdMessage.success("修改成功");
        fetchData();
      }
    } catch (err) {
      antdMessage.error("保存失败");
    }
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
                  editModalOpen={editModalOpen}
                  editRow={editRow}
                  onEditModalClose={handleEditCancel}
                  onEditSave={handleEditSaveWithCustom}
                  form={form}
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
                  editModalOpen={editModalOpen}
                  editRow={editRow}
                  onEditModalClose={handleEditCancel}
                  onEditSave={handleEditSaveWithCustom}
                  form={form}
                />
              )}
            </div>
          )}
        </Content>
      </Layout>
      <Modal open={addModalOpen} onCancel={handleAddCancel} onOk={handleEditSaveWithCustom} title="批量新增数据" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}> <Input autoComplete="off" /> </Form.Item>
          <Form.Item name="class" label="班级" rules={[{ required: true, message: '请输入班级' }]}> <Input autoComplete="off" /> </Form.Item>
          <Form.Item name="isTheory" label="理论/实训" valuePropName="checked">
            <Switch checkedChildren="理论" unCheckedChildren="实训" onChange={handleTheorySwitch} />
          </Form.Item>
          {form.getFieldValue('isTheory') ? (
            <Form.Item label="星期+节次">
              <WeekPeriodTable value={weekPeriod} onChange={setWeekPeriod} />
            </Form.Item>
          ) : (
            <Form.Item label="单双周+时间段">
              <WeekTypeTimeBlockTable value={weekTypeTimeBlock} onChange={setWeekTypeTimeBlock} />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal open={editModalOpen} onCancel={handleEditCancel} onOk={handleEditSaveSingle} title="编辑数据" destroyOnHidden>
        <EditSingleForm editForm={editForm} editRow={editRow} />
      </Modal>
    </Layout>
  );
}

// 编辑弹窗表单控件
function EditSingleForm({ editForm, editRow }: { editForm: any, editRow: DataRow | null }) {
  if (!editRow) return null;
  const isTheory = editRow.isTheory;
  return (
    <Form form={editForm} layout="vertical">
      <Form.Item name="name" label="姓名">
        <Input autoComplete="off" disabled />
      </Form.Item>
      <Form.Item name="class" label="班级">
        <Input autoComplete="off" disabled />
      </Form.Item>
      <Form.Item label="类型">
        <Input value={isTheory ? '理论' : '实训'} disabled />
      </Form.Item>
      {isTheory && (
        <Form.Item name="weekday" label={<label htmlFor="edit-weekday">星期</label>} rules={[{ required: true, message: '请选择星期' }]}> 
          <Select id="edit-weekday">{WEEKDAYS.map(w => (<Select.Option key={w} value={w}>周{['一','二','三','四','五'][w-1]}</Select.Option>))}</Select> 
        </Form.Item>
      )}
      {isTheory && (
        <Form.Item name="periods" label={<label htmlFor="edit-periods">节次</label>} rules={[{ required: true, message: '请选择节次' }]}> 
          <Select id="edit-periods" mode="multiple">{PERIODS.map(p => (<Select.Option key={p} value={p}>{p}节</Select.Option>))}</Select> 
        </Form.Item>
      )}
      {!isTheory && (
        <Form.Item name="weekType" label="单双周">
          <Switch checkedChildren="单周" unCheckedChildren="双周" disabled />
        </Form.Item>
      )}
      {!isTheory && (
        <Form.Item name="timeBlocks" label="时间段" rules={[{ required: true, message: '请选择时间段' }]}> <Select mode="multiple">{TIME_BLOCKS.map(tb => (<Select.Option key={tb} value={tb}>{tb}</Select.Option>))}</Select> </Form.Item>
      )}
    </Form>
  );
}
