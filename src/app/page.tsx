"use client";
import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Layout, Menu, message as antdMessage, Modal, Form, Input, Switch, Select, Button as AntdButton } from "antd";
import UploadPanel from "./components/UploadPanel";
import ManagePanel from "./components/ManagePanel";
import UserMenu from "./components/UserMenu";
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
const TIME_BLOCK_CODES = {
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
  // 尝试直接匹配
  if (TIME_BLOCK_REVERSE_MAP[timeBlock]) {
    return TIME_BLOCK_REVERSE_MAP[timeBlock];
  }
  
  // 尝试前缀匹配
  for (const [fullTimeBlock, code] of Object.entries(TIME_BLOCK_REVERSE_MAP)) {
    if (fullTimeBlock.startsWith(timeBlock)) {
      return code;
    }
  }
  
  return "";
};

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
  const [history, setHistory] = useState<DataRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

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
    // 创建一个深拷贝
    const dataCopy = JSON.parse(JSON.stringify(newData));
    
    // 如果当前不在历史末尾，需要裁剪掉当前位置之后的历史
    const newHistory = history.slice(0, historyIndex + 1);
    
    // 添加新状态到历史
    newHistory.push(dataCopy);
    
    // 限制历史记录数量，最多保留100条
    if (newHistory.length > 100) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // 保存临时历史到sessionStorage
    try {
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
      setData(JSON.parse(JSON.stringify(history[newIndex])));
      
      // 更新sessionStorage
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
      setData(JSON.parse(JSON.stringify(history[newIndex])));
      
      // 更新sessionStorage
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

  // 恢复备份 - 重构为仅获取备份数据并更新前端状态
  const handleRestoreBackup = async () => {
    setLoading(true);
    try {
      // 先检查是否有备份可恢复
      const startTime = Date.now();
      console.log(`[恢复备份] 开始检查备份状态...`);
      
      const checkRes = await fetch(`${apiUrl}/api/restore-backup`, { 
        method: "GET",
        headers: { 
          'Cache-Control': 'no-cache',
          'X-Request-Time': String(Date.now())
        }
      });
      const checkResult = await checkRes.json();
      
      console.log(`[恢复备份] 备份状态检查完成，耗时: ${Date.now() - startTime}ms`, checkResult);
      
      if (!checkResult.hasBackup) {
        antdMessage.warning("未找到可恢复的备份");
        setLoading(false);
        return;
      }
      
      // 显示确认对话框
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
            // 请求备份数据
            const restoreStart = Date.now();
            console.log(`[恢复备份] 开始获取备份数据...`);
            
            const res = await fetch(`${apiUrl}/api/restore-backup`, { 
              method: "POST",
              headers: { 
                'Cache-Control': 'no-cache',
                'X-Request-Time': String(Date.now())
              }
            });
            const result = await res.json();
            
            console.log(`[恢复备份] 备份数据获取完成，耗时: ${Date.now() - restoreStart}ms`, {
              status: res.status,
              recordCount: result.recordCount || 0,
              dataSize: result.dataSize || 0
            });
            
            if (res.ok && result.data) {
              // 将恢复的数据直接更新到前端状态，不写入数据库
              console.log(`[恢复备份] 开始更新本地数据状态...`);
              const backupData = result.data;
              
              // 更新UI和历史记录
              setData(backupData);
              addHistory(backupData);
              
              const totalTime = Date.now() - restoreStart;
              console.log(`[恢复备份] 更新完成，总耗时: ${totalTime}ms`);
              
              // 显示成功消息，提示用户数据将在浏览器关闭时保存
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
              console.error(`[恢复备份] API返回错误:`, result);
              antdMessage.error(result.message || "获取备份数据失败");
            }
          } catch (err) {
            console.error("[恢复备份] 恢复过程中出错:", err);
            antdMessage.error("恢复失败: " + (err as Error).message);
          } finally {
            setLoading(false);
          }
        },
        onCancel: () => {
          console.log("[恢复备份] 用户取消操作");
          setLoading(false);
        }
      });
    } catch (err) {
      console.error("[恢复备份] 操作失败:", err);
      antdMessage.error("恢复失败: " + (err as Error).message);
      setLoading(false);
    }
  };

  // 修改浏览器关闭事件处理
  useEffect(() => {
    // 在浏览器关闭前保存数据到数据库
    const handleBeforeUnload = () => {
      // 只有当有数据时才执行保存
      if (data.length > 0) {
        console.log("[浏览器关闭] 开始保存当前数据到数据库...");
        
        // 使用fetch API保存数据，确保请求在页面关闭后仍能完成
        fetch(`${apiUrl}/api/upload-excel`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json" 
          },
          body: JSON.stringify({ key: "excel_data", value: data }),
          // 使用keepalive确保请求在页面关闭后仍能完成
          keepalive: true,
        }).catch(err => console.error("页面关闭时保存数据失败:", err));
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    console.log("[页面加载] 已注册浏览器关闭事件，将在关闭时保存数据到数据库");
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [data, apiUrl]);

  // 从sessionStorage恢复临时历史
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
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" });
      const result = await res.json();
      console.log("fetchData result:", result);
      
      let fetchedData: DataRow[] = [];
      if (Array.isArray(result.value)) {
        fetchedData = result.value;
      } else if (typeof result.value === "string") {
        fetchedData = JSON.parse(result.value);
      }
      
      setData(fetchedData);
      
      // 初始化历史记录（如果为空）
      if (history.length === 0) {
        setHistory([fetchedData]);
        setHistoryIndex(0);
        
        // 保存到sessionStorage
        sessionStorage.setItem('temp_history', JSON.stringify([fetchedData]));
        sessionStorage.setItem('temp_history_index', '0');
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
      // 创建备份
      await createBackup(data);
      
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // 改进类型定义，减少any的使用
      type ExcelRow = (string | number | null | undefined)[];
      const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows: ExcelRow[] = allRows.slice(2);
      
      const idxName = 0;
      const idxClass = 1;
      const idxWeekday = 2;
      const idxTheory = 3;
      const idxWeekType = 12;
      const periodIdxs = [4,5,6,7,8,9,10,11];
      const timeBlockIdxs = [13,14,15,16];
      
      const json: DataRow[] = rows.filter(row => row.length > 0 && row[idxName]).map((row, rowIdx: number) => {
        const isTheory = !!row[idxTheory];
        const periods = isTheory ? periodIdxs.map((i, idx) => row[i] ? idx+1 : null).filter(v => v !== null) as number[] : [];
        
        let weekType = null;
        if (!isTheory) {
          const weekTypeValue = row[idxWeekType];
          if (weekTypeValue === 1 || weekTypeValue === "1") weekType = true;
          else if (weekTypeValue === 0 || weekTypeValue === "0") weekType = false;
        }
        
        // 确保使用完整的时间段格式
        const timeBlocks = timeBlockIdxs.map((i, idx) => {
          // 只有当单元格有值时才使用对应的完整时间段
          return row[i] ? TIME_BLOCKS[idx] : null;
        }).filter(Boolean) as string[];
        
        // 日志输出
        console.log(`[Excel解析] 第${rowIdx+3}行: 原始=`, row);
        console.log(`[Excel解析] isTheory=`, isTheory, 'periods=', periods, 'weekType=', weekType, 'timeBlocks=', timeBlocks);
        
        return {
          name: String(row[idxName]),
          class: String(row[idxClass]),
          weekday: Number(row[idxWeekday]),
          isTheory,
          periods,
          weekType,
          timeBlocks
        };
      });
      // 新增整体json调试日志
      console.log('[Excel解析] 最终拼接出的json数组:', JSON.stringify(json, null, 2));
      const res = await fetch(`${apiUrl}/api/upload-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "excel_data", value: json }),
      });
      const result = await res.json();
      setMessage(result.message || "上传成功");
      antdMessage.success("上传成功");
      
      // 更新本地状态并添加到历史
      setData(json);
      addHistory(json);
      
    } catch (err) {
      setMessage("上传失败: " + (err as any).message);
      antdMessage.error("上传失败");
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
      // 创建一个新的工作簿
      const workbook = XLSX.utils.book_new();
      
      // 准备Excel数据
      const headers = [
        "姓名", "班级", "星期", "理论课", 
        "第1节", "第2节", "第3节", "第4节", "第5节", "第6节", "第7节", "第8节", 
        "单双周", "7:30-13:00", "14:00-19:00", "8:30-12:00", "14:00-17:30"
      ];
      
      const excelData = [
        headers,
        [], // 空行，与原Excel保持一致
        ...data.map(row => {
          const rowData = new Array(17).fill("");
          
          // 基础信息
          rowData[0] = row.name;
          rowData[1] = row.class;
          rowData[2] = row.weekday;
          rowData[3] = row.isTheory ? 1 : 0;
          
          // 理论课节次
          if (row.isTheory && row.periods) {
            row.periods.forEach(period => {
              rowData[3 + period] = 1;
            });
          }
          
          // 单双周
          if (!row.isTheory && row.weekType !== null) {
            rowData[12] = row.weekType ? 1 : 0;
          }
          
          // 时间段
          if (!row.isTheory && row.timeBlocks) {
            row.timeBlocks.forEach(timeBlock => {
              const index = TIME_BLOCKS.indexOf(timeBlock);
              if (index !== -1) {
                rowData[13 + index] = 1;
              }
            });
          }
          
          return rowData;
        })
      ];
      
      // 创建工作表
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      
      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, "空余时间统计");
      
      // 生成Excel文件并下载
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
    setUploading(true);
    setMessage("");
    try {
      // 创建备份
      await createBackup(data);
      
      const res = await fetch(`${apiUrl}/api/clear-kv`, { method: "POST" });
      const result = await res.json();
      setMessage(result.message || "已清空");
      antdMessage.success("已清空");
      
      // 更新本地状态并添加到历史
      const emptyData: DataRow[] = [];
      setData(emptyData);
      addHistory(emptyData);
      
    } catch (err) {
      setMessage("清空失败: " + (err as any).message);
      antdMessage.error("清空失败");
    } finally {
      setUploading(false);
    }
  };

  // 删除操作
  const handleDelete = async (idx: number) => {
    // 移除创建备份的调用，只保留实际的删除操作
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    
    // 添加到历史
    addHistory(newData);
    
    await fetch(`${apiUrl}/api/upload-excel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "excel_data", value: newData }),
    });
    antdMessage.success("删除成功");
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
  const [editWeekPeriod, setEditWeekPeriod] = useState<number[][]>([]); // 编辑时使用的星期节次
  const [editWeekTypeTimeBlock, setEditWeekTypeTimeBlock] = useState<[boolean, string][]>([]); // 编辑时使用的单双周时间段

  useEffect(() => {
    if (editModalOpen && editRow) {
      console.log('[EditModal] 打开，editRow:', editRow);
      
      // 重置编辑数据
      setEditWeekPeriod([]);
      setEditWeekTypeTimeBlock([]);
      
      // 先重置表单
      editForm.resetFields();
      
      // 然后设置表单值
      const setFields = {
        name: editRow.name,
        class: editRow.class,
        isTheory: editRow.isTheory,
        // 理论课需要设置节次
        ...(editRow.isTheory ? {
          weekday: editRow.weekday,
          periods: editRow.periods
        } : {
          // 实训课需要设置时间段和周类型
          weekType: editRow.weekType,
          timeBlocks: editRow.timeBlocks
        })
      };
      
      // 使用timeout确保DOM已更新
      setTimeout(() => {
        editForm.setFieldsValue(setFields);
      }, 0);
      
      console.log('[EditModal] setFieldsValue:', setFields);
    } else if (!editModalOpen) {
      // 关闭模态框时重置表单
      editForm.resetFields();
    }
  }, [editModalOpen, editRow, editForm]);

  // 理论/实训切换时清空互斥数据
  const handleTheorySwitch = (checked: boolean) => {
    form.setFieldValue('isTheory', checked);
    if (checked) {
      setWeekTypeTimeBlock([]);
    } else {
      setWeekPeriod([]);
    }
  };
  
  // 编辑时的理论/实训切换
  const handleEditTheorySwitch = (checked: boolean) => {
    editForm.setFieldValue('isTheory', checked);
    if (checked) {
      setEditWeekTypeTimeBlock([]);
    } else {
      setEditWeekPeriod([]);
    }
  };

  // 修改WeekPeriodTable函数，支持拖动框选功能
  function WeekPeriodTable({ value = [], onChange }: { value?: number[][], onChange?: (val: number[][]) => void }) {
    const selected = new Set((value || []).map(([w, p]) => `${w}-${p}`));
    const [isDragging, setIsDragging] = useState(false);
    const [startCell, setStartCell] = useState<{w: number, p: number} | null>(null);
    const [currentCell, setCurrentCell] = useState<{w: number, p: number} | null>(null);
    const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
    
    // 计算当前框选的单元格
    const getSelectedCellsInDrag = () => {
      if (!startCell || !currentCell) return new Set<string>();
      
      const minWeekday = Math.min(startCell.w, currentCell.w);
      const maxWeekday = Math.max(startCell.w, currentCell.w);
      const minPeriod = Math.min(startCell.p, currentCell.p);
      const maxPeriod = Math.max(startCell.p, currentCell.p);
      
      const cellsInDrag = new Set<string>();
      for (let w = minWeekday; w <= maxWeekday; w++) {
        for (let p = minPeriod; p <= maxPeriod; p++) {
          cellsInDrag.add(`${w}-${p}`);
        }
      }
      
      return cellsInDrag;
    };
    
    // 处理单元格鼠标按下事件
    const handleMouseDown = (w: number, p: number, isSelected: boolean) => {
      setIsDragging(true);
      setStartCell({w, p});
      setCurrentCell({w, p});
      setDragMode(isSelected ? 'deselect' : 'select');
    };
    
    // 处理单元格鼠标移动事件
    const handleMouseMove = (w: number, p: number) => {
      if (isDragging) {
        setCurrentCell({w, p});
      }
    };
    
    // 处理鼠标松开事件
    const handleMouseUp = () => {
      if (isDragging && startCell && currentCell && dragMode) {
        // 计算框选范围内的所有单元格
        const cellsInDrag = getSelectedCellsInDrag();
        
        // 复制当前选中状态
        let arr = value ? [...value] : [];
        
        if (dragMode === 'select') {
          // 添加框选的单元格
          cellsInDrag.forEach(key => {
            const [w, p] = key.split('-').map(Number);
            if (!selected.has(key)) {
              arr.push([w, p]);
            }
          });
        } else {
          // 移除框选的单元格
          arr = arr.filter(([w, p]) => !cellsInDrag.has(`${w}-${p}`));
        }
        
        // 更新选中状态
        onChange?.(arr);
      }
      
      // 重置拖动状态
      setIsDragging(false);
      setStartCell(null);
      setCurrentCell(null);
      setDragMode(null);
    };
    
    // 获取当前绘制的单元格视觉状态
    const getCellStyle = (w: number, p: number) => {
      const key = `${w}-${p}`;
      const isSelected = selected.has(key);
      
      if (isDragging) {
        const cellsInDrag = getSelectedCellsInDrag();
        const isInDragRange = cellsInDrag.has(key);
        
        if (isInDragRange) {
          // 如果在拖动范围内，根据拖动模式决定视觉效果
          if (dragMode === 'select') {
            return isSelected 
              ? 'bg-blue-500 text-white' // 已选中
              : 'bg-blue-300 text-white'; // 拖动时预览选中
          } else {
            return isSelected
              ? 'bg-red-300 text-white' // 拖动时预览取消选中
              : 'bg-gray-100';          // 未选中
          }
        }
      }
      
      // 正常状态
      return isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100';
    };
    
    // 阻止事件传播和默认行为
    const preventDefault = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // 添加全局鼠标事件处理
    useEffect(() => {
      if (isDragging) {
        const handleGlobalMouseUp = () => {
          handleMouseUp();
        };
        
        // 添加全局事件监听
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('mouseleave', handleGlobalMouseUp);
        
        return () => {
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          window.removeEventListener('mouseleave', handleGlobalMouseUp);
        };
      }
    }, [isDragging]);
    
    return (
      <div style={{ overflowX: 'auto' }} onMouseLeave={handleMouseUp}>
        <div className="text-xs text-gray-500 mb-1">
          提示：按住鼠标拖动可批量选择或取消选择
        </div>
        <table 
          className="border text-center select-none" 
          style={{ minWidth: 400, width: '100%' }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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
                  const key = `${w}-${p}`;
                  const isSelected = selected.has(key);
                  const cellStyle = getCellStyle(w, p);
                  
                  return (
                    <td 
                      key={w} 
                      className="p-1"
                      onMouseDown={preventDefault}
                    >
                      <button
                        type="button"
                        className={`w-7 h-7 rounded ${cellStyle} border border-blue-200 focus:outline-none transition-colors`}
                        onMouseDown={(e) => {
                          preventDefault(e);
                          handleMouseDown(w, p, isSelected);
                        }}
                        onMouseMove={() => handleMouseMove(w, p)}
                        onMouseUp={handleMouseUp}
                      >
                        {isSelected && !isDragging ? '✔' : ''}
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

  // 修改WeekTypeTimeBlockTable函数，支持拖动框选功能
  function WeekTypeTimeBlockTable({ value = [], onChange }: { value?: [boolean, string][], onChange?: (val: [boolean, string][]) => void }) {
    // 调试日志，查看传入的数据
    console.log("WeekTypeTimeBlockTable初始化:", {
      传入值: value,
      预定义的时间段: TIME_BLOCKS
    });
    
    // 创建一个映射表，用于快速查找单元格是否被选中
    const selectedMap = new Map<string, boolean>();
    
    // 转换传入值中的时间段为代码，并创建选中映射
    (value || []).forEach(([weekType, timeBlock]) => {
      // 获取时间段对应的代码
      const timeBlockCode = getTimeBlockCode(timeBlock);
      
      if (timeBlockCode) {
        const key = `${weekType ? "单周" : "双周"}-${timeBlockCode}`;
        selectedMap.set(key, true);
      } else {
        console.error(`警告: 无法识别的时间段值 "${timeBlock}"`);
      }
    });
    
    const [isDragging, setIsDragging] = useState(false);
    const [startCell, setStartCell] = useState<{wLabel: string, code: string} | null>(null);
    const [currentCell, setCurrentCell] = useState<{wLabel: string, code: string} | null>(null);
    const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
    
    // 单双周标签与布尔值的映射
    const weekTypeMap = {
      "单周": true,
      "双周": false
    };
    
    // 计算当前框选的单元格
    const getSelectedCellsInDrag = () => {
      if (!startCell || !currentCell) return new Set<string>();
      
      // 获取行索引（单周/双周）
      const weekLabels = ["单周", "双周"];
      const startRowIdx = weekLabels.indexOf(startCell.wLabel);
      const endRowIdx = weekLabels.indexOf(currentCell.wLabel);
      const minRowIdx = Math.min(startRowIdx, endRowIdx);
      const maxRowIdx = Math.max(startRowIdx, endRowIdx);
      
      // 获取列索引（时间段代码）
      const timeBlockCodes = Object.keys(TIME_BLOCK_CODES);
      const startColIdx = timeBlockCodes.indexOf(startCell.code);
      const endColIdx = timeBlockCodes.indexOf(currentCell.code);
      
      // 确保索引有效
      if (startColIdx === -1 || endColIdx === -1) {
        console.error("无效的时间段代码索引:", startCell.code, currentCell.code);
        return new Set<string>();
      }
      
      const minColIdx = Math.min(startColIdx, endColIdx);
      const maxColIdx = Math.max(startColIdx, endColIdx);
      
      // 生成所有框选的单元格键
      const cellsInDrag = new Set<string>();
      for (let rowIdx = minRowIdx; rowIdx <= maxRowIdx; rowIdx++) {
        const weekLabel = weekLabels[rowIdx];
        for (let colIdx = minColIdx; colIdx <= maxColIdx; colIdx++) {
          const code = timeBlockCodes[colIdx];
          cellsInDrag.add(`${weekLabel}-${code}`);
        }
      }
      
      return cellsInDrag;
    };
    
    // 处理单元格鼠标按下事件
    const handleMouseDown = (wLabel: string, code: string, isSelected: boolean) => {
      console.log("MouseDown点击:", {
        周类型: wLabel,
        时间段代码: code,
        完整时间段: getFullTimeBlock(code),
        已选中: isSelected
      });
      setIsDragging(true);
      setStartCell({wLabel, code});
      setCurrentCell({wLabel, code});
      setDragMode(isSelected ? 'deselect' : 'select');
    };
    
    // 处理单元格鼠标移动事件
    const handleMouseMove = (wLabel: string, code: string) => {
      if (isDragging) {
        console.log("MouseMove拖动:", {
          从: startCell ? `${startCell.wLabel}-${startCell.code}` : "无",
          到: `${wLabel}-${code}`
        });
        setCurrentCell({wLabel, code});
      }
    };
    
    // 处理鼠标松开事件
    const handleMouseUp = () => {
      if (isDragging && startCell && currentCell && dragMode) {
        // 计算框选范围内的所有单元格
        const cellsInDrag = getSelectedCellsInDrag();
        console.log("框选结果:", {
          模式: dragMode === 'select' ? '选中' : '取消选中',
          开始单元格: startCell ? `${startCell.wLabel}-${startCell.code}` : "无",
          结束单元格: currentCell ? `${currentCell.wLabel}-${currentCell.code}` : "无",
          框选单元格: Array.from(cellsInDrag),
          当前已选中: Array.from(selectedMap.keys())
        });
        
        // 复制当前选中状态
        let newValue = [...(value || [])];
        
        if (dragMode === 'select') {
          // 添加框选的单元格
          const added: string[] = [];
          
          cellsInDrag.forEach(key => {
            const [weekLabel, code] = key.split('-');
            
            // 通过代码获取完整时间段
            const fullTimeBlock = getFullTimeBlock(code);
            if (fullTimeBlock) {
              // 如果此单元格未被选中，则添加到选中列表
              if (!selectedMap.has(key)) {
                const weekType = weekTypeMap[weekLabel as keyof typeof weekTypeMap];
                newValue.push([weekType, fullTimeBlock]);
                added.push(key);
              }
            } else {
              console.error(`错误: 无效的时间段代码 "${code}"`);
            }
          });
          
          console.log("添加的单元格:", added);
        } else {
          // 移除框选的单元格
          const before = newValue.length;
          newValue = newValue.filter(([weekType, timeBlock]) => {
            const code = getTimeBlockCode(timeBlock);
            if (!code) return true; // 保留无法识别的时间段
            
            const key = `${weekType ? "单周" : "双周"}-${code}`;
            return !cellsInDrag.has(key);
          });
          const removed = before - newValue.length;
          
          console.log("移除的单元格数量:", removed);
        }
        
        // 调试日志
        console.log("最终选中状态:", newValue.map(([weekType, timeBlock]) => ({
          周类型: weekType ? "单周" : "双周",
          时间段: timeBlock,
          代码: getTimeBlockCode(timeBlock)
        })));
        
        // 更新选中状态
        onChange?.(newValue);
      }
      
      // 重置拖动状态
      setIsDragging(false);
      setStartCell(null);
      setCurrentCell(null);
      setDragMode(null);
    };
    
    // 获取当前绘制的单元格视觉状态
    const getCellStyle = (wLabel: string, code: string) => {
      const key = `${wLabel}-${code}`;
      const isSelected = selectedMap.has(key);
      
      if (isDragging) {
        const cellsInDrag = getSelectedCellsInDrag();
        const isInDragRange = cellsInDrag.has(key);
        
        if (isInDragRange) {
          // 如果在拖动范围内，根据拖动模式决定视觉效果
          if (dragMode === 'select') {
            return isSelected 
              ? 'bg-blue-500 text-white' // 已选中
              : 'bg-blue-300 text-white'; // 拖动时预览选中
          } else {
            return isSelected
              ? 'bg-red-300 text-white' // 拖动时预览取消选中
              : 'bg-gray-100';          // 未选中
          }
        }
      }
      
      // 正常状态
      return isSelected ? 'bg-blue-500 text-white' : 'bg-gray-100';
    };
    
    // 阻止事件传播和默认行为
    const preventDefault = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    // 添加全局鼠标事件处理
    useEffect(() => {
      if (isDragging) {
        const handleGlobalMouseUp = () => {
          handleMouseUp();
        };
        
        // 添加全局事件监听
        window.addEventListener('mouseup', handleGlobalMouseUp);
        window.addEventListener('mouseleave', handleGlobalMouseUp);
        
        return () => {
          window.removeEventListener('mouseup', handleGlobalMouseUp);
          window.removeEventListener('mouseleave', handleGlobalMouseUp);
        };
      }
    }, [isDragging]);
    
    const weekLabels = ["单周", "双周"];
    const timeBlockCodes = Object.keys(TIME_BLOCK_CODES);
    
    return (
      <div style={{ overflowX: 'auto' }} onMouseLeave={handleMouseUp}>
        <div className="text-xs text-gray-500 mb-1">
          提示：按住鼠标拖动可批量选择或取消选择
        </div>
        <table 
          className="border text-center select-none" 
          style={{ minWidth: 400, width: '100%' }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <thead>
            <tr>
              <th></th>
              {timeBlockCodes.map((code, idx) => (
                <th key={`head-${idx}-${code}`}>{getFullTimeBlock(code)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekLabels.map((wLabel, rowIdx) => {
              // 输出调试日志，显示当前行对应的选中状态
              const rowSelectedCells = Array.from(selectedMap.keys())
                .filter(key => key.startsWith(wLabel))
                .map(key => key.split('-')[1]);
              
              console.log(`渲染 ${wLabel} 行:`, {
                选中的时间段代码: rowSelectedCells,
                对应时间段: rowSelectedCells.map(code => getFullTimeBlock(code))
              });
              
              return (
                <tr key={`row-${rowIdx}-${wLabel}`}>
                  <td className="font-bold">{wLabel}</td>
                  {timeBlockCodes.map((code, colIdx) => {
                    const key = `${wLabel}-${code}`;
                    const isSelected = selectedMap.has(key);
                    const cellStyle = getCellStyle(wLabel, code);
                    
                    return (
                      <td 
                        key={`cell-${rowIdx}-${colIdx}-${code}`}
                        className="p-1"
                        onMouseDown={preventDefault}
                      >
                        <button
                          type="button"
                          className={`w-16 h-7 rounded ${cellStyle} border border-blue-200 focus:outline-none transition-colors`}
                          onMouseDown={(e) => {
                            preventDefault(e);
                            handleMouseDown(wLabel, code, isSelected);
                          }}
                          onMouseMove={() => handleMouseMove(wLabel, code)}
                          onMouseUp={handleMouseUp}
                        >
                          {isSelected && !isDragging ? '✓' : ''}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
      
      // 保持不变的数据
      const baseData = {
        name: values.name,
        class: values.class,
        isTheory: data[editIdx].isTheory,
      };
      
      let newRow: DataRow;
      
      if (baseData.isTheory) {
        // 理论课 - 只能编辑节次，不能修改星期
        if (!values.periods || values.periods.length === 0) {
          antdMessage.error("请至少选择一个节次");
          return;
        }
        
        newRow = {
          ...baseData,
          weekday: data[editIdx].weekday, // 保持星期不变
          periods: values.periods.map(Number).sort((a: number, b: number) => a - b),
          weekType: null,
          timeBlocks: []
        };
      } else {
        // 实训课 - 只能编辑时间段，不能修改单双周
        if (!values.timeBlocks || values.timeBlocks.length === 0) {
          antdMessage.error("请至少选择一个时间段");
          return;
        }
        
        // 验证并确保时间段格式正确
        const validTimeBlocks: string[] = [];
        for (const timeBlock of values.timeBlocks) {
          if (TIME_BLOCKS.includes(timeBlock)) {
            validTimeBlocks.push(timeBlock);
          } else {
            // 尝试匹配完整时间段
            const matchedTimeBlock = TIME_BLOCKS.find(tb => tb.startsWith(timeBlock));
            if (matchedTimeBlock) {
              console.log(`编辑时修复时间段: 从 "${timeBlock}" 到 "${matchedTimeBlock}"`);
              validTimeBlocks.push(matchedTimeBlock);
            } else {
              antdMessage.error(`无效的时间段: ${timeBlock}`);
              return;
            }
          }
        }
        
        newRow = {
          ...baseData,
          weekday: 0,
          periods: [],
          weekType: data[editIdx].weekType, // 保持单双周不变
          timeBlocks: validTimeBlocks
        };
      }
      
      console.log("编辑后的数据:", JSON.stringify(newRow, null, 2));
      
      const newData = [...data];
      newData[editIdx] = newRow;
      setData(newData);
      
      // 添加到历史
      addHistory(newData);
      
      setEditModalOpen(false);
      setEditRow(null);
      setEditIdx(null);
      
      await fetch(`${apiUrl}/api/upload-excel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "excel_data", value: newData }),
      });
      
      antdMessage.success("修改成功");
    } catch (err) {
      console.error("保存失败:", err);
      antdMessage.error("保存失败");
    }
  };

  // 保存时拆分多条数据写入（仅用于新增）
  const handleEditSaveWithCustom = async () => {
    try {
      const values = await form.validateFields();
      if (addModalOpen) {
        // 创建更灵活的数据结构
        const formData = {
          name: values.name,
          class: values.class
        };
        
        let newRows: DataRow[] = [];
        
        if (values.isTheory) {
          // 理论课处理
          if (!weekPeriod.length) {
            antdMessage.error("请至少选择一个星期+节次组合");
            return;
          }
          
          // 按星期分组合并节次
          const weekdayPeriods: Record<number, number[]> = {};
          for (const [weekday, period] of weekPeriod) {
            if (!weekdayPeriods[weekday]) {
              weekdayPeriods[weekday] = [];
            }
            weekdayPeriods[weekday].push(period);
          }
          
          // 为每个星期创建一个包含所有节次的记录
          for (const [weekday, periods] of Object.entries(weekdayPeriods)) {
            newRows.push({
              ...formData,
              weekday: Number(weekday),
              isTheory: true,
              periods: periods.sort((a, b) => a - b), // 确保节次按顺序排列
              weekType: null,
              timeBlocks: []
            });
          }
        } else {
          // 实训课处理
          if (!weekTypeTimeBlock.length) {
            antdMessage.error("请至少选择一个单双周+时间段组合");
            return;
          }
          
          // 按单双周分组合并时间段
          const weekTypeBlocks: Record<string, string[]> = {
            'true': [], // 单周
            'false': [] // 双周
          };
          
          for (const [weekType, timeBlock] of weekTypeTimeBlock) {
            // 验证时间段格式
            if (!TIME_BLOCKS.includes(timeBlock)) {
              console.error(`保存时发现无效时间段: ${timeBlock}`);
              // 尝试找到与之匹配的完整时间段
              const matchedTimeBlock = TIME_BLOCKS.find(tb => tb.startsWith(timeBlock));
              if (matchedTimeBlock) {
                console.log(`自动修复时间段: 从 "${timeBlock}" 到 "${matchedTimeBlock}"`);
                weekTypeBlocks[String(weekType)].push(matchedTimeBlock);
              } else {
                antdMessage.error(`无效的时间段: ${timeBlock}`);
                return;
              }
            } else {
              weekTypeBlocks[String(weekType)].push(timeBlock);
            }
          }
          
          // 为每种周类型创建一个包含所有时间段的记录
          for (const [weekTypeStr, blocks] of Object.entries(weekTypeBlocks)) {
            if (blocks.length > 0) {
              newRows.push({
                ...formData,
                weekday: 0,
                isTheory: false,
                periods: [],
                weekType: weekTypeStr === 'true',
                timeBlocks: blocks
              });
            }
          }
        }
        
        console.log("新增数据:", JSON.stringify(newRows, null, 2));
        
        // 将新数据添加到数组顶部
        const newData = [...newRows, ...data];
        setData(newData);
        
        // 添加到历史
        addHistory(newData);
        
        setAddModalOpen(false);
        await fetch(`${apiUrl}/api/upload-excel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "excel_data", value: newData }),
        });
        antdMessage.success("新增成功");
      }
    } catch (err) {
      console.error("保存失败:", err);
      antdMessage.error("保存失败");
    }
  };

  const menuItems = [
    { key: "upload", label: "数据上传" },
    { key: "manage", label: "数据管理" },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isNarrow && (
        <Sider width={200} style={{ 
          background: "#fff", 
          boxShadow: "2px 0 8px #f0f1f2", 
          display: "flex", 
          flexDirection: "column", 
          height: "100vh", 
          position: "fixed", 
          left: 0,
          top: 0,
          overflowY: "auto"
        }}>
          <div className="text-2xl font-bold text-center py-6 text-blue-700 tracking-wide select-none">控制台</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={e => setSelectedKey(e.key as string)}
            items={menuItems}
            style={{ 
              flex: 1, 
              borderRight: 0, 
              fontSize: 16, 
              overflowY: "auto",
              height: "calc(100vh - 170px)" // 减去顶部文字和底部注销按钮的高度
            }}
          />
          <div className="mt-auto py-4 px-4 bg-white" style={{boxShadow: "0 -2px 8px rgba(0,0,0,0.05)"}}>
            <UserMenu />
          </div>
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
              style={{ 
                flex: 1, 
                borderRight: 0, 
                fontSize: 16,
                overflowY: "auto",
                height: "calc(100vh - 170px)"
              }}
            />
            <div className="mt-auto py-4 px-4 bg-white" style={{boxShadow: "0 -2px 8px rgba(0,0,0,0.05)"}}>
              <UserMenu />
            </div>
          </Drawer>
        </>
      )}
      <Layout>        
        <Content style={{ 
          margin: "32px 32px 32px", 
          marginLeft: isNarrow ? "32px" : "232px", // 非窄屏时为侧边栏留出空间 (200px宽度 + 32px外边距)
          background: "#f8fafc", 
          borderRadius: 16, 
          boxShadow: "0 2px 16px #e6e6e6", 
          minHeight: 600, 
          padding: 32 
        }}>
          {isNarrow ? (
            <>
              {/* 移除多余的顶部操作栏，在各面板内集成操作按钮 */}
              {selectedKey === "upload" && (
                <UploadPanel
                  uploading={uploading}
                  message={message}
                  onFileChange={handleFileChange}
                  onClear={handleClear}
                  historyButtons={
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs flex items-center">
                        <span className="hidden sm:inline">历史：</span>
                        <span>{historyIndex + 1}/{history.length}</span>
                      </div>
                      <AntdButton 
                        type="default" 
                        icon={<UndoOutlined />} 
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        size="small"
                      />
                      <AntdButton 
                        type="default" 
                        icon={<RedoOutlined />} 
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        size="small"
                      />
                      <AntdButton 
                        icon={<DownloadOutlined />} 
                        onClick={downloadAsExcel}
                        disabled={data.length === 0}
                      />
                    </div>
                  }
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
                  historyButtons={
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs flex items-center">
                        <span className="hidden sm:inline">历史：</span>
                        <span>{historyIndex + 1}/{history.length}</span>
                      </div>
                      <AntdButton 
                        type="default" 
                        icon={<UndoOutlined />} 
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        size="small"
                      />
                      <AntdButton 
                        type="default" 
                        icon={<RedoOutlined />} 
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        size="small"
                      />
                      <AntdButton 
                        icon={<DownloadOutlined />} 
                        onClick={downloadAsExcel}
                        disabled={data.length === 0}
                      />
                    </div>
                  }
                />
              )}
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px #e6e6e6', padding: 32, minHeight: 500 }}>
              {/* 移除多余的顶部操作栏 */}
              
              {selectedKey === "upload" && (
                <UploadPanel
                  uploading={uploading}
                  message={message}
                  onFileChange={handleFileChange}
                  onClear={handleClear}
                  historyButtons={
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs flex items-center">
                        <span className="hidden sm:inline">历史：</span>
                        <span>{historyIndex + 1}/{history.length}</span>
                      </div>
                      <AntdButton 
                        type="default" 
                        icon={<UndoOutlined />} 
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        size="small"
                      />
                      <AntdButton 
                        type="default" 
                        icon={<RedoOutlined />} 
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        size="small"
                      />
                      <AntdButton 
                        icon={<DownloadOutlined />} 
                        onClick={downloadAsExcel}
                        disabled={data.length === 0}
                      />
                    </div>
                  }
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
                  historyButtons={
                    <div className="flex items-center space-x-2">
                      <div className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs flex items-center">
                        <span className="hidden sm:inline">历史：</span>
                        <span>{historyIndex + 1}/{history.length}</span>
                      </div>
                      <AntdButton 
                        type="default" 
                        icon={<UndoOutlined />} 
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        size="small"
                      />
                      <AntdButton 
                        type="default" 
                        icon={<RedoOutlined />} 
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        size="small"
                      />
                      <AntdButton 
                        icon={<DownloadOutlined />} 
                        onClick={downloadAsExcel}
                        disabled={data.length === 0}
                      />
                    </div>
                  }
                />
              )}
            </div>
          )}
        </Content>
      </Layout>
      <Modal open={addModalOpen} onCancel={handleAddCancel} onOk={handleEditSaveWithCustom} title="批量新增数据" width={600} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ isTheory: false }}>
          <Form.Item name="name" label={<label htmlFor="add-name">姓名</label>} rules={[{ required: true, message: '请输入姓名' }]}>
            <Input id="add-name" autoComplete="off" placeholder="请输入教师姓名" />
          </Form.Item>
          <Form.Item name="class" label={<label htmlFor="add-class">班级</label>} rules={[{ required: true, message: '请输入班级' }]}>
            <Input id="add-class" autoComplete="off" placeholder="请输入班级名称" />
          </Form.Item>
          <Form.Item name="isTheory" label="课程类型" valuePropName="checked">
            <Switch 
              checkedChildren="理论课" 
              unCheckedChildren="实训课" 
              onChange={handleTheorySwitch} 
            />
          </Form.Item>
          
          {form.getFieldValue('isTheory') ? (
            <div className="bg-blue-50 p-4 rounded mb-4">
              <div className="text-blue-700 mb-2 font-semibold">理论课说明：</div>
              <p className="text-sm mb-2">当选择多个星期和节次时，系统会按星期分组，为每个星期创建一条包含所选节次的记录</p>
              <Form.Item label="星期+节次" className="mt-2">
                <WeekPeriodTable value={weekPeriod} onChange={setWeekPeriod} />
              </Form.Item>
            </div>
          ) : (
            <div className="bg-green-50 p-4 rounded mb-4">
              <div className="text-green-700 mb-2 font-semibold">实训课说明：</div>
              <p className="text-sm mb-2">当选择多个单双周和时间段时，系统会按单双周分组，为每种周类型创建一条包含所选时间段的记录</p>
              <Form.Item label="单双周+时间段" className="mt-2">
                <WeekTypeTimeBlockTable value={weekTypeTimeBlock} onChange={setWeekTypeTimeBlock} />
              </Form.Item>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-gray-500 text-sm">注：添加的数据将显示在数据列表的最前面</div>
          </div>
        </Form>
      </Modal>
      <Modal open={editModalOpen} onCancel={handleEditCancel} onOk={handleEditSaveSingle} title="编辑数据" width={450} destroyOnHidden>
        <Form 
          form={editForm} 
          layout="vertical"
          initialValues={{ 
            name: editRow?.name || '',
            class: editRow?.class || '',
            isTheory: editRow?.isTheory || false,
            periods: editRow?.periods || [],
            timeBlocks: editRow?.timeBlocks || []
          }}
        >
          <Form.Item name="name" label="姓名">
            <Input autoComplete="off" disabled />
          </Form.Item>
          <Form.Item name="class" label="班级">
            <Input autoComplete="off" disabled />
          </Form.Item>
          
          {/* 显示课程类型，但不可编辑 */}
          <Form.Item label="课程类型">
            <Input value={editRow?.isTheory ? '理论课' : '实训课'} disabled />
          </Form.Item>
          
          {editRow?.isTheory ? (
            <>
              {/* 理论课 - 显示星期但不可编辑 */}
              <Form.Item label="星期">
                <Input 
                  value={editRow ? `周${['一','二','三','四','五'][editRow.weekday - 1]}` : ''} 
                  disabled 
                />
              </Form.Item>
              
              {/* 理论课 - 只能编辑节次 */}
              <Form.Item 
                name="periods" 
                label="节次" 
                rules={[{ required: true, message: '请选择节次' }]}
              >
                <Select mode="multiple" placeholder="请选择节次">
                  {PERIODS.map(p => (
                    <Select.Option key={p} value={p}>{p}节</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              {/* 实训课 - 显示单双周但不可编辑 */}
              <Form.Item label="周类型">
                <Input value={editRow?.weekType ? '单周' : '双周'} disabled />
              </Form.Item>
              
              {/* 实训课 - 只能编辑时间段 */}
              <Form.Item 
                name="timeBlocks" 
                label="时间段" 
                rules={[{ required: true, message: '请选择时间段' }]}
              >
                <Select mode="multiple" placeholder="请选择时间段">
                  {TIME_BLOCKS.map(tb => (
                    <Select.Option key={tb} value={tb}>{tb}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-gray-500 text-sm">注意：只能修改当前行的节次或时间段</div>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
}
