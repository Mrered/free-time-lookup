"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import { Layout, Menu, message as antdMessage, Modal, Form, Input, Switch, Select, Button as AntdButton, Tooltip } from "antd";
import UploadPanel from "../components/UploadPanel"; // 调整路径
import ManagePanel from "../components/ManagePanel"; // 调整路径
import UserMenu from "../components/UserMenu";     // 调整路径
import { UndoOutlined, RedoOutlined, DownloadOutlined, HomeOutlined, CloudUploadOutlined, DatabaseOutlined, SettingOutlined } from "@ant-design/icons";
// PlusOutlined is now primarily used within ManagePanel, can be removed if not used elsewhere in ConsolePage

const { Sider, Content } = Layout;

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

// 需要识别的时间段列名
const TIME_BLOCKS = [
  "7:30-13:00",
  "14:00-19:00",
  "8:30-12:00",
  "14:00-17:30"
];

// 时间段代码映射
const TIME_BLOCK_CODES: Record<string, string> = {
  "A1": "7:30-13:00", "A2": "14:00-19:00",
  "B1": "8:30-12:00", "B2": "14:00-17:30"
};

// 反向映射表
const TIME_BLOCK_REVERSE_MAP = Object.entries(TIME_BLOCK_CODES).reduce(
  (acc, [code, timeBlock]) => { acc[timeBlock] = code; return acc; },
  {} as Record<string, string>
);

const getFullTimeBlock = (code: string): string => TIME_BLOCK_CODES[code] || "";
const getTimeBlockCode = (timeBlock: string): string => {
  if (TIME_BLOCK_REVERSE_MAP[timeBlock]) return TIME_BLOCK_REVERSE_MAP[timeBlock];
  for (const [full, code] of Object.entries(TIME_BLOCK_REVERSE_MAP)) {
    if (full.startsWith(timeBlock)) return code;
  }
  return "";
};

const WEEKDAYS = [1, 2, 3, 4, 5];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

interface DataRow {
  name: string; class: string; weekday: number; isTheory: boolean;
  periods: number[]; weekType: boolean | null; timeBlocks: string[];
}

const TAB_KEYS = [
  { key: "home", label: "首页", icon: <HomeOutlined /> },
  { key: "upload", label: "数据上传", icon: <CloudUploadOutlined /> },
  { key: "manage", label: "数据管理", icon: <DatabaseOutlined /> },
  { key: "semester", label: "学期设置", icon: <SettingOutlined /> }
];

