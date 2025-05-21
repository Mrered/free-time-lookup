import { Table, Button, Popconfirm, Pagination, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { FormInstance } from "antd/es/form";
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { useEffect, useState, ReactNode } from "react";

interface DataRow {
  name: string;
  class: string;
  weekday: number;
  isTheory: boolean;
  periods: number[];
  weekType: boolean | null;
  timeBlocks: string[];
}

interface ManagePanelProps {
  data: DataRow[];
  loading: boolean; // General loading for the table (e.g., initial load)
  onAdd: () => void;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
  onDataChange: (newData: DataRow[]) => void; // Callback to update parent's data after restore
  editModalOpen: boolean;
  editRow: DataRow | null;
  onEditModalClose: () => void;
  onEditSave: () => void;
  form: FormInstance;
  historyButtons?: ReactNode;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
}

export default function ManagePanel({
  data,
  loading, // This is general table loading, not for the restore button specifically anymore
  onAdd,
  onEdit,
  onDelete,
  onDataChange,
  editModalOpen,
  editRow,
  onEditModalClose,
  onEditSave,
  form,
  historyButtons,
  page,
  pageSize,
  setPage
}: ManagePanelProps) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [actionIdx, setActionIdx] = useState<number | null>(null);
  const [backupInfo, setBackupInfo] = useState<{hasBackup: boolean, formattedTime: string | null}>({
    hasBackup: false,
    formattedTime: null
  });
  const [checkingBackup, setCheckingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false); // Specific loading state for restore

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Function to check backup status
  const fetchBackupStatus = async () => {
    try {
      setCheckingBackup(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/restore-backup`, { method: "GET" });
      const result = await res.json();
      if (res.ok) {
        setBackupInfo({
          hasBackup: !!result.hasBackup,
          formattedTime: result.formattedTime
        });
      } else {
        console.error("检查备份状态失败 (API Error):", result.message || "Unknown error");
        setBackupInfo({ hasBackup: false, formattedTime: null });
      }
    } catch (err) {
      console.error("检查备份状态失败 (Network/Fetch Error):", err);
      setBackupInfo({ hasBackup: false, formattedTime: null }); // Ensure backup info is reset on error
    } finally {
      setCheckingBackup(false);
    }
  };

  // 检查备份状态 on mount and when data changes (e.g., after a successful restore)
  useEffect(() => {
    fetchBackupStatus();
  }, [data]); // Re-check when data prop changes

  const handleRestoreBackup = async () => {
    if (!backupInfo.hasBackup || checkingBackup || isRestoringBackup) {
      return; // Prevent multiple clicks or clicks when no backup
    }
    setIsRestoringBackup(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/restore-backup`, {
        method: "PATCH",
        headers: {
          'Content-Type': 'application/json',
        },
        // No body is typically needed for this kind of PATCH if the server knows what to restore.
      });
      const result = await res.json();
      if (res.ok && result.value) {
        onDataChange(result.value as DataRow[]); // Notify parent to update data
        message.success(result.message || "备份恢复成功！");
        // After data changes via onDataChange, the useEffect depending on 'data'
        // will call fetchBackupStatus() again to update backup info.
      } else {
        message.error(result.message || "恢复备份失败。");
        console.error("恢复备份失败 (API Error):", result);
      }
    } catch (err) {
      message.error("恢复备份操作失败，请检查网络或联系管理员。");
      console.error("恢复备份操作失败 (Network/Fetch Error):", err);
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const restoreBackupButtonSmall = (
    <Button
      onClick={handleRestoreBackup}
      icon={<ReloadOutlined />}
      loading={isRestoringBackup} // Use specific loading state
      disabled={!backupInfo.hasBackup || checkingBackup || isRestoringBackup}
      title={backupInfo.hasBackup ? `恢复${backupInfo.formattedTime || '上次'}的备份` : (checkingBackup ? '正在检查备份...' : '暂无可用备份')}
    >
      恢复备份
      {backupInfo.hasBackup && !checkingBackup && <span className="text-xs text-green-500 ml-1">✓</span>}
    </Button>
  );

  const restoreBackupButtonLarge = (
    <div className="flex flex-col">
      <Button
        onClick={handleRestoreBackup}
        icon={<ReloadOutlined />}
        loading={isRestoringBackup} // Use specific loading state
        disabled={!backupInfo.hasBackup || checkingBackup || isRestoringBackup}
        title={backupInfo.hasBackup ? `恢复${backupInfo.formattedTime || '上次'}的备份` : (checkingBackup ? '正在检查备份...' : '暂无可用备份')}
      >
        {backupInfo.hasBackup ? `恢复备份 (${backupInfo.formattedTime?.split(' ')[1] || '有备份'})` : (checkingBackup ? '检查中...' : '暂无备份')}
        {backupInfo.hasBackup && !checkingBackup && <span className="text-xs text-green-500 ml-1">✓</span>}
      </Button>
      <div className="text-xs text-gray-500 mt-1">数据修改将在浏览器关闭时自动保存</div>
    </div>
  );

  const columns: ColumnsType<DataRow> = [
    { title: "姓名", dataIndex: "name", key: "name", align: "center" },
    { title: "班级", dataIndex: "class", key: "class", align: "center" },
    { title: "单双周/星期", dataIndex: "weekday", key: "weekday", align: "center", render: (_, record: DataRow) => {
      // Ensure weekMap is defined here if used, or use record.weekday directly for numbers.
      const weekMap = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
      let textToShow: ReactNode = weekMap[record.weekday] || record.weekday.toString(); // Default to number if not in map

      if (record.weekType === true) {
        return <Tag color="purple" className="px-2 py-1 text-xs">单周</Tag>;
      } else if (record.weekType === false) {
        return <Tag color="orange" className="px-2 py-1 text-xs">双周</Tag>;
      } else {
         // If weekType is null, show weekday number or mapped string
        return <span>{textToShow}</span>;
      }
    }},
    { title: "理论/实训", dataIndex: "isTheory", key: "isTheory", align: "center", render: v => v ? <Tag color="blue">理论</Tag> : <Tag color="green">实训</Tag> },
    { title: "节次/时间段", key: "periods_timeBlocks", align: "center", render: (_, record: DataRow) => {
      const periods = record.periods && record.periods.length
        ? record.periods.map((p: number) => <Tag key={`p-${p}`} color="blue" className="mx-0.5 text-sm">{p}节</Tag>)
        : null;
      const timeBlocks = record.timeBlocks && record.timeBlocks.length
        ? record.timeBlocks.map((t: string) => <Tag key={`t-${t}`} color="default" className="mx-0.5 text-sm">{t}</Tag>)
        : null;
      if (periods && timeBlocks) {
        return <span className="flex flex-wrap justify-center items-center">{periods}<span className="mx-1 text-gray-400">/</span>{timeBlocks}</span>;
      } else if (periods) {
        return <span className="flex flex-wrap justify-center items-center">{periods}</span>;
      } else if (timeBlocks) {
        return <span className="flex flex-wrap justify-center items-center">{timeBlocks}</span>;
      } else {
        return <span className="text-gray-400">-</span>;
      }
    }},
    {
      title: "操作",
      key: "action",
      align: "center",
      render: (_, record, idx) => {
        // Calculate globalIdx based on current page and pageSize for correct editing/deleting
        // This logic for globalIdx might need adjustment if 'data' itself is already paginated when passed to ManagePanel
        // Assuming 'data' is the full dataset and pagination is handled by AntD Table or locally for narrow view.
        // The current findIndex is okay if 'data' is the full dataset.
        const globalIdx = data.findIndex(item => item === record); // This is okay if 'data' is the full set.
                                                                     // If 'data' is already paged, this index is relative to the paged data.
                                                                     // For onEdit/onDelete, you need the index relative to the *original full data source*.
                                                                     // Let's assume parent handles mapping paged index to full data index if needed,
                                                                     // or `data` prop is always the full dataset.
                                                                     // The original code seems to assume `data` is the full list.

        return (
          <span>
            <Button
              icon={<EditOutlined />}
              size="small"
              style={{ marginRight: 8 }}
              onClick={() => {
                // If `data` is the full dataset, `globalIdx` from findIndex is correct.
                // If `data` is a slice (paged data), then `(page - 1) * pageSize + idx` (from local map) is better.
                // Let's use the original logic, assuming `data` is the full set as `Table` dataSource.
                onEdit(globalIdx);
              }}
            >编辑</Button>
            <Popconfirm
              title="确定要删除这条数据吗？"
              onConfirm={() => {
                onDelete(globalIdx);
              }}
              okText="确定"
              cancelText="取消"
            >
              <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
            </Popconfirm>
          </span>
        );
      }
    }
  ];

  if (isNarrow) {
    const pagedData = data.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="flex flex-row gap-2 mb-4 items-center justify-between">
          <div className="flex flex-row gap-2">
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>
            {restoreBackupButtonSmall}
          </div>
          {historyButtons && <div>{historyButtons}</div>}
        </div>
        <div className="text-xs text-gray-500 mb-2">数据修改将在浏览器关闭时自动保存</div>
        {loading ? <div className="text-center text-gray-400 py-8">加载中...</div> : null} {/* General table loading */}
        {isRestoringBackup && !loading && <div className="text-center text-blue-500 py-2">正在恢复备份...</div>} {/* Specific restore loading message */}

        {pagedData.map((row, localIdx) => {
          const globalIdxInData = data.indexOf(row); // Get index from the original full data array
                                                     // This is more robust if data array can have duplicates conceptually
                                                     // but for unique rows, (page - 1) * pageSize + localIdx works if data is sorted consistently.
                                                     // Or better: parent should pass unique keys if possible.
                                                     // The original used 'data.findIndex(item => item === record)' which is fine.
                                                     // Here for map, it's 'data.indexOf(row)' or pass a unique key.
          const cardKey = row.name + '-' + row.class + '-' + row.weekday + '-' + String(row.weekType) + '-' + localIdx;


          return (
            <div
              key={cardKey} // Ensure a unique key
              className="relative bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg p-4 flex flex-col gap-2 border border-blue-100 hover:shadow-2xl transition-shadow duration-200 items-stretch"
              style={{ minWidth: 0 }}
              onDoubleClick={() => setActionIdx(globalIdxInData)}
              onMouseEnter={() => setActiveIdx(globalIdxInData)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              <div className="flex-1 flex flex-col gap-2 justify-between">
                <div className="grid grid-cols-2 grid-rows-3 gap-2 w-full">
                  <div><Tag color="blue" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>{row.name}</Tag></div>
                  <div><Tag color="geekblue" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>{row.class}</Tag></div>
                  <div>
                    {(() => {
                      const weekMap = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
                      if (row.weekType === true) return <Tag color="purple" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>单周</Tag>;
                      if (row.weekType === false) return <Tag color="orange" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>双周</Tag>;
                      if (row.weekday && row.weekday > 0 && row.weekday < weekMap.length) return <Tag color="default" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>{weekMap[row.weekday]}</Tag>;
                      return <Tag color="default" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>{row.weekday || '-'}</Tag>;
                    })()}
                  </div>
                  <div>
                    {row.isTheory
                      ? <Tag color="blue" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>理论</Tag>
                      : <Tag color="green" style={{ width: '100%', fontSize: 14, display: 'flex', justifyContent: 'center' }}>实训</Tag>
                    }
                  </div>
                  <div className="col-span-2">
                    {(() => {
                      const tags = [];
                      const periodGradientStyle = { background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)', color: '#fff', border: 'none', fontSize: 14, marginRight: 0, marginBottom: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' };
                      const tagStyle = { fontSize: 14, marginRight: 0, marginBottom: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' };

                      if (row.periods && row.periods.length) {
                        tags.push(...row.periods.map((p: number) => (<Tag key={"p"+p} className="w-full" style={periodGradientStyle}>{p}节</Tag>)));
                      }
                      if (row.timeBlocks && row.timeBlocks.length) {
                        tags.push(...row.timeBlocks.map((t: string) => (<Tag key={"t"+t} color="default" className="w-full" style={tagStyle}>{t}</Tag>)));
                      }
                      if (tags.length === 0) {
                        tags.push(<Tag key="none" color="default" className="w-full" style={tagStyle}>-</Tag>);
                      }
                      return (<div className={`grid w-full gap-1`} style={{ gridTemplateColumns: `repeat(${Math.max(1, tags.length)}, 1fr)` }}>{tags}</div>);
                    })()}
                  </div>
                </div>
              </div>
              {actionIdx === globalIdxInData && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl backdrop-blur-md bg-white/60"
                  onClick={() => setActionIdx(null)}
                  style={{ transition: 'backdrop-filter 0.2s' }}
                >
                  <div className="flex flex-row gap-4">
                    <Button icon={<EditOutlined />} size="large" type="primary" onClick={e => { e.stopPropagation(); setActionIdx(null); onEdit(globalIdxInData); }}>编辑</Button>
                    <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => { setActionIdx(null); onDelete(globalIdxInData); }} okText="确定" cancelText="取消">
                      <Button icon={<DeleteOutlined />} size="large" danger onClick={e => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                  </div>
                </div>
              )}
              {!isNarrow && activeIdx === globalIdxInData && (
                 <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/95 rounded-xl shadow-lg px-3 py-2 flex flex-col gap-2 border border-blue-100 animate-fade-in">
                    <Button icon={<EditOutlined />} size="small" onClick={e => { e.stopPropagation(); onEdit(globalIdxInData); }} style={{width:64}}>编辑</Button>
                    <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => onDelete(globalIdxInData)} okText="确定" cancelText="取消">
                        <Button icon={<DeleteOutlined />} size="small" danger style={{width:64}} onClick={e => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                 </div>
              )}
            </div>
          );
        })}
        <div className="flex justify-center mt-4">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={data.length}
            onChange={setPage}
            showSizeChanger={false} // As per original code
            // showQuickJumper={true} // Consider adding for better UX with many pages
            style={{ userSelect: "none" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-row gap-2 mb-6 items-center justify-between">
        <div className="flex flex-row gap-2 items-start"> {/* items-start for alignment with multiline button */}
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>
          {restoreBackupButtonLarge}
        </div>
        {historyButtons && <div>{historyButtons}</div>}
      </div>
      <Table
        columns={columns}
        dataSource={data} // Assuming 'data' is the full dataset
        rowKey={record => record.name + '-' + record.class + '-' + record.weekday + '-' + String(record.weekType) + '-' + (record.periods.join('') || record.timeBlocks.join(''))} // More robust key
        loading={loading || (isRestoringBackup)} // Show table loading if general loading OR restoring backup
        pagination={{
          current: page,
          pageSize: pageSize,
          total: data.length,
          onChange: setPage,
          locale: { items_per_page: '条/页' }
        }}
        bordered
        rowClassName={(_, idx) => idx % 2 === 0 ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"}
        style={{ background: "#fff", borderRadius: 12 }}
      />
    </div>
  );
}