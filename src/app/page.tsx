"use client";
import { useEffect, useState, useMemo } from "react";
import { Select, Switch, Spin, Modal } from "antd";
import dayjs from "dayjs";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction"; // 用于事件点击等交互
import { getTheoryFreeTime } from "@/utils/theoryFreeTime";
import { getTrainingFreeTime } from "@/utils/trainingFreeTime";
import { getDefaultSpringFirstMonday } from "@/utils/weekUtils";
import { fetchYearHolidays } from "@/utils/holidayApi";

// 定义数据行结构
interface DataRow {
  name: string;
  class: string;
  weekday: number;
  isTheory: boolean;
  periods: number[];
  weekType: boolean | null;
  timeBlocks: string[];
}

// API基础URL，从环境变量读取，若未设置则为空字符串
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

// 客户端检查用户是否"可能"已登录（仅检查cookie是否存在）
// 真正的认证状态由服务器在API请求时确认
function isLoggedInClientCheck(): boolean {
  if (typeof window === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('auth-token='));
}

// 退出登录
function logout() {
  document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  // localStorage.removeItem('login-time'); // 如果不再需要login-time，可以移除
  // 根据实际需求决定登出后跳转的页面，例如登录页
  window.location.href = '/login';
}

// 控制台跳转逻辑
function handleConsoleClick(e: React.MouseEvent) {
  e.preventDefault();
    window.location.href = '/console';
}