export default function ConsolePage() {
  const [selectedKey, setSelectedKey] = useState("manage"); // Default to manage for easier testing
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<DataRow[]>([]);
  const [history, setHistory] = useState<DataRow[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  // const [drawerOpen, setDrawerOpen] = useState(false); // Not used in current context
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<DataRow | null>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [semesterInfo, setSemesterInfo] = useState<any>(null);
  const [semesterLoading, setSemesterLoading] = useState(false);
  const [semesterForm] = Form.useForm();
  const [holidays, setHolidays] = useState<{ name: string, start: string, end: string }[]>([]);
  const [searchName, setSearchName] = useState(""); // Used as searchValue for ManagePanel
  // Backup related states are now primarily managed within ManagePanel, but ConsolePage might need to know for other purposes if any.
  // For now, we assume ManagePanel handles its own backup display and actions.

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const addHistory = (newData: DataRow[]) => {
    const dataCopy = JSON.parse(JSON.stringify(newData));
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(dataCopy);
    if (newHistory.length > 100) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    try {
      sessionStorage.setItem('temp_history', JSON.stringify(newHistory));
      sessionStorage.setItem('temp_history_index', String(newHistory.length - 1));
    } catch (e) { console.error('保存临时历史失败:', e); }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(JSON.stringify(history[newIndex])));
      sessionStorage.setItem('temp_history_index', String(newIndex));
    } else antdMessage.info('已经是最早的状态');
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setData(JSON.parse(JSON.stringify(history[newIndex])));
      sessionStorage.setItem('temp_history_index', String(newIndex));
    } else antdMessage.info('已经是最新的状态');
  };

  const createBackup = async (dataToBackup: DataRow[]) => {
    try {
      const res = await fetch(`${apiUrl}/api/create-backup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataToBackup }),
      });
      const result = await res.json();
      if (res.ok) console.log('备份成功:', result.message);
      else console.error('备份失败:', result.message);
    } catch (err) { console.error("备份时出错:", err); }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (data.length > 0) {
        console.log("[浏览器关闭] 开始保存当前数据到数据库...");
        fetch(`${apiUrl}/api/upload-excel`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "excel_data", value: data }),
          keepalive: true,
        }).catch(err => console.error("页面关闭时保存数据失败:", err));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    console.log("[页面加载] 已注册浏览器关闭事件");
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [data]);

  useEffect(() => {
    try {
      const savedHistory = sessionStorage.getItem('temp_history');
      const savedIndex = sessionStorage.getItem('temp_history_index');
      if (savedHistory && savedIndex) {
        const parsedHistory = JSON.parse(savedHistory);
        const parsedIndex = parseInt(savedIndex, 10);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0 && !isNaN(parsedIndex) && parsedHistory[parsedIndex]) {
          setHistory(parsedHistory);
          setHistoryIndex(parsedIndex);
          setData(JSON.parse(JSON.stringify(parsedHistory[parsedIndex])));
        } else if (parsedHistory.length === 0) {
            setHistory([[]]);
            setHistoryIndex(0);
            setData([]);
        }
      } else {
        fetchData();
      }
    } catch (e) { console.error('恢复临时历史失败:', e); fetchData(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    if (historyIndex !== -1 && history.length > 0 && !(history.length === 1 && history[0].length === 0) ) {
        console.log("Data/history already loaded from session storage.");
        return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" });
      const result = await res.json();
      let fetchedData: DataRow[] = [];
      if (Array.isArray(result.value)) fetchedData = result.value;
      else if (typeof result.value === "string") try { fetchedData = JSON.parse(result.value); } catch (e) { console.error("解析获取数据失败:",e); }
      setData(fetchedData);
      if (historyIndex === -1 || (history.length === 1 && history[0].length === 0) ) {
        const initialHistory = [JSON.parse(JSON.stringify(fetchedData.length > 0 ? fetchedData: []))];
        setHistory(initialHistory);
        setHistoryIndex(0);
        sessionStorage.setItem('temp_history', JSON.stringify(initialHistory));
        sessionStorage.setItem('temp_history_index', '0');
      }
    } catch (err) {
      console.error("获取数据失败:", err); setData([]);
      if (historyIndex === -1) {
         setHistory([[]]); setHistoryIndex(0);
         sessionStorage.setItem('temp_history', JSON.stringify([[]]));
         sessionStorage.setItem('temp_history_index', '0');
      }
    } finally { setLoading(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true); setMessage("");
    try {
      if (data.length > 0) await createBackup(data);
      const fileData = await file.arrayBuffer();
      const workbook = XLSX.read(fileData); const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName]; type ExcelRow = (string | number | null | undefined)[];
      const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows: ExcelRow[] = allRows.slice(2);
      const idxName = 0, idxClass = 1, idxWeekday = 2, idxTheory = 3, idxWeekType = 12;
      const periodIdxs = [4,5,6,7,8,9,10,11]; const timeBlockIdxs = [13,14,15,16];
      const json: DataRow[] = rows.filter(row => row.length > 0 && row[idxName]).map((row, rowIdx: number) => {
        const isTheory = !!row[idxTheory];
        const periods = isTheory ? periodIdxs.map((excelColIdx, internalPeriodIdx) => row[excelColIdx] ? internalPeriodIdx+1 : null).filter(v => v !== null) as number[] : [];
        let weekType = null;
        if (!isTheory) { const weekTypeValue = row[idxWeekType];
          if (weekTypeValue === 1 || weekTypeValue === "1" || String(weekTypeValue).toLowerCase() === 'true') weekType = true;
          else if (weekTypeValue === 0 || weekTypeValue === "0" || String(weekTypeValue).toLowerCase() === 'false') weekType = false;
        }
        const timeBlocks = timeBlockIdxs.map((excelColIdx, internalTimeBlockIdx) => row[excelColIdx] ? TIME_BLOCKS[internalTimeBlockIdx] : null).filter(Boolean) as string[];
        return { name: String(row[idxName]), class: String(row[idxClass]), weekday: Number(row[idxWeekday]), isTheory, periods, weekType, timeBlocks };
      });
      antdMessage.success("文件解析成功，数据已更新并在关闭浏览器时自动保存");
      setData(json); addHistory(json);
    } catch (err) { setMessage("上传失败: " + (err as Error).message); antdMessage.error("上传失败: " + (err as Error).message); }
    finally { setUploading(false); }
  };

  const downloadAsExcel = () => {
    if (data.length === 0) { antdMessage.warning("没有数据可供导出"); return; }
    try {
      const workbook = XLSX.utils.book_new();
      const headers = ["姓名", "班级", "星期", "理论课", "第1节", "第2节", "第3节", "第4节", "第5节", "第6节", "第7节", "第8节", "单双周", ...TIME_BLOCKS];
      const excelData = [headers, [], ...data.map(row => {
        const rowData = new Array(headers.length).fill("");
        rowData[0] = row.name; rowData[1] = row.class; rowData[2] = row.weekday; rowData[3] = row.isTheory ? 1 : 0;
        if (row.isTheory && row.periods) row.periods.forEach(period => { if(period >=1 && period <=8) rowData[3 + period] = 1; });
        if (!row.isTheory && row.weekType !== null) rowData[12] = row.weekType ? 1 : 0;
        if (!row.isTheory && row.timeBlocks) row.timeBlocks.forEach(timeBlock => {
          const index = TIME_BLOCKS.indexOf(timeBlock); if (index !== -1) rowData[13 + index] = 1;
        }); return rowData;
      })];
      const worksheet = XLSX.utils.aoa_to_sheet(excelData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "空余时间统计");
      const now = new Date(); const ts = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      XLSX.writeFile(workbook, `兴趣班空余时间统计_${ts}.xlsx`); antdMessage.success(`已成功导出`);
    } catch (err) { console.error("导出Excel失败:", err); antdMessage.error("导出Excel失败: " + (err as Error).message); }
  };

  const handleClear = async () => {
    Modal.confirm({
        title: '确认清空数据', content: '确定要清空所有数据吗？此操作会先备份当前数据。',
        okText: '确定清空', cancelText: '取消',
        onOk: async () => {
            setUploading(true); setMessage("");
            try { if (data.length > 0) await createBackup(data);
              antdMessage.success("本地数据已清空，将在关闭浏览器时同步");
              setData([]); addHistory([]);
            } catch (err) { setMessage("清空失败: " + (err as Error).message); antdMessage.error("清空失败: " + (err as Error).message); }
            finally { setUploading(false); }
        }
    });
  };

  const handleDelete = async (idx: number) => {
    const newData = data.filter((_, i) => i !== idx); setData(newData); addHistory(newData);
    antdMessage.success("删除成功 (将在关闭浏览器时保存)");
  };

  const handleAdd = () => { setAddModalOpen(true); form.resetFields(); setWeekPeriod([]); setWeekTypeTimeBlock([]); };
  const handleAddCancel = () => setAddModalOpen(false);

  const handleEdit = (idx: number) => {
    setEditIdx(idx); const rowToEdit = data[idx]; setEditRow(JSON.parse(JSON.stringify(rowToEdit)));
    const formValues = { name: rowToEdit.name, class: rowToEdit.class, isTheory: rowToEdit.isTheory,
        weekday: rowToEdit.isTheory ? rowToEdit.weekday : undefined, periods: rowToEdit.isTheory ? rowToEdit.periods : [],
        weekType: !rowToEdit.isTheory ? rowToEdit.weekType : null, timeBlocks: !rowToEdit.isTheory ? rowToEdit.timeBlocks : []
    }; editForm.setFieldsValue(formValues); setEditModalOpen(true);
  };
  const handleEditCancel = () => { setEditModalOpen(false); setEditRow(null); setEditIdx(null); editForm.resetFields(); };

  const [weekPeriod, setWeekPeriod] = useState<number[][]>([]);
  const [weekTypeTimeBlock, setWeekTypeTimeBlock] = useState<[boolean, string][]>([]);

  useEffect(() => {
    if (editModalOpen && editRow) {
      const setFields = { name: editRow.name, class: editRow.class, isTheory: editRow.isTheory,
        ...(editRow.isTheory ? { weekday: editRow.weekday, periods: editRow.periods } : { weekType: editRow.weekType, timeBlocks: editRow.timeBlocks })
      }; setTimeout(() => { editForm.setFieldsValue(setFields); }, 0);
    } else if (!editModalOpen) editForm.resetFields();
  }, [editModalOpen, editRow, editForm]);

  const handleTheorySwitch = (checked: boolean) => {
    form.setFieldValue('isTheory', checked);
    if (checked) { setWeekTypeTimeBlock([]); form.setFieldsValue({ weekTypeTimeBlock: [] }); }
    else { setWeekPeriod([]); form.setFieldsValue({ weekPeriod: [] }); }
  };

  function WeekPeriodTable({ value = [], onChange }: { value?: number[][], onChange?: (val: number[][]) => void }) {
    const selected = new Set((value || []).map(([w, p]) => `${w}-${p}`));
    const [isDragging, setIsDragging] = useState(false); const [startCell, setStartCell] = useState<{w: number, p: number} | null>(null);
    const [currentCell, setCurrentCell] = useState<{w: number, p: number} | null>(null); const [dragMode, setDragMode] = useState<'select' | 'deselect' | null>(null);
    const getSelectedCellsInDrag = () => { if (!startCell || !currentCell) return new Set<string>(); const minW = Math.min(startCell.w, currentCell.w), maxW = Math.max(startCell.w, currentCell.w); const minP = Math.min(startCell.p, currentCell.p), maxP = Math.max(startCell.p, currentCell.p); const cells = new Set<string>(); for (let w = minW; w <= maxW; w++) for (let p = minP; p <= maxP; p++) cells.add(`${w}-${p}`); return cells; };
    const onMouseDown = (w:number,p:number,sel:boolean) => { setIsDragging(true);setStartCell({w,p});setCurrentCell({w,p});setDragMode(sel?'deselect':'select');};
    const onMouseMove = (w:number,p:number) => { if(isDragging)setCurrentCell({w,p});};
    const onMouseUp = () => { if(isDragging&&startCell&&currentCell&&dragMode){ const cells = getSelectedCellsInDrag(); let arr = value?[...value]:[]; if(dragMode==='select')cells.forEach(k=>{const [w,p]=k.split('-').map(Number);if(!selected.has(k))arr.push([w,p]);}); else arr=arr.filter(([w,p])=>!cells.has(`${w}-${p}`)); onChange?.(arr);} setIsDragging(false);setStartCell(null);setCurrentCell(null);setDragMode(null);};
    const getStyle = (w:number,p:number) => {const k=`${w}-${p}`;const sel=selected.has(k); if(isDragging){const cells=getSelectedCellsInDrag();const inDrag=cells.has(k); if(inDrag)return dragMode==='select'?(sel?'bg-blue-500 text-white':'bg-blue-300 text-white'):(sel?'bg-red-300 text-white':'bg-gray-100');} return sel?'bg-blue-500 text-white':'bg-gray-100';};
    const prevent = (e:React.MouseEvent)=>{e.preventDefault();e.stopPropagation();};
    useEffect(()=>{if(isDragging){const up=()=>onMouseUp(); window.addEventListener('mouseup',up);window.addEventListener('mouseleave',up); return ()=>{window.removeEventListener('mouseup',up);window.removeEventListener('mouseleave',up);}};},[isDragging,value,onMouseUp]); // onMouseUp was missing from dependency array
    return (<div style={{overflowX:'auto'}} onMouseLeave={onMouseUp}><div className="text-xs text-gray-500 mb-1">提示：拖动选择</div><table className="border text-center select-none w-full" onMouseUp={onMouseUp}><thead><tr><th></th>{WEEKDAYS.map(w=><th key={w}>周{['一','二','三','四','五'][w-1]}</th>)}</tr></thead><tbody>{PERIODS.map(p=>(<tr key={p}><td className="font-bold">{p}节</td>{WEEKDAYS.map(w=>{const sel=selected.has(`${w}-${p}`);const st=getStyle(w,p);return(<td key={w} className="p-1" onMouseDown={prevent}><button type="button" className={`w-7 h-7 rounded ${st} border border-blue-200 focus:outline-none transition-colors`} onMouseDown={e=>{prevent(e);onMouseDown(w,p,sel);}} onMouseMove={()=>onMouseMove(w,p)} onMouseUp={onMouseUp}>{sel&&!isDragging?'✔':''}</button></td>);})}</tr>))}</tbody></table></div>);
  }

  function WeekTypeTimeBlockTable({ value = [], onChange }: { value?: [boolean, string][], onChange?: (val: [boolean, string][]) => void }) {
    const selMap = new Map<string,boolean>(); (value||[]).forEach(([wt,tb])=>{const tc=getTimeBlockCode(tb);if(tc)selMap.set(`${wt?"单周":"双周"}-${tc}`,true);});
    const [drag,setDrag]=useState(false);const [start,setStart]=useState<{lbl:string,code:string}|null>(null); const [curr,setCurr]=useState<{lbl:string,code:string}|null>(null); const [mode,setMode]=useState<'select'|'deselect'|null>(null);
    const wtMap:Record<string,boolean>={"单周":true,"双周":false}; const lbls=["单周","双周"]; const codes=Object.keys(TIME_BLOCK_CODES);
    const getCellsInDrag=()=>{if(!start||!curr)return new Set<string>(); const rS=lbls.indexOf(start.lbl),rE=lbls.indexOf(curr.lbl);const minR=Math.min(rS,rE),maxR=Math.max(rS,rE); const cS=codes.indexOf(start.code),cE=codes.indexOf(curr.code);if(cS===-1||cE===-1)return new Set<string>(); const minC=Math.min(cS,cE),maxC=Math.max(cS,cE); const cells=new Set<string>();for(let r=minR;r<=maxR;r++)for(let c=minC;c<=maxC;c++)cells.add(`${lbls[r]}-${codes[c]}`); return cells;};
    const onMouseDown=(lbl:string,code:string,sel:boolean)=>{setDrag(true);setStart({lbl,code});setCurr({lbl,code});setMode(sel?'deselect':'select');};
    const onMouseMove=(lbl:string,code:string)=>{if(drag)setCurr({lbl,code});};
    const onMouseUp=()=>{if(drag&&start&&curr&&mode){const cells=getCellsInDrag();let newVal=[...(value||[])]; if(mode==='select')cells.forEach(k=>{const [lbl,c]=k.split('-');const ftb=getFullTimeBlock(c);if(ftb&&!selMap.has(k)){newVal.push([wtMap[lbl],ftb]);}}); else newVal=newVal.filter(([wt,tb])=>{const c=getTimeBlockCode(tb);if(!c)return true; return !cells.has(`${wt?"单周":"双周"}-${c}`);}); onChange?.(newVal);} setDrag(false);setStart(null);setCurr(null);setMode(null);};
    const getStyle=(lbl:string,code:string)=>{const k=`${lbl}-${code}`;const sel=selMap.has(k);if(drag){const cells=getCellsInDrag();const inDrag=cells.has(k);if(inDrag)return mode==='select'?(sel?'bg-blue-500 text-white':'bg-blue-300 text-white'):(sel?'bg-red-300 text-white':'bg-gray-100');} return sel?'bg-blue-500 text-white':'bg-gray-100';};
    const prevent=(e:React.MouseEvent)=>{e.preventDefault();e.stopPropagation();};
    useEffect(()=>{if(drag){const up=()=>onMouseUp();window.addEventListener('mouseup',up);window.addEventListener('mouseleave',up);return ()=>{window.removeEventListener('mouseup',up);window.removeEventListener('mouseleave',up);}}; },[drag,value,onMouseUp]); // onMouseUp was missing
    return(<div style={{overflowX:'auto'}} onMouseLeave={onMouseUp}><div className="text-xs text-gray-500 mb-1">提示：拖动选择</div><table className="border text-center select-none w-full" onMouseUp={onMouseUp}><thead><tr><th></th>{codes.map(c=><th key={c}>{getFullTimeBlock(c)}</th>)}</tr></thead><tbody>{lbls.map(lbl=>(<tr key={lbl}><td className="font-bold">{lbl}</td>{codes.map(c=>{const sel=selMap.has(`${lbl}-${c}`);const st=getStyle(lbl,c); return(<td key={c} className="p-1" onMouseDown={prevent}><button type="button" className={`w-24 h-7 rounded ${st} border text-xs`} onMouseDown={e=>{prevent(e);onMouseDown(lbl,c,sel);}} onMouseMove={()=>onMouseMove(lbl,c)} onMouseUp={onMouseUp}>{sel&&!drag?'✓':''}</button></td>);})}</tr>))}</tbody></table></div>);
  }

  const handleEditSaveSingle = async () => {
    try { const values = await editForm.validateFields(); if (editIdx === null || !editRow) return;
      const base = { name: editRow.name, class: editRow.class, isTheory: editRow.isTheory }; let newR: DataRow;
      if (base.isTheory) { if (!values.periods?.length) { antdMessage.error("理论课请选节次"); return; } newR = { ...base, weekday: editRow.weekday, periods: values.periods.map(Number).sort((a:number,b:number)=>a-b), weekType: null, timeBlocks: [] };
      } else { if (!values.timeBlocks?.length) { antdMessage.error("实训课请选时间段"); return; } const vTBs:string[]=[]; for(const tb of values.timeBlocks){if(TIME_BLOCKS.includes(tb))vTBs.push(tb);else{const mtb=TIME_BLOCKS.find(t=>t.startsWith(tb)); if(mtb)vTBs.push(mtb);else{antdMessage.error(`无效时段: ${tb}`);return;}}} newR = { ...base, weekday:0, periods:[], weekType: editRow.weekType, timeBlocks:vTBs }; }
      const newData = [...data]; newData[editIdx] = newR; setData(newData); addHistory(newData);
      setEditModalOpen(false); setEditRow(null); setEditIdx(null); antdMessage.success("修改成功 (将自动保存)");
    } catch (e) { console.error("保存失败:", e); antdMessage.error("保存失败"); }
  };

  const handleAddSave = async () => {
    try { const values = await form.validateFields(); const formD = { name: values.name, class: values.class }; let newRs: DataRow[] = [];
      if (values.isTheory) { if (!weekPeriod.length) { antdMessage.error("理论课选星期+节次"); return; } const wdP:Record<number,number[]>={}; for(const [wd,p] of weekPeriod){if(!wdP[wd])wdP[wd]=[];wdP[wd].push(p);} for(const [wd,ps] of Object.entries(wdP))newRs.push({...formD,weekday:Number(wd),isTheory:true,periods:ps.sort((a,b)=>a-b),weekType:null,timeBlocks:[]});
      } else { if (!weekTypeTimeBlock.length) { antdMessage.error("实训课选单双周+时段"); return; } const grp:Record<string,string[]>={'true':[],'false':[]}; for(const [wtB,tb]of weekTypeTimeBlock){const wtS=String(wtB);if(!TIME_BLOCKS.includes(tb)){const mtb=TIME_BLOCKS.find(t=>t.startsWith(tb));if(mtb)grp[wtS].push(mtb);else{antdMessage.error(`无效时段:${tb}`);return;}}else grp[wtS].push(tb);} if(grp['true'].length>0)newRs.push({...formD,weekday:0,isTheory:false,periods:[],weekType:true,timeBlocks:grp['true']}); if(grp['false'].length>0)newRs.push({...formD,weekday:0,isTheory:false,periods:[],weekType:false,timeBlocks:grp['false']});}
      setData([...newRs, ...data]); addHistory([...newRs, ...data]); setAddModalOpen(false); antdMessage.success("新增成功 (将自动保存)");
    } catch (e) { console.error("保存失败:", e); antdMessage.error("保存失败"); }
  };

  const handleDataChangeFromManagePanel = (newDataFP: DataRow[]) => { setData(newDataFP); addHistory(newDataFP); antdMessage.success("数据已从备份恢复!"); };

  const fetchSemesterInfo = async () => {
    setSemesterLoading(true);
    try {
      const res = await fetch("/api/semester", { method: "GET" });
      const result = await res.json();
      if (result.value) {
        setSemesterInfo(result.value);
        semesterForm.setFieldsValue(result.value);
        setHolidays(result.value.holidays || []);
      }
    } catch (e) {
      antdMessage.error("获取学期信息失败");
    } finally {
      setSemesterLoading(false);
    }
  };
  useEffect(() => {
    if (selectedKey === "semester") fetchSemesterInfo();
  }, [selectedKey, semesterForm]);

  const handleSemesterSave = async () => {
    try {
      const values = await semesterForm.validateFields();
      const body = { ...values, holidays };
      const res = await fetch("/api/semester", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await res.json();
      if (res.ok) {
        antdMessage.success("保存成功");
        setSemesterInfo(body);
      } else {
        antdMessage.error(result.message || "保存失败");
      }
    } catch (e) {
      antdMessage.error("请检查表单内容");
    }
  };
  const handleAddHoliday = () => setHolidays([...holidays, { name: "", start: "", end: "" }]);
  const handleHolidayChange = (idx: number, field: string, value: string) => {
    const newHolidays = holidays.map((h, i) => i === idx ? { ...h, [field]: value } : h);
    setHolidays(newHolidays);
  };
  const handleDeleteHoliday = (idx: number) => setHolidays(holidays.filter((_, i) => i !== idx));

  const handleMenuClick = (e: any) => {
    if (e.key === "home") {
      window.location.href = "/";
    } else {
      setSelectedKey(e.key as string);
    }
  };

  const filteredData = useMemo(() => {
    if (!searchName.trim()) return data;
    return data.filter(row => row.name.includes(searchName.trim()));
  }, [data, searchName]);

  // Construct history buttons to pass to ManagePanel
  const historyButtonsProp = (
    <>
      <AntdButton icon={<UndoOutlined />} onClick={handleUndo} disabled={historyIndex <= 0} size="large" title="撤销" />
      <AntdButton icon={<RedoOutlined />} onClick={handleRedo} disabled={historyIndex >= history.length - 1} size="large" title="恢复" />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={isNarrow}
        onCollapse={setIsNarrow}
        width={isNarrow ? 60 : 200}
        style={{
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          padding: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 10
        }}
        trigger={null}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onClick={handleMenuClick}
            items={TAB_KEYS}
            style={{ flex: 1, minHeight: 0 }}
            className="border-r-0 text-base overflow-y-auto"
          />
          <div className="py-4 px-4 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)]">
            <UserMenu />
          </div>
        </div>
      </Sider>
      <Layout style={{ marginLeft: isNarrow ? 60 : 200 }}>
        <Content className="p-4 sm:p-8 bg-slate-50 rounded-lg sm:rounded-2xl shadow-lg min-h-[calc(100vh-4rem)] sm:min-h-[600px] my-4 sm:my-8 mx-4 sm:mx-8">
          {/* The control bar is now handled by ManagePanel itself */}
          {selectedKey === "upload" && <UploadPanel uploading={uploading} message={message} onFileChange={handleFileChange} onClear={handleClear} />}
          {selectedKey === "manage" && (
            <ManagePanel
              data={filteredData}
              loading={loading}
              onAdd={handleAdd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDataChange={handleDataChangeFromManagePanel} // For backup restore
              editModalOpen={editModalOpen}
              editRow={editRow}
              onEditModalClose={handleEditCancel}
              onEditSave={handleEditSaveSingle}
              form={editForm} // This is the editForm for the edit modal
              historyButtons={historyButtonsProp} // Pass the Undo/Redo buttons
              page={page}
              pageSize={pageSize}
              setPage={setPage}
              setPageSize={setPageSize}
              searchValue={searchName}
              onSearchChange={setSearchName}
              onDownload={downloadAsExcel}
              isDownloadDisabled={data.length === 0}
            />
          )}
          {selectedKey === "semester" && (
            <div className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
              <div className="text-2xl font-bold mb-4 text-blue-700">学期设置</div>
              <Form form={semesterForm} layout="vertical" initialValues={semesterInfo || {}}>
                <Form.Item name="year" label="学年" rules={[{ required: true, message: '请输入学年' }]}><Input placeholder="如 2024" /></Form.Item>
                <Form.Item name="semester" label="学期" rules={[{ required: true, message: '请输入学期' }]}><Select placeholder="请选择"><Select.Option value="春季">春季</Select.Option><Select.Option value="秋季">秋季</Select.Option></Select></Form.Item>
                <Form.Item name="firstMonday" label="第一周周一日期" rules={[{ required: true, message: '请选择日期' }]}><Input type="date" /></Form.Item>
                <div className="mt-6 mb-2 font-semibold text-blue-600">法定节假日</div>
                {holidays.map((h, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center flex-wrap">
                    <Input style={{ width: 120, minWidth: 100, flexGrow:1 }} placeholder="节假日名称" value={h.name} onChange={e => handleHolidayChange(idx, 'name', e.target.value)} />
                    <Input type="date" style={{ width: 140, minWidth: 120, flexGrow:1 }} value={h.start} onChange={e => handleHolidayChange(idx, 'start', e.target.value)} />
                    <span className="mx-1">至</span>
                    <Input type="date" style={{ width: 140, minWidth: 120, flexGrow:1 }} value={h.end} onChange={e => handleHolidayChange(idx, 'end', e.target.value)} />
                    <AntdButton danger type="text" onClick={() => handleDeleteHoliday(idx)}>删除</AntdButton>
                  </div>
                ))}
                <AntdButton type="dashed" onClick={handleAddHoliday} className="mb-4 w-full sm:w-auto">添加节假日</AntdButton>
                <div className="mt-6">
                  <AntdButton type="primary" onClick={handleSemesterSave} loading={semesterLoading}>保存设置</AntdButton>
                </div>
              </Form>
            </div>
          )}
        </Content>
      </Layout>
      <Modal open={addModalOpen} onCancel={handleAddCancel} onOk={handleAddSave} title="批量新增" width={600} destroyOnClose><Form form={form} layout="vertical" initialValues={{isTheory:false}}><Form.Item name="name" label="姓名" rules={[{required:true}]}><Input placeholder="学生姓名"/></Form.Item><Form.Item name="class" label="班级" rules={[{required:true}]}><Input placeholder="班级名称"/></Form.Item><Form.Item name="isTheory" label="课程类型" valuePropName="checked"><Switch checkedChildren="理论" unCheckedChildren="实训" onChange={handleTheorySwitch}/></Form.Item>{form.getFieldValue('isTheory')?(<div className="bg-blue-50 p-4 rounded mb-4"><div className="text-blue-700 font-semibold mb-2">理论课</div><p className="text-sm mb-2">按星期分组创建记录</p><Form.Item label="星期+节次" name="weekPeriod" rules={[{validator:async()=>(weekPeriod.length>0?Promise.resolve():Promise.reject('选星期+节次'))}]}><WeekPeriodTable value={weekPeriod} onChange={setWeekPeriod}/></Form.Item></div>):(<div className="bg-green-50 p-4 rounded mb-4"><div className="text-green-700 font-semibold mb-2">实训课</div><p className="text-sm mb-2">按单双周分组创建记录</p><Form.Item label="单双周+时段" name="weekTypeTimeBlock" rules={[{validator:async()=>(weekTypeTimeBlock.length>0?Promise.resolve():Promise.reject('选单双周+时段'))}]}><WeekTypeTimeBlockTable value={weekTypeTimeBlock} onChange={setWeekTypeTimeBlock}/></Form.Item></div>)}<div className="mt-4 pt-4 border-t"><div className="text-gray-500 text-sm">注: 新数据添加在列表顶部</div></div></Form></Modal>
      <Modal open={editModalOpen} onCancel={handleEditCancel} onOk={handleEditSaveSingle} title="编辑" width={450} destroyOnClose><Form form={editForm} layout="vertical"><Form.Item name="name" label="姓名"><Input disabled/></Form.Item><Form.Item name="class" label="班级"><Input disabled/></Form.Item><Form.Item label="类型"><Input value={editRow?.isTheory?'理论':'实训'} disabled/></Form.Item>{editRow?.isTheory?(<><Form.Item label="星期"><Input value={editRow?`周${['一','二','三','四','五'][editRow.weekday-1]}`:''} disabled/></Form.Item><Form.Item name="periods" label="节次" rules={[{required:true}]}><Select mode="multiple" placeholder="选节次" allowClear className="w-full">{PERIODS.map(p=><Select.Option key={p} value={p}>{p}节</Select.Option>)}</Select></Form.Item></>):(<><Form.Item label="周类型"><Input value={editRow?.weekType===true?'单周':(editRow?.weekType===false?'双周':'未定')} disabled/></Form.Item><Form.Item name="timeBlocks" label="时间段" rules={[{required:true}]}><Select mode="multiple" placeholder="选时间段" allowClear className="w-full">{TIME_BLOCKS.map(tb=><Select.Option key={tb} value={tb}>{tb}</Select.Option>)}</Select></Form.Item></>)}<div className="mt-4 pt-4 border-t"><div className="text-gray-500 text-sm">注:仅修改节次/时段</div></div></Form></Modal>
    </Layout>
  );
}
