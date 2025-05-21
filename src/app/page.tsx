"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Layout, Menu, message as antdMessage, Modal, Form, Input, Switch, Select, Button as AntdButton } from "antd";
import UploadPanel from "./components/UploadPanel";
import ManagePanel from "./components/ManagePanel"; // 确保路径正确
import UserMenu from "./components/UserMenu";     // 确保路径正确
import { MenuOutlined, UndoOutlined, RedoOutlined, DownloadOutlined } from "@ant-design/icons";
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

// 时间段代码映射 - 用于解决格式和键冲突问题
const TIME_BLOCK_CODES: Record<string, string> = {
  "A1": "7:30-13:00",
  "A2": "14:00-19:00",
  "B1": "8:30-12:00",
  "B2": "14:00-17:30"
};

// 反向映射表 - 从完整时间段到代码
const TIME_BLOCK_REVERSE_MAP = Object.entries(TIME_BLOCK_CODES).reduce(
  (acc, [code, timeBlock]) => {
    acc[timeBlock] = code;
    return acc;
  },
  {} as Record<string, string>
);

// 从代码获取完整时间段
const getFullTimeBlock = (code: string): string => {
  return TIME_BLOCK_CODES[code as keyof typeof TIME_BLOCK_CODES] || "";
};

// 从完整时间段获取代码
const getTimeBlockCode = (timeBlock: string): string => {
  if (TIME_BLOCK_REVERSE_MAP[timeBlock]) {
    return TIME_BLOCK_REVERSE_MAP[timeBlock];
  }
  for (const [fullTimeBlock, code] of Object.entries(TIME_BLOCK_REVERSE_MAP)) {
    if (fullTimeBlock.startsWith(timeBlock)) {
      return code;
    }
  }
  return "";
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
// const WEEK_TYPES = [true, false]; // true: 单周, false: 双周 // (未使用，可移除)

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
  const [history, setHistory] = useState<DataRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false); // 页面级别的加载状态
  const [isNarrow, setIsNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const handleResize = () => {
      setIsNarrow(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 添加历史记录的助手函数
  const addHistory = (newData: DataRow[]) => {
    const dataCopy = JSON.parse(JSON.stringify(newData)); // 深拷贝
    const newHistory = history.slice(0, historyIndex + 1); // 如果在历史中间，则裁剪
    newHistory.push(dataCopy);
    if (newHistory.length > 100) { // 限制历史数量
      newHistory.shift();
    }
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    try { // 保存到 sessionStorage
      sessionStorage.setItem('temp_history', JSON.stringify(newHistory));
      sessionStorage.setItem('temp_history_index', String(newHistory.length - 1));
    } catch (e) {
      console.error('保存临时历史失败:', e);
    }
  };

  // 撤销操作
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(JSON.stringify(history[newIndex]))); // 从历史恢复数据
      sessionStorage.setItem('temp_history_index', String(newIndex));
    } else {
      antdMessage.info('已经是最早的状态');
    }
  };

  // 重做操作
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(JSON.stringify(history[newIndex]))); // 从历史恢复数据
      sessionStorage.setItem('temp_history_index', String(newIndex));
    } else {
      antdMessage.info('已经是最新的状态');
    }
  };

  // 创建备份
  const createBackup = async (dataToBackup: DataRow[]) => {
    try {
      const res = await fetch(`${apiUrl}/api/create-backup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataToBackup }),
      });
      const result = await res.json();
      if (res.ok) {
        console.log('备份成功:', result.message);
      } else {
        console.error('备份失败:', result.message);
      }
    } catch (err) {
      console.error("备份时出错:", err);
    }
  };

  // 注意：此 handleRestoreBackup 函数定义在 page.tsx 中。
  // ManagePanel 组件现在有其自己内部的恢复备份逻辑（不包括这里的 Modal.confirm）。
  // 因此，ManagePanel 上的“恢复备份”按钮不会调用这个函数。
  // 这个函数可能用于其他地方，或者如果希望恢复 ManagePanel 的行为（让它调用此函数），则需要修改 ManagePanel。
  const handleRestoreBackup_PageLevel = async () => {
    setLoading(true); // 页面级加载状态
    try {
      const startTime = Date.now();
      console.log(`[恢复备份 - page.tsx] 开始检查备份状态...`);
      const checkRes = await fetch(`${apiUrl}/api/restore-backup`, {
        method: "GET",
        headers: { 'Cache-Control': 'no-cache', 'X-Request-Time': String(Date.now()) }
      });
      const checkResult = await checkRes.json();
      console.log(`[恢复备份 - page.tsx] 备份状态检查完成，耗时: ${Date.now() - startTime}ms`, checkResult);

      if (!checkResult.hasBackup) {
        antdMessage.warning("未找到可恢复的备份");
        setLoading(false);
        return;
      }

      Modal.confirm({
        title: '恢复备份确认',
        content: (
          <div>
            <p>确定要恢复{checkResult.formattedTime || '之前'}的备份吗？</p>
            <p className="text-gray-500 text-sm">当前数据将会被替换为备份数据，但在您关闭浏览器前不会写入数据库。</p>
            <p className="text-blue-500 text-sm mt-2">您可以在关闭浏览器前随时修改恢复的数据，关闭浏览器时数据会自动保存到数据库。</p>
          </div>
        ),
        okText: '确定恢复',
        cancelText: '取消',
        onOk: async () => {
          try {
            const restoreStart = Date.now();
            console.log(`[恢复备份 - page.tsx] 开始获取备份数据 (POST)...`);
            // 注意：ManagePanel.tsx 使用 PATCH 和 result.value, 而这里用 POST 和 result.data
            const res = await fetch(`${apiUrl}/api/restore-backup`, {
              method: "POST",
              headers: { 'Cache-Control': 'no-cache', 'X-Request-Time': String(Date.now()) }
            });
            const result = await res.json();
            console.log(`[恢复备份 - page.tsx] 备份数据获取完成 (POST)，耗时: ${Date.now() - restoreStart}ms`, result);

            if (res.ok && result.data) { // page.tsx 期望 result.data
              console.log(`[恢复备份 - page.tsx] 开始更新本地数据状态...`);
              const backupData = result.data;
              setData(backupData); // 更新页面数据
              addHistory(backupData); // 添加到历史记录
              const totalTime = Date.now() - restoreStart;
              console.log(`[恢复备份 - page.tsx] 更新完成，总耗时: ${totalTime}ms`);
              Modal.success({
                title: '备份数据已恢复',
                content: (
                  <div>
                    <p>备份数据已成功恢复到页面，总耗时: {totalTime}ms。</p>
                    <p className="text-blue-500 mt-2">
                      当前数据仅显示在浏览器中，您可以继续修改数据。
                      所有修改将在您关闭浏览器时自动保存到数据库。
                    </p>
                  </div>
                ),
                okText: '我知道了'
              });
            } else {
              console.error(`[恢复备份 - page.tsx] API返回错误:`, result);
              antdMessage.error(result.message || "获取备份数据失败");
            }
          } catch (errInner) {
            console.error("[恢复备份 - page.tsx] 恢复过程中出错:", errInner);
            antdMessage.error("恢复失败: " + (errInner as Error).message);
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          console.log("[恢复备份 - page.tsx] 用户取消操作");
          setLoading(false);
        }
      });
    } catch (errOuter) {
      console.error("[恢复备份 - page.tsx] 操作失败:", errOuter);
      antdMessage.error("恢复失败: " + (errOuter as Error).message);
      setLoading(false);
    }
  };

  // 浏览器关闭前保存数据
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (data.length > 0) { // 仅当有数据时才保存
        console.log("[浏览器关闭] 开始保存当前数据到数据库...");
        fetch(`${apiUrl}/api/upload-excel`, { // API 端点用于保存数据
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "excel_data", value: data }), // 保存整个 data 数组
          keepalive: true, // 确保请求在页面关闭后仍能完成
        }).catch(err => console.error("页面关闭时保存数据失败:", err));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    console.log("[页面加载] 已注册浏览器关闭事件，将在关闭时保存数据到数据库");
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [data, apiUrl]); // 依赖 data 和 apiUrl

  // 从 sessionStorage 恢复临时历史
  useEffect(() => {
    try {
      const savedHistory = sessionStorage.getItem('temp_history');
      const savedIndex = sessionStorage.getItem('temp_history_index');
      if (savedHistory && savedIndex) {
        const parsedHistory = JSON.parse(savedHistory);
        const parsedIndex = parseInt(savedIndex, 10);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0 && !isNaN(parsedIndex)) {
          setHistory(parsedHistory);
          setHistoryIndex(parsedIndex);
          // 根据恢复的历史记录设置当前数据，如果历史不为空
          if (parsedHistory[parsedIndex]) {
             setData(JSON.parse(JSON.stringify(parsedHistory[parsedIndex])));
          }
        }
      }
    } catch (e) {
      console.error('恢复临时历史失败:', e);
    }
  }, []);

  // 获取数据库内容
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" }); // API 端点用于获取数据
      const result = await res.json();
      console.log("fetchData result:", result);
      let fetchedData: DataRow[] = [];
      if (Array.isArray(result.value)) {
        fetchedData = result.value;
      } else if (typeof result.value === "string") { // 兼容数据为字符串JSON的情况
        try {
          fetchedData = JSON.parse(result.value);
        } catch (parseError) {
          console.error("解析获取的数据失败:", parseError);
          fetchedData = []; // 解析失败则视为空数据
        }
      }
      setData(fetchedData);
      // 初始化历史记录 (如果之前从sessionStorage恢复的历史为空，并且获取到了数据)
      if (history.length === 0 || (history.length === 1 && history[0].length === 0) && fetchedData.length > 0) {
        const initialHistory = [JSON.parse(JSON.stringify(fetchedData))]; // 深拷贝
        setHistory(initialHistory);
        setHistoryIndex(0);
        sessionStorage.setItem('temp_history', JSON.stringify(initialHistory));
        sessionStorage.setItem('temp_history_index', '0');
      } else if (history.length === 0 && fetchedData.length === 0) { // 如果获取的数据也为空
         setHistory([[]]); // 初始化一个包含空数组的历史记录
         setHistoryIndex(0);
         sessionStorage.setItem('temp_history', JSON.stringify([[]]));
         sessionStorage.setItem('temp_history_index', '0');
      }
    } catch (err) {
      console.error("获取数据失败:", err);
      setData([]); // 获取失败则设置为空数据
      if (history.length === 0) { // 如果历史也为空，则初始化空历史
         setHistory([[]]);
         setHistoryIndex(0);
         sessionStorage.setItem('temp_history', JSON.stringify([[]]));
         sessionStorage.setItem('temp_history_index', '0');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 仅当 historyIndex 为 -1 时（表示尚未从 sessionStorage 恢复或初始化），才执行 fetchData
    // 避免在从 sessionStorage 成功恢复历史和数据后再次执行 fetchData 覆盖数据
    if (historyIndex === -1) {
        fetchData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIndex]); // 依赖 historyIndex

  // 上传 Excel 文件处理
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      if (data.length > 0) { // 仅当有旧数据时才创建备份
        await createBackup(data);
      }
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      type ExcelRow = (string | number | null | undefined)[];
      const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows: ExcelRow[] = allRows.slice(2); // 跳过表头和空行
      const idxName = 0, idxClass = 1, idxWeekday = 2, idxTheory = 3, idxWeekType = 12;
      const periodIdxs = [4,5,6,7,8,9,10,11]; // 对应Excel中的第1节到第8节
      const timeBlockIdxs = [13,14,15,16]; // 对应Excel中的时间段列
      const json: DataRow[] = rows.filter(row => row.length > 0 && row[idxName]).map((row, rowIdx: number) => {
        const isTheory = !!row[idxTheory];
        const periods = isTheory ? periodIdxs.map((excelColIdx, internalPeriodIdx) => row[excelColIdx] ? internalPeriodIdx+1 : null).filter(v => v !== null) as number[] : [];
        let weekType = null;
        if (!isTheory) {
          const weekTypeValue = row[idxWeekType];
          if (weekTypeValue === 1 || weekTypeValue === "1" || String(weekTypeValue).toLowerCase() === 'true') weekType = true; // 单周
          else if (weekTypeValue === 0 || weekTypeValue === "0" || String(weekTypeValue).toLowerCase() === 'false') weekType = false; // 双周
        }
        const timeBlocks = timeBlockIdxs.map((excelColIdx, internalTimeBlockIdx) => row[excelColIdx] ? TIME_BLOCKS[internalTimeBlockIdx] : null).filter(Boolean) as string[];
        console.log(`[Excel解析] 第${rowIdx+3}行: 原始=`, row, `isTheory=`, isTheory, 'periods=', periods, 'weekType=', weekType, 'timeBlocks=', timeBlocks);
        return {
          name: String(row[idxName]), class: String(row[idxClass]), weekday: Number(row[idxWeekday]),
          isTheory, periods, weekType, timeBlocks
        };
      });
      console.log('[Excel解析] 最终拼接出的json数组:', JSON.stringify(json, null, 2));
      // 上传解析后的数据到服务器 (这一步会在浏览器关闭时自动进行，此处可选择是否立即上传)
      // const res = await fetch(`${apiUrl}/api/upload-excel`, {
      //   method: "POST", headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ key: "excel_data", value: json }),
      // });
      // const result = await res.json();
      // setMessage(result.message || "上传成功，数据将在关闭浏览器时保存");
      antdMessage.success("文件解析成功，数据已更新并在关闭浏览器时自动保存");
      setData(json); // 更新本地数据
      addHistory(json); // 添加到历史记录
    } catch (err) {
      setMessage("上传失败: " + (err as Error).message);
      antdMessage.error("上传失败: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // 下载数据为Excel
  const downloadAsExcel = () => {
    if (data.length === 0) {
      antdMessage.warning("没有数据可供导出");
      return;
    }
    try {
      const workbook = XLSX.utils.book_new();
      const headers = ["姓名", "班级", "星期", "理论课", "第1节", "第2节", "第3节", "第4节", "第5节", "第6节", "第7节", "第8节", "单双周", "7:30-13:00", "14:00-19:00", "8:30-12:00", "14:00-17:30"];
      const excelData = [headers, [], ...data.map(row => {
        const rowData = new Array(17).fill("");
        rowData[0] = row.name; rowData[1] = row.class; rowData[2] = row.weekday; rowData[3] = row.isTheory ? 1 : 0;
        if (row.isTheory && row.periods) row.periods.forEach(period => { if(period >=1 && period <=8) rowData[3 + period] = 1; });
        if (!row.isTheory && row.weekType !== null) rowData[12] = row.weekType ? 1 : 0;
        if (!row.isTheory && row.timeBlocks) row.timeBlocks.forEach(timeBlock => {
          const index = TIME_BLOCKS.indexOf(timeBlock);
          if (index !== -1) rowData[13 + index] = 1;
        });
        return rowData;
      })];
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "空余时间统计");
      const now = new Date();
      const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      const fileName = `兴趣班空余时间统计_${timestamp}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      antdMessage.success(`已成功导出到 ${fileName}`);
    } catch (err) {
      console.error("导出Excel失败:", err);
      antdMessage.error("导出Excel失败: " + (err as Error).message);
    }
  };

  // 清空数据库
  const handleClear = async () => {
    Modal.confirm({
        title: '确认清空数据',
        content: '确定要清空所有数据吗？此操作会先备份当前数据，然后清空。清空的数据将在关闭浏览器时同步到数据库。',
        okText: '确定清空',
        cancelText: '取消',
        onOk: async () => {
            setUploading(true); // 使用 uploading 状态表示操作中
            setMessage("");
            try {
              if (data.length > 0) { // 仅当有数据时才备份
                await createBackup(data);
              }
              // const res = await fetch(`${apiUrl}/api/clear-kv`, { method: "POST" }); // 清除服务器端数据的API
              // const result = await res.json();
              // setMessage(result.message || "已清空服务器数据");
              antdMessage.success("本地数据已清空，将在关闭浏览器时同步");
              const emptyData: DataRow[] = [];
              setData(emptyData); // 清空本地数据
              addHistory(emptyData); // 添加到历史记录
            } catch (err) {
              setMessage("清空失败: " + (err as Error).message);
              antdMessage.error("清空失败: " + (err as Error).message);
            } finally {
              setUploading(false);
            }
        }
    });
  };

  // 删除操作
  const handleDelete = async (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    addHistory(newData);
    // 数据将在浏览器关闭时自动保存，无需立即调用API
    antdMessage.success("删除成功 (将在关闭浏览器时保存)");
  };

  // 新增操作
  const handleAdd = () => { setAddModalOpen(true); form.resetFields(); setWeekPeriod([]); setWeekTypeTimeBlock([]); };
  const handleAddCancel = () => setAddModalOpen(false);

  // 编辑操作
  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    const rowToEdit = data[idx];
    setEditRow(JSON.parse(JSON.stringify(rowToEdit))); // 深拷贝以避免直接修改状态
    // 根据 rowToEdit 的 isTheory 状态来决定初始化哪些字段
    const formValues = {
        name: rowToEdit.name,
        class: rowToEdit.class,
        isTheory: rowToEdit.isTheory, // 这个字段在 Modal 中是 disabled 的，但为了表单结构完整可以设置
        // 理论课相关
        weekday: rowToEdit.isTheory ? rowToEdit.weekday : undefined, // 仅理论课有 weekday
        periods: rowToEdit.isTheory ? rowToEdit.periods : [],
        // 实训课相关
        weekType: !rowToEdit.isTheory ? rowToEdit.weekType : null, // 仅实训课有 weekType
        timeBlocks: !rowToEdit.isTheory ? rowToEdit.timeBlocks : []
    };
    editForm.setFieldsValue(formValues);
    setEditModalOpen(true);
  };
  const handleEditCancel = () => { setEditModalOpen(false); setEditRow(null); setEditIdx(null); editForm.resetFields(); };

  // 用于新增模态框的 state
  const [weekPeriod, setWeekPeriod] = useState<number[][]>([]);
  const [weekTypeTimeBlock, setWeekTypeTimeBlock] = useState<[boolean, string][]>([]);

  // 编辑模态框打开时，根据 editRow 初始化表单
  useEffect(() => {
    if (editModalOpen && editRow) {
      console.log('[EditModal] 打开，editRow:', editRow);
      const setFields = {
        name: editRow.name,
        class: editRow.class,
        isTheory: editRow.isTheory, // 虽然 disabled，但保持表单结构
        ...(editRow.isTheory ? { weekday: editRow.weekday, periods: editRow.periods }
                            : { weekType: editRow.weekType, timeBlocks: editRow.timeBlocks })
      };
      // 使用 setTimeout 确保 Modal 和 Form 完全渲染后再设置值
      setTimeout(() => { editForm.setFieldsValue(setFields); }, 0);
      console.log('[EditModal] setFieldsValue:', setFields);
    } else if (!editModalOpen) { // 关闭时重置表单
      editForm.resetFields();
    }
  }, [editModalOpen, editRow, editForm]);

  // 新增模态框中 理论/实训 切换时的处理
  const handleTheorySwitch = (checked: boolean) => {
    form.setFieldValue('isTheory', checked);
    if (checked) { // 切换到理论课
      setWeekTypeTimeBlock([]); // 清空实训课的选择
      form.setFieldsValue({ weekTypeTimeBlock: [] }); // 清空表单中的实训课数据
    } else { // 切换到实训课
      setWeekPeriod([]); // 清空理论课的选择
      form.setFieldsValue({ weekPeriod: [] }); // 清空表单中的理论课数据
    }
  };

  // 表格组件 WeekPeriodTable (用于理论课选择星期和节次)
  function WeekPeriodTable({ value = [], onChange }: { value?: number[][], onChange?: (val: number[][]) => void }) {
    const selected = new Set((value || []).map(([w, p]) => `${w}-${p}`));
    const [isDragging, setIsDragging] = useState(false);
    const [startCell, setStartCell] = useState<{w: number, p: number} | null>(null);
    const [currentCell, setCurrentCell] = useState<{w: number, p: number} | null>(null);
    const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
    const getSelectedCellsInDrag = () => {
      if (!startCell || !currentCell) return new Set<string>();
      const minWeekday = Math.min(startCell.w, currentCell.w); const maxWeekday = Math.max(startCell.w, currentCell.w);
      const minPeriod = Math.min(startCell.p, currentCell.p); const maxPeriod = Math.max(startCell.p, currentCell.p);
      const cellsInDrag = new Set<string>();
      for (let w = minWeekday; w <= maxWeekday; w++) for (let p = minPeriod; p <= maxPeriod; p++) cellsInDrag.add(`${w}-${p}`);
      return cellsInDrag;
    };
    const handleMouseDownInternal = (w: number, p: number, isSelectedCurrently: boolean) => { setIsDragging(true); setStartCell({w, p}); setCurrentCell({w, p}); setDragMode(isSelectedCurrently ? 'deselect' : 'select'); };
    const handleMouseMoveInternal = (w: number, p: number) => { if (isDragging) setCurrentCell({w, p}); };
    const handleMouseUpInternal = () => {
      if (isDragging && startCell && currentCell && dragMode) {
        const cellsInDrag = getSelectedCellsInDrag(); let arr = value ? [...value] : [];
        if (dragMode === 'select') cellsInDrag.forEach(key => { const [w, p] = key.split('-').map(Number); if (!selected.has(key)) arr.push([w, p]); });
        else arr = arr.filter(([w, p]) => !cellsInDrag.has(`${w}-${p}`));
        onChange?.(arr);
      }
      setIsDragging(false); setStartCell(null); setCurrentCell(null); setDragMode(null);
    };
    const getCellStyle = (w: number, p: number) => {
      const key = `${w}-${p}`; const isSelectedCurrently = selected.has(key);
      if (isDragging) { const cellsInDrag = getSelectedCellsInDrag(); const isInDragRange = cellsInDrag.has(key);
        if (isInDragRange) return dragMode === 'select' ? (isSelectedCurrently ? 'bg-blue-500 text-white' : 'bg-blue-300 text-white') : (isSelectedCurrently ? 'bg-red-300 text-white' : 'bg-gray-100');
      } return isSelectedCurrently ? 'bg-blue-500 text-white' : 'bg-gray-100';
    };
    const preventDefault = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
    useEffect(() => {
      if (isDragging) { const handleGlobalMouseUp = () => handleMouseUpInternal();
        window.addEventListener('mouseup', handleGlobalMouseUp); window.addEventListener('mouseleave', handleGlobalMouseUp);
        return () => { window.removeEventListener('mouseup', handleGlobalMouseUp); window.removeEventListener('mouseleave', handleGlobalMouseUp); };
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDragging, value]); // 添加 value 到依赖项，确保 selected 集合更新
    return (<div style={{ overflowX: 'auto' }} onMouseLeave={handleMouseUpInternal}><div className="text-xs text-gray-500 mb-1">提示：按住鼠标拖动可批量选择或取消选择</div><table className="border text-center select-none" style={{ minWidth: 400, width: '100%' }} onMouseUp={handleMouseUpInternal} onMouseLeave={handleMouseUpInternal}><thead><tr><th></th>{WEEKDAYS.map(w => <th key={w}>周{['一','二','三','四','五'][w-1]}</th>)}</tr></thead><tbody>{PERIODS.map(p => (<tr key={p}><td className="font-bold">{p}节</td>{WEEKDAYS.map(w => { const key = `${w}-${p}`; const isSelectedCurrently = selected.has(key); const cellStyle = getCellStyle(w, p); return (<td key={w} className="p-1" onMouseDown={preventDefault}><button type="button" className={`w-7 h-7 rounded ${cellStyle} border border-blue-200 focus:outline-none transition-colors`} onMouseDown={(e) => { preventDefault(e); handleMouseDownInternal(w, p, isSelectedCurrently); }} onMouseMove={() => handleMouseMoveInternal(w, p)} onMouseUp={handleMouseUpInternal}>{isSelectedCurrently && !isDragging ? '✔' : ''}</button></td>);})}</tr>))}</tbody></table></div>);
  }

  // 表格组件 WeekTypeTimeBlockTable (用于实训课选择单双周和时间段)
  function WeekTypeTimeBlockTable({ value = [], onChange }: { value?: [boolean, string][], onChange?: (val: [boolean, string][]) => void }) {
    const selectedMap = new Map<string, boolean>();
    (value || []).forEach(([weekType, timeBlock]) => { const timeBlockCode = getTimeBlockCode(timeBlock); if (timeBlockCode) selectedMap.set(`${weekType ? "单周" : "双周"}-${timeBlockCode}`, true); else console.error(`警告: 无法识别的时间段值 "${timeBlock}"`); });
    const [isDragging, setIsDragging] = useState(false); const [startCell, setStartCell] = useState<{wLabel: string, code: string} | null>(null); const [currentCell, setCurrentCell] = useState<{wLabel: string, code: string} | null>(null); const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
    const weekTypeMap: Record<string, boolean> = { "单周": true, "双周": false };
    const getSelectedCellsInDrag = () => {
      if (!startCell || !currentCell) return new Set<string>();
      const weekLabels = ["单周", "双周"]; const startRowIdx = weekLabels.indexOf(startCell.wLabel); const endRowIdx = weekLabels.indexOf(currentCell.wLabel); const minRowIdx = Math.min(startRowIdx, endRowIdx); const maxRowIdx = Math.max(startRowIdx, endRowIdx);
      const timeBlockCodes = Object.keys(TIME_BLOCK_CODES); const startColIdx = timeBlockCodes.indexOf(startCell.code); const endColIdx = timeBlockCodes.indexOf(currentCell.code); if (startColIdx === -1 || endColIdx === -1) { console.error("无效的时间段代码索引:", startCell.code, currentCell.code); return new Set<string>(); } const minColIdx = Math.min(startColIdx, endColIdx); const maxColIdx = Math.max(startColIdx, endColIdx);
      const cellsInDrag = new Set<string>(); for (let rowIdx = minRowIdx; rowIdx <= maxRowIdx; rowIdx++) { const weekLabel = weekLabels[rowIdx]; for (let colIdx = minColIdx; colIdx <= maxColIdx; colIdx++) { const code = timeBlockCodes[colIdx]; cellsInDrag.add(`${weekLabel}-${code}`); } } return cellsInDrag;
    };
    const handleMouseDownInternal = (wLabel: string, code: string, isSelectedCurrently: boolean) => { setIsDragging(true); setStartCell({wLabel, code}); setCurrentCell({wLabel, code}); setDragMode(isSelectedCurrently ? 'deselect' : 'select'); };
    const handleMouseMoveInternal = (wLabel: string, code: string) => { if (isDragging) setCurrentCell({wLabel, code}); };
    const handleMouseUpInternal = () => {
      if (isDragging && startCell && currentCell && dragMode) {
        const cellsInDrag = getSelectedCellsInDrag(); let newValue = [...(value || [])];
        if (dragMode === 'select') cellsInDrag.forEach(key => { const [weekLabel, code] = key.split('-'); const fullTimeBlock = getFullTimeBlock(code); if (fullTimeBlock && !selectedMap.has(key)) { const weekType = weekTypeMap[weekLabel as keyof typeof weekTypeMap]; newValue.push([weekType, fullTimeBlock]); } });
        else newValue = newValue.filter(([weekType, timeBlock]) => { const code = getTimeBlockCode(timeBlock); if (!code) return true; const key = `${weekType ? "单周" : "双周"}-${code}`; return !cellsInDrag.has(key); });
        onChange?.(newValue);
      }
      setIsDragging(false); setStartCell(null); setCurrentCell(null); setDragMode(null);
    };
    const getCellStyle = (wLabel: string, code: string) => {
      const key = `${wLabel}-${code}`; const isSelectedCurrently = selectedMap.has(key);
      if (isDragging) { const cellsInDrag = getSelectedCellsInDrag(); const isInDragRange = cellsInDrag.has(key);
        if (isInDragRange) return dragMode === 'select' ? (isSelectedCurrently ? 'bg-blue-500 text-white' : 'bg-blue-300 text-white') : (isSelectedCurrently ? 'bg-red-300 text-white' : 'bg-gray-100');
      } return isSelectedCurrently ? 'bg-blue-500 text-white' : 'bg-gray-100';
    };
    const preventDefault = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
    useEffect(() => {
      if (isDragging) { const handleGlobalMouseUp = () => handleMouseUpInternal();
        window.addEventListener('mouseup', handleGlobalMouseUp); window.addEventListener('mouseleave', handleGlobalMouseUp);
        return () => { window.removeEventListener('mouseup', handleGlobalMouseUp); window.removeEventListener('mouseleave', handleGlobalMouseUp); };
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDragging, value]); // 添加 value 到依赖项
    const weekLabels = ["单周", "双周"]; const timeBlockCodes = Object.keys(TIME_BLOCK_CODES);
    return (<div style={{ overflowX: 'auto' }} onMouseLeave={handleMouseUpInternal}><div className="text-xs text-gray-500 mb-1">提示：按住鼠标拖动可批量选择或取消选择</div><table className="border text-center select-none" style={{ minWidth: 400, width: '100%' }} onMouseUp={handleMouseUpInternal} onMouseLeave={handleMouseUpInternal}><thead><tr><th></th>{timeBlockCodes.map((code, idx) => (<th key={`head-${idx}-${code}`}>{getFullTimeBlock(code)}</th>))}</tr></thead><tbody>{weekLabels.map((wLabel, rowIdx) => (<tr key={`row-${rowIdx}-${wLabel}`}><td className="font-bold">{wLabel}</td>{timeBlockCodes.map((code, colIdx) => { const key = `${wLabel}-${code}`; const isSelectedCurrently = selectedMap.has(key); const cellStyle = getCellStyle(wLabel, code); return (<td key={`cell-${rowIdx}-${colIdx}-${code}`} className="p-1" onMouseDown={preventDefault}><button type="button" className={`w-24 h-7 rounded ${cellStyle} border border-blue-200 focus:outline-none transition-colors text-xs`} onMouseDown={(e) => { preventDefault(e); handleMouseDownInternal(wLabel, code, isSelectedCurrently); }} onMouseMove={() => handleMouseMoveInternal(wLabel, code)} onMouseUp={handleMouseUpInternal}>{isSelectedCurrently && !isDragging ? '✓' : ''}</button></td>);})}</tr>))}</tbody></table></div>);
  }

  // 编辑保存（单条数据）
  const handleEditSaveSingle = async () => {
    try {
      const values = await editForm.validateFields(); // 获取表单所有字段值
      if (editIdx === null || !editRow) {
        antdMessage.error("没有选中要编辑的行");
        return;
      }
      // 基础数据保持不变 (姓名, 班级, 课程类型)
      const baseData = { name: editRow.name, class: editRow.class, isTheory: editRow.isTheory };
      let newRow: DataRow;

      if (baseData.isTheory) { // 如果是理论课
        if (!values.periods || values.periods.length === 0) { antdMessage.error("理论课请至少选择一个节次"); return; }
        newRow = { ...baseData, weekday: editRow.weekday, periods: values.periods.map(Number).sort((a: number, b: number) => a - b), weekType: null, timeBlocks: [] };
      } else { // 如果是实训课
        if (!values.timeBlocks || values.timeBlocks.length === 0) { antdMessage.error("实训课请至少选择一个时间段"); return; }
        const validTimeBlocks: string[] = [];
        for (const timeBlock of values.timeBlocks) { // 确保时间段格式正确
          if (TIME_BLOCKS.includes(timeBlock)) validTimeBlocks.push(timeBlock);
          else { const matchedTimeBlock = TIME_BLOCKS.find(tb => tb.startsWith(timeBlock));
            if (matchedTimeBlock) validTimeBlocks.push(matchedTimeBlock);
            else { antdMessage.error(`无效的时间段: ${timeBlock}`); return; }
          }
        }
        newRow = { ...baseData, weekday: 0, periods: [], weekType: editRow.weekType, timeBlocks: validTimeBlocks };
      }
      console.log("编辑后的数据:", JSON.stringify(newRow, null, 2));
      const newData = [...data];
      newData[editIdx] = newRow; // 更新数据数组中对应条目
      setData(newData);
      addHistory(newData); // 添加到历史记录
      setEditModalOpen(false); setEditRow(null); setEditIdx(null); // 关闭模态框并重置状态
      antdMessage.success("修改成功 (将在关闭浏览器时保存)");
    } catch (err) {
      console.error("保存失败:", err);
      antdMessage.error("保存失败，请检查输入");
    }
  };

  // 新增数据保存 (处理批量新增逻辑)
  const handleAddSave = async () => { // 原来的 handleEditSaveWithCustom
    try {
      const values = await form.validateFields(); // 获取新增表单的值
      const formData = { name: values.name, class: values.class };
      let newRows: DataRow[] = [];

      if (values.isTheory) { // 处理理论课
        if (!weekPeriod.length) { antdMessage.error("理论课请至少选择一个星期+节次组合"); return; }
        const weekdayPeriods: Record<number, number[]> = {}; // 按星期分组节次
        for (const [weekday, period] of weekPeriod) { if (!weekdayPeriods[weekday]) weekdayPeriods[weekday] = []; weekdayPeriods[weekday].push(period); }
        for (const [weekday, periods] of Object.entries(weekdayPeriods)) newRows.push({ ...formData, weekday: Number(weekday), isTheory: true, periods: periods.sort((a, b) => a - b), weekType: null, timeBlocks: [] });
      } else { // 处理实训课
        if (!weekTypeTimeBlock.length) { antdMessage.error("实训课请至少选择一个单双周+时间段组合"); return; }
        // const weekTypeBlocks: Record<string, string[]> = { 'true': [], 'false': [] }; // true for 单周, false for 双周
        const weekTypeEntries: { weekType: boolean, timeBlocks: string[] }[] = [];

        // 先按 weekType 分组
        const groupedByWeekType: Record<string, string[]> = { 'true': [], 'false': [] };
        for (const [wtBool, timeBlock] of weekTypeTimeBlock) {
            const wtStr = String(wtBool);
            if (!TIME_BLOCKS.includes(timeBlock)) {
                const matchedTimeBlock = TIME_BLOCKS.find(tb => tb.startsWith(timeBlock));
                if (matchedTimeBlock) groupedByWeekType[wtStr].push(matchedTimeBlock);
                else { antdMessage.error(`无效的时间段: ${timeBlock}`); return; }
            } else {
                groupedByWeekType[wtStr].push(timeBlock);
            }
        }
        // 为每个有选择的 weekType 创建条目
        if(groupedByWeekType['true'].length > 0) {
            newRows.push({ ...formData, weekday: 0, isTheory: false, periods: [], weekType: true, timeBlocks: groupedByWeekType['true'] });
        }
        if(groupedByWeekType['false'].length > 0) {
            newRows.push({ ...formData, weekday: 0, isTheory: false, periods: [], weekType: false, timeBlocks: groupedByWeekType['false'] });
        }
      }
      console.log("新增数据:", JSON.stringify(newRows, null, 2));
      const newData = [...newRows, ...data]; // 新数据添加到最前面
      setData(newData);
      addHistory(newData);
      setAddModalOpen(false); // 关闭新增模态框
      antdMessage.success("新增成功 (将在关闭浏览器时保存)");
    } catch (err) {
      console.error("保存失败:", err);
      antdMessage.error("保存失败，请检查输入");
    }
  };

  // ManagePanel 数据恢复后的回调函数
  const handleDataChangeFromManagePanel = (newDataFromPanel: DataRow[]) => {
    setData(newDataFromPanel); // 更新主页面的数据状态
    addHistory(newDataFromPanel); // 将恢复的数据添加到历史记录
    antdMessage.success("数据已从备份恢复!"); // 给用户反馈
  };

  const menuItems = [ { key: "upload", label: "数据上传" }, { key: "manage", label: "数据管理" }];

  // 通用的历史记录和下载按钮组件
  const commonHistoryButtons = (
    <div className="flex items-center space-x-2">
      <div className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs flex items-center">
        <span className="hidden sm:inline">历史：</span>
        <span>{historyIndex + 1}/{history.length > 0 ? history.length : 1}</span> {/* 确保 length 不为0 */}
      </div>
      <AntdButton type="default" icon={<UndoOutlined />} onClick={handleUndo} disabled={historyIndex <= 0} size="small"/>
      <AntdButton type="default" icon={<RedoOutlined />} onClick={handleRedo} disabled={historyIndex >= history.length - 1} size="small"/>
      <AntdButton icon={<DownloadOutlined />} onClick={downloadAsExcel} disabled={data.length === 0} size="small" title="导出Excel"/>
    </div>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Sider for Desktop */}
      {!isNarrow && (
        <Sider width={200} style={{ background: "#fff", boxShadow: "2px 0 8px #f0f1f2", display: "flex", flexDirection: "column", height: "100vh", position: "fixed", left: 0, top: 0, overflowY: "auto" }}>
          <div className="text-2xl font-bold text-center py-6 text-blue-700 tracking-wide select-none">控制台</div>
          <Menu mode="inline" selectedKeys={[selectedKey]} onClick={e => setSelectedKey(e.key as string)} items={menuItems} style={{ flex: 1, borderRight: 0, fontSize: 16, overflowY: "auto", height: "calc(100vh - 170px)" /* 调整高度以适应 UserMenu */ }}/>
          <div className="mt-auto py-4 px-4 bg-white" style={{boxShadow: "0 -2px 8px rgba(0,0,0,0.05)"}}><UserMenu /></div>
        </Sider>
      )}
      {/* Drawer for Mobile */}
      {isNarrow && (
        <>
          <AntdButton type="primary" shape="circle" icon={<MenuOutlined />} size="large" style={{ position: "fixed", left: 24, bottom: 24, zIndex: 1100, boxShadow: "0 2px 8px #ccc" }} onClick={() => setDrawerOpen(true)}/>
          <Drawer placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} bodyStyle={{ padding: 0 }} width={220} style={{ zIndex: 1200 }}>
            <div className="text-2xl font-bold text-center py-6 text-blue-700 tracking-wide select-none">控制台</div>
            <Menu mode="inline" selectedKeys={[selectedKey]} onClick={e => { setSelectedKey(e.key as string); setDrawerOpen(false); }} items={menuItems} style={{ flex: 1, borderRight: 0, fontSize: 16, overflowY: "auto", height: "calc(100vh - 170px)" }}/>
            <div className="mt-auto py-4 px-4 bg-white" style={{boxShadow: "0 -2px 8px rgba(0,0,0,0.05)"}}><UserMenu /></div>
          </Drawer>
        </>
      )}
      <Layout>
        <Content style={{ margin: "32px 32px 32px", marginLeft: isNarrow ? "32px" : "232px", background: "#f8fafc", borderRadius: 16, boxShadow: "0 2px 16px #e6e6e6", minHeight: 600, padding: 32 }}>
          {/* Content based on view (narrow or not) */}
          {isNarrow ? (
            <>
              {selectedKey === "upload" && <UploadPanel uploading={uploading} message={message} onFileChange={handleFileChange} onClear={handleClear} historyButtons={commonHistoryButtons}/>}
              {selectedKey === "manage" && (
                <ManagePanel
                  data={data}
                  loading={loading} // 页面级loading
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDataChange={handleDataChangeFromManagePanel} // 传递回调函数
                  editModalOpen={editModalOpen}
                  editRow={editRow}
                  onEditModalClose={handleEditCancel}
                  onEditSave={handleEditSaveSingle} // 编辑时调用单条保存
                  form={editForm} // 传递 editForm 给 ManagePanel (虽然它可能不直接用)
                  historyButtons={commonHistoryButtons}
                  page={page}
                  pageSize={pageSize}
                  setPage={setPage}
                />
              )}
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e6e6e6', padding: 32, minHeight: 500 }}>
              {selectedKey === "upload" && <UploadPanel uploading={uploading} message={message} onFileChange={handleFileChange} onClear={handleClear} historyButtons={commonHistoryButtons}/>}
              {selectedKey === "manage" && (
                <ManagePanel
                  data={data}
                  loading={loading}
                  onAdd={handleAdd}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onDataChange={handleDataChangeFromManagePanel} // 传递回调函数
                  editModalOpen={editModalOpen}
                  editRow={editRow}
                  onEditModalClose={handleEditCancel}
                  onEditSave={handleEditSaveSingle} // 编辑时调用单条保存
                  form={editForm} // 传递 editForm
                  historyButtons={commonHistoryButtons}
                  page={page}
                  pageSize={pageSize}
                  setPage={setPage}
                />
              )}
            </div>
          )}
        </Content>
      </Layout>
      {/* Add Modal */}
      <Modal open={addModalOpen} onCancel={handleAddCancel} onOk={handleAddSave} title="批量新增数据" width={600} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ isTheory: false }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}><Input autoComplete="off" placeholder="请输入教师姓名" /></Form.Item>
          <Form.Item name="class" label="班级" rules={[{ required: true, message: '请输入班级' }]}><Input autoComplete="off" placeholder="请输入班级名称" /></Form.Item>
          <Form.Item name="isTheory" label="课程类型" valuePropName="checked">
            <Switch checkedChildren="理论课" unCheckedChildren="实训课" onChange={handleTheorySwitch} />
          </Form.Item>
          {form.getFieldValue('isTheory') ? (
            <div className="bg-blue-50 p-4 rounded mb-4">
              <div className="text-blue-700 mb-2 font-semibold">理论课说明：</div>
              <p className="text-sm mb-2">当选择多个星期和节次时，系统会按星期分组，为每个星期创建一条包含所选节次的记录。</p>
              <Form.Item label="星期+节次" className="mt-2" name="weekPeriod" rules={[{ validator: async () => weekPeriod.length > 0 ? Promise.resolve() : Promise.reject(new Error('请至少选择一个星期+节次'))}]}>
                <WeekPeriodTable value={weekPeriod} onChange={setWeekPeriod} />
              </Form.Item>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded mb-4">
              <div className="text-green-700 mb-2 font-semibold">实训课说明：</div>
              <p className="text-sm mb-2">当选择多个单双周和时间段时，系统会按单双周分组，为每种周类型创建一条包含所选时间段的记录。</p>
              <Form.Item label="单双周+时间段" className="mt-2" name="weekTypeTimeBlock" rules={[{ validator: async () => weekTypeTimeBlock.length > 0 ? Promise.resolve() : Promise.reject(new Error('请至少选择一个单双周+时间段'))}]}>
                <WeekTypeTimeBlockTable value={weekTypeTimeBlock} onChange={setWeekTypeTimeBlock} />
              </Form.Item>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200"><div className="text-gray-500 text-sm">注：添加的数据将显示在数据列表的最前面。</div></div>
        </Form>
      </Modal>
      {/* Edit Modal */}
      <Modal open={editModalOpen} onCancel={handleEditCancel} onOk={handleEditSaveSingle} title="编辑数据" width={450} destroyOnClose>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="姓名"><Input autoComplete="off" disabled /></Form.Item>
          <Form.Item name="class" label="班级"><Input autoComplete="off" disabled /></Form.Item>
          <Form.Item label="课程类型"><Input value={editRow?.isTheory ? '理论课' : '实训课'} disabled /></Form.Item>
          {editRow?.isTheory ? (
            <>
              <Form.Item label="星期"><Input value={editRow ? `周${['一','二','三','四','五'][editRow.weekday - 1]}` : ''} disabled /></Form.Item>
              <Form.Item name="periods" label="节次" rules={[{ required: true, message: '请选择节次' }]}>
                <Select mode="multiple" placeholder="请选择节次" allowClear style={{ width: '100%' }}>{PERIODS.map(p => (<Select.Option key={p} value={p}>{p}节</Select.Option>))}</Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item label="周类型"><Input value={editRow?.weekType === true ? '单周' : (editRow?.weekType === false ? '双周' : '未指定')} disabled /></Form.Item>
              <Form.Item name="timeBlocks" label="时间段" rules={[{ required: true, message: '请选择时间段' }]}>
                <Select mode="multiple" placeholder="请选择时间段" allowClear style={{ width: '100%' }}>{TIME_BLOCKS.map(tb => (<Select.Option key={tb} value={tb}>{tb}</Select.Option>))}</Select>
              </Form.Item>
            </>
          )}
          <div className="mt-4 pt-4 border-t border-gray-200"><div className="text-gray-500 text-sm">注意：只能修改当前行的节次或时间段。姓名、班级、课程类型和星期/周类型不可在此处修改。</div></div>
        </Form>
      </Modal>
    </Layout>
  );
}
