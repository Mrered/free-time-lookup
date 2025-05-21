"use client";
import { useEffect, useState, useMemo } from "react";
import { Select, Switch, Spin, Modal } from "antd";
import dayjs from "dayjs";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { getTheoryFreeTime } from "@/utils/theoryFreeTime";
import { getTrainingFreeTime } from "@/utils/trainingFreeTime";
import { getDefaultSpringFirstMonday } from "@/utils/weekUtils";
import { fetchYearHolidays } from "@/utils/holidayApi";

interface DataRow {
  name: string;
  class: string;
  weekday: number;
  isTheory: boolean;
  periods: number[];
  weekType: boolean | null;
  timeBlocks: string[];
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

export default function HomePage() {
  const [allData, setAllData] = useState<DataRow[]>([]);
  const [weekType, setWeekType] = useState<boolean>(true); // 单/双周
  const [showTheory, setShowTheory] = useState(true);
  const [showTraining, setShowTraining] = useState(true);
  const [classFilter, setClassFilter] = useState<string[]>([]);
  const [holidays, setHolidays] = useState<number[]>([]); // 节假日日期（如20240501）
  const [firstMonday, setFirstMonday] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState<any>(null);

  // 拉取数据库全部数据
  useEffect(() => {
    setLoading(true);
    fetch(`${apiUrl}/api/upload-excel`, { method: "GET" })
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result.value)) setAllData(result.value);
        else if (typeof result.value === "string") setAllData(JSON.parse(result.value));
      })
      .finally(() => setLoading(false));
  }, []);

  // 获取所有班级选项
  const allClasses = useMemo(() => Array.from(new Set(allData.map(d => d.class))), [allData]);

  // 获取本年节假日
  useEffect(() => {
    const year = new Date().getFullYear();
    fetchYearHolidays(year).then(list => {
      setHolidays(list.map((d: any) => d.date));
    });
  }, []);

  // 获取本学期第一教学周周一
  useEffect(() => {
    getDefaultSpringFirstMonday(new Date().getFullYear()).then(setFirstMonday);
  }, []);

  // 计算某天所有人的空闲时间
  function getFreeTimeForDay(date: Date) {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    let filtered = allData.filter(row =>
      (classFilter.length === 0 || classFilter.includes(row.class)) &&
      ((showTheory && row.isTheory) || (showTraining && !row.isTheory))
    );
    return filtered.map(row => {
      if (row.isTheory) {
        if (row.weekday !== weekday) return null;
        const free = getTheoryFreeTime(row.periods);
        return { name: row.name, free };
      } else {
        if (row.weekType !== null && row.weekType !== weekType) return null;
        const free = getTrainingFreeTime(row.timeBlocks);
        return { name: row.name, free };
      }
    }).filter(Boolean);
  }

  // 生成 FullCalendar events
  const events = useMemo(() => {
    // 只生成未来30天的日程
    const today = dayjs().startOf("day");
    const days = 30;
    let evts: any[] = [];
    for (let i = 0; i < days; i++) {
      const date = today.add(i, "day");
      const ymd = date.format("YYYYMMDD");
      const isHoliday = holidays.includes(Number(ymd));
      const freeList = getFreeTimeForDay(date.toDate());
      freeList.forEach((item: any) => {
        item.free.forEach((f: any, idx: number) => {
          // 备注：该人接下来两段空闲时间
          const nextTwo = item.free.slice(idx, idx + 2).map((ff: any) => `${ff.start}-${ff.end}`).join("，");
          // 只生成有起止时间的日程
          if (f.start && f.end) {
            const [sh, sm] = f.start.split(":").map(Number);
            const [eh, em] = f.end.split(":").map(Number);
            const start = date.hour(sh).minute(sm).toDate();
            const end = date.hour(eh).minute(em).toDate();
            evts.push({
              title: item.name,
              start,
              end,
              backgroundColor: isHoliday ? "#faad14" : "#52c41a",
              borderColor: isHoliday ? "#faad14" : "#52c41a",
              extendedProps: {
                remarks: nextTwo,
                isHoliday,
                date: date.format("YYYY-MM-DD"),
              },
            });
          }
        });
      });
    }
    return evts;
  }, [allData, weekType, showTheory, showTraining, classFilter, holidays]);

  // 日程点击弹窗
  function handleEventClick(info: any) {
    setModalInfo({
      title: info.event.title,
      date: info.event.extendedProps.date,
      time: `${dayjs(info.event.start).format("HH:mm")}-${dayjs(info.event.end).format("HH:mm")}`,
      remarks: info.event.extendedProps.remarks,
      isHoliday: info.event.extendedProps.isHoliday,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center py-8">
      <div className="w-full flex justify-end max-w-5xl mb-2">
        <a href="/console" className="text-blue-600 hover:underline font-medium">进入控制台</a>
      </div>
      <div className="text-3xl font-bold text-blue-700 mb-4">兴趣班空余时间日历</div>
      <div className="flex flex-wrap gap-4 mb-4 items-center bg-white rounded-lg shadow p-4">
        <div>
          <span className="mr-2">单双周：</span>
          <Switch checkedChildren="单周" unCheckedChildren="双周" checked={weekType} onChange={setWeekType} />
        </div>
        <div>
          <span className="mr-2">理论课</span>
          <Switch checked={showTheory} onChange={setShowTheory} />
        </div>
        <div>
          <span className="mr-2">实训课</span>
          <Switch checked={showTraining} onChange={setShowTraining} />
        </div>
        <div>
          <span className="mr-2">班级筛选</span>
          <Select mode="multiple" allowClear style={{ minWidth: 120, maxWidth: 240 }} placeholder="全部班级" value={classFilter} onChange={setClassFilter} options={allClasses.map(c => ({ value: c, label: c }))} />
        </div>
      </div>
      <div className="w-full max-w-5xl bg-white rounded-xl shadow p-4">
        {loading ? <Spin /> : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay"
            }}
            locale="zh-cn"
            events={events}
            eventClick={handleEventClick}
            height={700}
            eventContent={renderEventContent}
          />
        )}
      </div>
      <Modal
        open={!!modalInfo}
        title={modalInfo?.title}
        onCancel={() => setModalInfo(null)}
        footer={null}
      >
        <div>日期：{modalInfo?.date}</div>
        <div>时间：{modalInfo?.time}</div>
        <div>备注：{modalInfo?.remarks}</div>
        {modalInfo?.isHoliday && <div style={{color:'#faad14'}}>法定节假日</div>}
      </Modal>
    </div>
  );
}

// 自定义日程内容
function renderEventContent(arg: any) {
  return (
    <div>
      <b>{arg.event.title}</b>
      <div style={{fontSize:12}}>{arg.timeText}</div>
            </div>
  );
}