export default function HomePage() {
  const [allData, setAllData] = useState<DataRow[]>([]); // 存储所有学生的原始数据
  const [weekType, setWeekType] = useState<boolean>(true); // 当前选择的周类型：true为单周, false为双周
  const [showTheory, setShowTheory] = useState(true); // 是否显示理论课空闲时间
  const [showTraining, setShowTraining] = useState(true); // 是否显示实训课空闲时间
  const [classFilter, setClassFilter] = useState<string[]>([]); // 班级筛选器选中的班级
  const [holidays, setHolidays] = useState<number[]>([]); // 存储节假日日期的数组 (格式如: 20240501)
  const [firstMonday, setFirstMonday] = useState<Date | null>(null); // 本学期第一教学周的周一日期
  const [loading, setLoading] = useState(true); // 主数据加载状态
  const [modalInfo, setModalInfo] = useState<any>(null); // 日历事件点击后弹窗显示的信息

  // Effect Hook: 组件挂载后获取所有学生数据
  useEffect(() => {
    setLoading(true);
    // 判断是否登录
    const isLoggedIn = isLoggedInClientCheck();
    const url = isLoggedIn ? `${apiUrl}/api/upload-excel` : `${apiUrl}/api/public-today`;
    fetch(url, { method: "GET" })
      .then(res => {
        if (!res.ok) {
          if (res.status === 401) {
            console.error("获取学生数据未授权，可能需要重新登录。");
          } else {
            console.error(`获取学生数据失败，状态码: ${res.status}`);
          }
          return null;
        }
        return res.json();
      })
      .then(result => {
        if (result) {
          // 登录后接口返回 result.value，未登录接口返回 result.data
          const data = result.value || result.data;
          if (Array.isArray(data)) {
            setAllData(data);
          } else if (typeof data === "string") {
            try {
              setAllData(JSON.parse(data));
            } catch (error) {
              console.error("解析获取的学生数据失败 (字符串格式):", error);
              setAllData([]);
            }
          } else {
            console.warn("获取的学生数据格式非预期:", data);
            setAllData([]);
          }
        } else {
          setAllData([]);
        }
      })
      .catch(error => {
        console.error("获取学生数据过程中发生网络或其它错误:", error);
        setAllData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Memo Hook: 从allData中提取所有不重复的班级名称，用于班级筛选器的选项
  const allClasses = useMemo(() => Array.from(new Set(allData.map(d => d.class))), [allData]);

  // Effect Hook: 组件挂载后获取当年的节假日信息
  useEffect(() => {
    const year = new Date().getFullYear();
    fetchYearHolidays(year)
      .then(list => {
        setHolidays(list.map((d: any) => d.date));
      })
      .catch(error => {
        console.error("获取年度节假日失败:", error);
        setHolidays([]);
      });
  }, []);

  // Effect Hook: 组件挂载后获取本学期第一教学周的周一日期
  useEffect(() => {
    getDefaultSpringFirstMonday(new Date().getFullYear())
      .then(date => {
        setFirstMonday(date);
      })
      .catch(error => {
        console.error("获取学期第一周周一失败:", error);
        setFirstMonday(null);
      });
  }, []);

  // 函数: 计算指定日期所有符合筛选条件的学生的空闲时间
  function getFreeTimeForDay(date: Date) {
    const weekday = date.getDay() === 0 ? 7 : date.getDay();
    let filteredData = allData.filter(row =>
      (classFilter.length === 0 || classFilter.includes(row.class)) &&
      ((showTheory && row.isTheory) || (showTraining && !row.isTheory))
    );

    return filteredData.map(row => {
      if (row.isTheory) {
        if (row.weekday !== weekday) return null;
        const freePeriods = getTheoryFreeTime(row.periods);
        return { name: row.name, free: freePeriods };
      } else {
        if (row.weekType !== null && row.weekType !== weekType) return null;
        const freeTimeBlocks = getTrainingFreeTime(row.timeBlocks);
        return { name: row.name, free: freeTimeBlocks };
      }
    }).filter(Boolean);
  }

  // Memo Hook: 生成FullCalendar所需的事件数组
  const events = useMemo(() => {
    const today = dayjs().startOf("day");
    const daysToGenerate = 30;
    let calendarEvents: any[] = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const currentDate = today.add(i, "day");
      const ymdNumber = Number(currentDate.format("YYYYMMDD"));
      const isHoliday = holidays.includes(ymdNumber);
      const freeTimeListForDay = getFreeTimeForDay(currentDate.toDate());

      freeTimeListForDay.forEach((item: any) => {
        item.free.forEach((freeSlot: any, idx: number) => {
          const nextTwoFreeSlots = item.free.slice(idx, idx + 2).map((ff: any) => `${ff.start}-${ff.end}`).join("，");
          if (freeSlot.start && freeSlot.end) {
            const [startHour, startMinute] = freeSlot.start.split(":").map(Number);
            const [endHour, endMinute] = freeSlot.end.split(":").map(Number);
            const eventStartDateTime = currentDate.hour(startHour).minute(startMinute).toDate();
            const eventEndDateTime = currentDate.hour(endHour).minute(endMinute).toDate();

            calendarEvents.push({
              title: item.name, // 直接用原始姓名
              start: eventStartDateTime,
              end: eventEndDateTime,
              backgroundColor: isHoliday ? "#faad14" : "#52c41a",
              borderColor: isHoliday ? "#faad14" : "#52c41a",
              extendedProps: {
                remarks: nextTwoFreeSlots,
                isHoliday: isHoliday,
                date: currentDate.format("YYYY-MM-DD"),
                originalName: item.name
              },
            });
          }
        });
      });
    }
    return calendarEvents;
  }, [allData, weekType, showTheory, showTraining, classFilter, holidays, firstMonday]); // Added firstMonday as it affects initialDate

  // 函数: 处理日历事件点击事件，弹出信息模态框
  function handleEventClick(clickInfo: any) {
    const clickedEventOriginalName = clickInfo.event.extendedProps.originalName;

    const allEventsForUser = events
      .filter(e => e.extendedProps.originalName === clickedEventOriginalName) // 筛选同一用户的事件
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const currentEventIndex = allEventsForUser.findIndex(e => e.start.getTime() === clickInfo.event.start.getTime() && e.end.getTime() === clickInfo.event.end.getTime());

    const nextArr: string[] = []; // MODIFIED: Explicitly typed as string[]
    if (currentEventIndex !== -1) {
        const next1 = allEventsForUser[currentEventIndex + 1];
        const next2 = allEventsForUser[currentEventIndex + 2];
        [next1, next2].filter(Boolean).forEach(ev => {
            const dateStr = dayjs(ev.start).format("YYYY-MM-DD");
            const timeStr = `${dayjs(ev.start).format("HH:mm")}-${dayjs(ev.end).format("HH:mm")}`;
            if (dateStr !== dayjs(clickInfo.event.start).format("YYYY-MM-DD")) {
                nextArr.push(`${dateStr} ${timeStr}`);
            } else {
                nextArr.push(timeStr);
            }
        });
    }

    setModalInfo({
      title: clickedEventOriginalName,
      date: clickInfo.event.extendedProps.date,
      time: `${dayjs(clickInfo.event.start).format("HH:mm")}-${dayjs(clickInfo.event.end).format("HH:mm")}`,
      remarks: nextArr.length ? nextArr.join('，') : '无',
      isHoliday: clickInfo.event.extendedProps.isHoliday,
    });
  }

  // 函数: 自定义日历事件的显示内容
  function renderEventContent(eventInfo: any) {
    return (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <b>{eventInfo.event.title}</b> {/* title已经是maskName处理过的 */}
        <div style={{ fontSize: 12 }}>{eventInfo.timeText}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex flex-col items-center py-8 px-4">
      <div className="w-full flex justify-end max-w-[96vw] md:max-w-6xl mb-2">
        <a href="/console" onClick={handleConsoleClick} className="text-blue-600 hover:underline font-medium px-3 py-2 rounded-md hover:bg-blue-100 transition-colors">
          进入控制台
        </a>
      </div>
      <div className="text-3xl font-bold text-blue-700 mb-6 text-center">兴趣班空余时间日历</div>
      
      <div className="flex flex-wrap gap-x-6 gap-y-4 mb-6 items-center justify-center bg-white rounded-lg shadow p-4 md:p-6 w-full max-w-[96vw] md:max-w-6xl">
        <div>
          <span className="mr-2 font-medium text-gray-700">周类型:</span>
          <Switch checkedChildren="单周" unCheckedChildren="双周" checked={weekType} onChange={setWeekType} />
        </div>
        <div>
          <span className="mr-2 font-medium text-gray-700">理论课:</span>
          <Switch checked={showTheory} onChange={setShowTheory} />
        </div>
        <div>
          <span className="mr-2 font-medium text-gray-700">实训课:</span>
          <Switch checked={showTraining} onChange={setShowTraining} />
        </div>
        <div>
          <span className="mr-2 font-medium text-gray-700">班级:</span>
          <Select
            mode="multiple"
            allowClear
            style={{ minWidth: 150, maxWidth: 300 }}
            placeholder="全部班级"
            value={classFilter}
            onChange={setClassFilter}
            options={allClasses.map(c => ({ value: c, label: c }))}
            maxTagCount="responsive"
          />
        </div>
      </div>

      <div className="w-full max-w-[96vw] md:max-w-6xl bg-white rounded-xl shadow-xl p-2 sm:p-4">
        {loading ? (
          <div className="flex justify-center items-center h-[600px]">
            <Spin size="large" tip="日历数据加载中..." />
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={firstMonday || undefined}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay"
            }}
            locale="zh-cn"
            events={events}
            eventClick={handleEventClick}
            height="auto"
            contentHeight="auto"
            aspectRatio={1.5}
            handleWindowResize={true}
            eventContent={renderEventContent}
            buttonText={{
                today:    '今天',
                month:    '月',
                week:     '周',
                day:      '日',
            }}
            allDaySlot={false}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            nowIndicator={true}
            navLinks={true}
            editable={false}
            dayMaxEvents={true}
          />
        )}
      </div>

      <Modal
        open={!!modalInfo}
        title={<span className="font-semibold text-lg text-blue-700 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>{modalInfo?.title} 同学的空闲时段</span>}
        onCancel={() => setModalInfo(null)}
        footer={null}
        bodyStyle={{ background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 32px #0002', padding: 24 }}
      >
        {modalInfo && (
          <div className="space-y-3">
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>日期：<span className="font-semibold">{modalInfo.date}</span></p>
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>时间：<span className="font-semibold">{modalInfo.time}</span></p>
            <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400"></span>后续安排：<span className="font-semibold">{modalInfo.remarks}</span></p>
            {modalInfo.isHoliday && <p className="text-base font-bold text-orange-500 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-orange-400"></span>当天为法定节假日</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
