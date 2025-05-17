import { Table, Button, Popconfirm, Pagination, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";

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
  loading: boolean;
  onAdd: () => void;
  onEdit: (idx: number) => void;
  onDelete: (idx: number) => void;
  onRestoreBackup: () => void;
}

export default function ManagePanel({ data, loading, onAdd, onEdit, onDelete, onRestoreBackup }: ManagePanelProps) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [page, setPage] = useState(1);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [actionIdx, setActionIdx] = useState<number | null>(null);
  const pageSize = 10;
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const columns: ColumnsType<DataRow> = [
    { title: "姓名", dataIndex: "name", key: "name", align: "center" },
    { title: "班级", dataIndex: "class", key: "class", align: "center" },
    { title: "单双周/星期", dataIndex: "weekday", key: "weekday", align: "center", render: (_, record: DataRow) => {
      let text = record.weekday;
      if (record.weekType === true) {
        return <span className="ml-1 px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs">单周</span>;
      } else if (record.weekType === false) {
        return <span className="ml-1 px-2 py-1 rounded bg-orange-100 text-orange-700 text-xs">双周</span>;
      } else {
        return <span>{text}</span>;
      }
    } },
    { title: "理论/实训", dataIndex: "isTheory", key: "isTheory", align: "center", render: v => v ? <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">理论</span> : <span className="px-2 py-1 rounded bg-green-100 text-green-700">实训</span> },
    { title: "节次/时间段", key: "periods_timeBlocks", align: "center", render: (_, record: DataRow) => {
      const periods = record.periods && record.periods.length
        ? record.periods.map((p: number) => <span key={p} className="inline-block mx-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">{p}节</span>)
        : null;
      const timeBlocks = record.timeBlocks && record.timeBlocks.length
        ? record.timeBlocks.map((t: string) => <span key={t} className="inline-block mx-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">{t}</span>)
        : null;
      if (periods && timeBlocks) {
        return <span>{periods}<span className="mx-1 text-gray-400">/</span>{timeBlocks}</span>;
      } else if (periods) {
        return <span>{periods}</span>;
      } else if (timeBlocks) {
        return <span>{timeBlocks}</span>;
      } else {
        return <span className="text-gray-400">-</span>;
      }
    } },
    {
      title: "操作",
      key: "action",
      align: "center",
      render: (_, record, idx) => (
        <span>
          <Button icon={<EditOutlined />} size="small" style={{ marginRight: 8 }} onClick={() => onEdit(idx)}>编辑</Button>
          <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => onDelete(idx)} okText="确定" cancelText="取消">
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </span>
      )
    }
  ];

  if (isNarrow) {
    // 小屏幕卡片化展示 + 分页 + 浮层操作区
    const pagedData = data.slice((page - 1) * pageSize, page * pageSize);
    return (
      <div className="w-full flex flex-col gap-4">
        <div className="flex flex-row gap-2 mb-4">
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>
          <Button onClick={onRestoreBackup} icon={<EditOutlined />}>恢复上次备份</Button>
        </div>
        {loading ? <div className="text-center text-gray-400 py-8">加载中...</div> : null}
        {pagedData.map((row, idx) => {
          const globalIdx = (page - 1) * pageSize + idx;
          return (
            <div
              key={idx}
              className="relative bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg p-4 flex flex-col gap-2 border border-blue-100 hover:shadow-2xl transition-shadow duration-200 items-stretch"
              style={{ minWidth: 0 }}
              onDoubleClick={() => setActionIdx(globalIdx)}
              onMouseEnter={() => setActiveIdx(globalIdx)}
              onMouseLeave={() => setActiveIdx(null)}
            >
              {/* 左侧内容区 */}
              <div className="flex-1 flex flex-col gap-2 justify-between">
                <div className="grid grid-cols-2 grid-rows-3 gap-2 w-full">
                  {/* 第一行：姓名、班级 */}
                  <div>
                    <Tag color="blue" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>{row.name}</Tag>
                  </div>
                  <div>
                    <Tag color="geekblue" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>{row.class}</Tag>
                  </div>
                  {/* 第二行：单双周/星期、理论/实训 */}
                  <div>
                    {(() => {
                      const weekMap = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];
                      if (row.weekType === true) return <Tag color="purple" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>单周</Tag>;
                      if (row.weekType === false) return <Tag color="orange" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>双周</Tag>;
                      if (row.weekday && row.weekday > 0) return <Tag color="default" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>{weekMap[row.weekday]}</Tag>;
                      return <Tag color="default" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>-</Tag>;
                    })()}
                  </div>
                  <div>
                    {row.isTheory
                      ? <Tag color="blue" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>理论</Tag>
                      : <Tag color="green" className="mini-tag justify-center" style={{ width: '100%', fontSize: 14, display: 'flex' }}>实训</Tag>
                    }
                  </div>
                  {/* 第三行：合并两列，内容为节次/时间段，等宽铺满并居中 */}
                  <div className="col-span-2">
                    {(() => {
                      const tags = [];
                      // 渐变色样式
                      const periodGradientStyle = {
                        background: 'linear-gradient(90deg, #60a5fa 0%, #3b82f6 100%)',
                        color: '#fff',
                        border: 'none',
                        fontSize: 14,
                        marginRight: 0,
                        marginBottom: 2,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      };
                      // 其它Tag样式
                      const tagStyle = {
                        fontSize: 14,
                        marginRight: 0,
                        marginBottom: 2,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      };
                      // 直接将所有节次和时间段分成多个Tag
                      if (row.periods && row.periods.length) {
                        tags.push(...row.periods.map((p: number) => (
                          <Tag key={"p"+p} className="mini-tag w-full justify-center"
                            style={typeof p === 'number' && Number.isInteger(p) ? periodGradientStyle : tagStyle}>{p}</Tag>
                        )));
                      }
                      if (row.timeBlocks && row.timeBlocks.length) {
                        tags.push(...row.timeBlocks.map((t: string) => (
                          <Tag key={"t"+t} color="default" className="mini-tag w-full justify-center"
                            style={tagStyle}>{t}</Tag>
                        )));
                      }
                      if (tags.length === 0) {
                        tags.push(<Tag key="none" color="default" className="mini-tag w-full justify-center" style={tagStyle}>-</Tag>);
                      }
                      // 等宽铺满
                      const tagCount = tags.length || 1;
                      return (
                        <div className={`grid w-full gap-2`} style={{ gridTemplateColumns: `repeat(${tagCount}, 1fr)` }}>
                          {tags}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              {/* 小屏双击浮层操作区 */}
              {actionIdx === globalIdx && (
                <div
                  className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl backdrop-blur-md bg-white/60"
                  onClick={() => setActionIdx(null)}
                  style={{ transition: 'backdrop-filter 0.2s' }}
                >
                  <div className="flex flex-row gap-4">
                    <Button icon={<EditOutlined />} size="large" type="primary" onClick={e => { e.stopPropagation(); setActionIdx(null); onEdit(globalIdx); }}>编辑</Button>
                    <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => { setActionIdx(null); onDelete(globalIdx); }} okText="确定" cancelText="取消">
                      <Button icon={<DeleteOutlined />} size="large" danger onClick={e => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                  </div>
                </div>
              )}
              {/* 桌面端悬浮操作区 */}
              {!isNarrow && activeIdx === globalIdx && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/95 rounded-xl shadow-lg px-3 py-2 flex flex-col gap-2 border border-blue-100 animate-fade-in">
                  <Button icon={<EditOutlined />} size="small" onClick={e => { e.stopPropagation(); onEdit(globalIdx); }} style={{width:64}}>编辑</Button>
                  <Popconfirm title="确定要删除这条数据吗？" onConfirm={() => onDelete(globalIdx)} okText="确定" cancelText="取消">
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
            showSizeChanger={false}
            showQuickJumper={false}
            style={{ userSelect: "none" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-row gap-2 mb-6">
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增</Button>
        <Button onClick={onRestoreBackup} icon={<EditOutlined />}>恢复上次备份</Button>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        rowKey={(_, idx) => String(idx)}
        loading={loading}
        pagination={{ pageSize: 10, locale: { items_per_page: '条/页' } }}
        bordered
        rowClassName={(_, idx) => idx % 2 === 0 ? "bg-blue-50" : ""}
        style={{ background: "#fff", borderRadius: 12 }}
      />
    </div>
  );
} 