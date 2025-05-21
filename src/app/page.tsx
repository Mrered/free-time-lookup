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

// 新增：获取auth-token的过期时间（假设token存储在cookie，且有expires字段）
function getAuthTokenExpire() {
  const match = document.cookie.match(/auth-token=([^;]+);?\s*(expires=([^;]+))?/);
  if (!match) return null;
  // 这里假设token有效期由服务端控制，前端只做简单时间判断
  // 实际可用localStorage/sessionStorage存储登录时间戳
  const loginTime = localStorage.getItem('login-time');
  return loginTime ? parseInt(loginTime, 10) : null;
}

// 修改isLoggedIn，5分钟内有效
function isLoggedIn() {
  if (typeof window === 'undefined') return false;
  const hasToken = document.cookie.split(';').some(c => c.trim().startsWith('auth-token='));
  if (!hasToken) return false;
  const loginTime = getAuthTokenExpire();
  if (!loginTime) return false;
  // 5分钟=300000毫秒
  return Date.now() - loginTime < 300000;
}

// 登录后设置登录时间
function setLoginTime() {
  localStorage.setItem('login-time', Date.now().toString());
}

// 退出登录
function logout() {
  document.cookie = 'auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  localStorage.removeItem('login-time');
}

// 控制台跳转逻辑
function handleConsoleClick(e: React.MouseEvent) {
  e.preventDefault();
  if (isLoggedIn()) {
    window.location.href = '/console';
  } else {
    // 跳转到登录页，登录后回跳console
    window.location.href = `/login?from=/console`;
  }
}

// 新增：姓名脱敏
function maskName(name: string) {
  if (isLoggedIn()) return name;
  if (!name || name.length < 2) return name;
  return name[0] + '*' + name.slice(2);
}

export default function HomePage() {
  const [allData, setAllData] = useState<DataRow[]>([]); // 存储所有教师的原始数据
  const [weekType, setWeekType] = useState<boolean>(true); // 当前选择的周类型：true为单周, false为双周
  const [showTheory, setShowTheory] = useState(true); // 是否显示理论课空闲时间
  const [showTraining, setShowTraining] = useState(true); // 是否显示实训课空闲时间
  const [classFilter, setClassFilter] = useState<string[]>([]); // 班级筛选器选中的班级
  const [holidays, setHolidays] = useState<number[]>([]); // 存储节假日日期的数组 (格式如: 20240501)
  const [firstMonday, setFirstMonday] = useState<Date | null>(null); // 本学期第一教学周的周一日期
  const [loading, setLoading] = useState(true); // 主数据加载状态
  const [modalInfo, setModalInfo] = useState<any>(null); // 日历事件点击后弹窗显示的信息

  // Effect Hook: 组件挂载后获取所有教师数据
  useEffect(() => {
    setLoading(true); // 开始加载，设置loading状态为true
    fetch(`${apiUrl}/api/upload-excel`, { method: "GET" })
      .then(res => res.json())
      .then(result => {
        // 根据返回结果的类型处理数据
        if (Array.isArray(result.value)) {
          setAllData(result.value);
        } else if (typeof result.value === "string") {
          // 如果是字符串，尝试解析JSON
          try {
            setAllData(JSON.parse(result.value));
          } catch (error) {
            console.error("解析获取的教师数据失败:", error);
            setAllData([]); // 解析失败则设置为空数组
          }
        } else {
          setAllData([]); // 其他意外类型也设置为空数组
        }
      })
      .catch(error => {
        console.error("获取教师数据失败:", error);
        setAllData([]); // 获取失败则设置为空数组
      })
      .finally(() => setLoading(false)); // 加载结束，设置loading状态为false
  }, []); // 空依赖数组，此effect仅在组件挂载时运行一次

  // Memo Hook: 从allData中提取所有不重复的班级名称，用于班级筛选器的选项
  const allClasses = useMemo(() => Array.from(new Set(allData.map(d => d.class))), [allData]);

  // Effect Hook: 组件挂载后获取当年的节假日信息
  useEffect(() => {
    const year = new Date().getFullYear();
    fetchYearHolidays(year)
      .then(list => {
        // 假设list已经是包含date属性（YYYYMMDD格式数字）的对象数组
        setHolidays(list.map((d: any) => d.date));
      })
      .catch(error => {
        console.error("获取年度节假日失败:", error);
        setHolidays([]); // 获取失败则设置为空数组
      });
  }, []); // 空依赖数组，此effect仅在组件挂载时运行一次

  // Effect Hook: 组件挂载后获取本学期第一教学周的周一日期
  useEffect(() => {
    getDefaultSpringFirstMonday(new Date().getFullYear())
      .then(date => {
        setFirstMonday(date); // date可能为Date对象或null
      })
      .catch(error => {
        console.error("获取学期第一周周一失败:", error);
        setFirstMonday(null); // 获取失败则设置为null
      });
  }, []); // 空依赖数组，此effect仅在组件挂载时运行一次

  // 函数: 计算指定日期所有符合筛选条件的教师的空闲时间
  function getFreeTimeForDay(date: Date) {
    // getDay() 返回0(周日)-6(周六), 转换为1(周一)-7(周日)
    const weekday = date.getDay() === 0 ? 7 : date.getDay();

    // 根据当前筛选条件过滤教师数据
    let filteredData = allData.filter(row =>
      (classFilter.length === 0 || classFilter.includes(row.class)) && // 班级筛选
      ((showTheory && row.isTheory) || (showTraining && !row.isTheory)) // 理论/实训课筛选
    );

    // 遍历过滤后的数据，计算每个教师的空闲时间
    return filteredData.map(row => {
      if (row.isTheory) { // 理论课
        if (row.weekday !== weekday) return null; // 如果不是当天的理论课，则返回null
        const freePeriods = getTheoryFreeTime(row.periods); // 获取理论课的空闲节次
        return { name: row.name, free: freePeriods };
      } else { // 实训课
        // 如果设置了单双周，且与当前选择的周类型不符，则返回null
        if (row.weekType !== null && row.weekType !== weekType) return null;
        const freeTimeBlocks = getTrainingFreeTime(row.timeBlocks); // 获取实训课的空闲时间段
        return { name: row.name, free: freeTimeBlocks };
      }
    }).filter(Boolean); // 过滤掉null的结果
  }

  // Memo Hook: 生成FullCalendar所需的事件数组
  const events = useMemo(() => {
    const today = dayjs().startOf("day"); // 获取今天的开始时间
    const daysToGenerate = 30; // 生成未来30天的日程
    let calendarEvents: any[] = [];

    for (let i = 0; i < daysToGenerate; i++) {
      const currentDate = today.add(i, "day"); // 当前处理的日期
      const ymdNumber = Number(currentDate.format("YYYYMMDD")); // 日期格式转为数字 YYYYMMDD
      const isHoliday = holidays.includes(ymdNumber); // 判断是否为节假日

      const freeTimeListForDay = getFreeTimeForDay(currentDate.toDate()); // 获取当天空闲时间列表

      freeTimeListForDay.forEach((item: any) => { // item: { name: string, free: { start: string, end: string }[] }
        item.free.forEach((freeSlot: any, idx: number) => {
          // 备注信息：显示该教师当前及下一段空闲时间
          const nextTwoFreeSlots = item.free.slice(idx, idx + 2).map((ff: any) => `${ff.start}-${ff.end}`).join("，");

          // 确保空闲时间段有明确的开始和结束时间
          if (freeSlot.start && freeSlot.end) {
            const [startHour, startMinute] = freeSlot.start.split(":").map(Number);
            const [endHour, endMinute] = freeSlot.end.split(":").map(Number);

            const eventStartDateTime = currentDate.hour(startHour).minute(startMinute).toDate();
            const eventEndDateTime = currentDate.hour(endHour).minute(endMinute).toDate();

            calendarEvents.push({
              title: maskName(item.name), // 事件标题：教师姓名（脱敏）
              start: eventStartDateTime, // 事件开始时间
              end: eventEndDateTime, // 事件结束时间
              backgroundColor: isHoliday ? "#faad14" : "#52c41a", // 根据是否节假日设置背景色
              borderColor: isHoliday ? "#faad14" : "#52c41a",   // 根据是否节假日设置边框色
              extendedProps: { // 扩展属性，用于弹窗显示
                remarks: nextTwoFreeSlots,
                isHoliday: isHoliday,
                date: currentDate.format("YYYY-MM-DD"),
              },
            });
          }
        });
      });
    }
    return calendarEvents;
  }, [allData, weekType, showTheory, showTraining, classFilter, holidays]); // 依赖项数组

  // 函数: 处理日历事件点击事件，弹出信息模态框
  function handleEventClick(clickInfo: any) {
    // 获取所有事件，按开始时间排序
    const allEvents = events
      .filter(e => e.title === clickInfo.event.title)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    // 找到当前事件在所有事件中的索引
    const idx = allEvents.findIndex(e => e.start.getTime() === clickInfo.event.start.getTime());
    // 获取下一个和下下一个事件
    const next1 = allEvents[idx + 1];
    const next2 = allEvents[idx + 2];
    // 生成后续安排文本
    const nextArr = [next1, next2].filter(Boolean).map(ev => {
      const dateStr = dayjs(ev.start).format("YYYY-MM-DD");
      const timeStr = `${dayjs(ev.start).format("HH:mm")}-${dayjs(ev.end).format("HH:mm")}`;
      // 如果不是同一天，显示日期+时间段，否则只显示时间段
      if (dateStr !== dayjs(clickInfo.event.start).format("YYYY-MM-DD")) {
        return `${dateStr} ${timeStr}`;
      } else {
        return timeStr;
      }
    });
    setModalInfo({
      title: clickInfo.event.title,
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
        <b>{eventInfo.event.title}</b>
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
      
      {/* 筛选控制区域 */}
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

      {/* 日历区域 */}
      <div className="w-full max-w-[96vw] md:max-w-6xl bg-white rounded-xl shadow-xl p-2 sm:p-4">
        {loading ? (
          <div className="flex justify-center items-center h-[600px]">
            <Spin size="large" tip="日历数据加载中..." />
          </div>
        ) : (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth" // 初始视图为月视图
            initialDate={firstMonday || undefined} // MODIFIED: 设置初始日期为获取到的学期第一周周一，如果未获取到则使用默认值
            headerToolbar={{ // 头部工具栏配置
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay"
            }}
            locale="zh-cn" // 设置语言为中文
            events={events} // 日程事件数据
            eventClick={handleEventClick} // 事件点击回调
            height="auto" // 高度自适应，也可以设置为固定值如700
            contentHeight="auto"
            aspectRatio={1.5} // 调整宽高比，可以根据需要调整
            handleWindowResize={true} // 窗口大小调整时自动更新日历
            eventContent={renderEventContent} // 自定义事件渲染函数
            buttonText={{ // 自定义按钮文字
                today:    '今天',
                month:    '月',
                week:     '周',
                day:      '日',
            }}
            allDaySlot={false} // 不显示全天事件的独立区域
            slotMinTime="07:00:00" // 时间轴最早时间
            slotMaxTime="22:00:00" // 时间轴最晚时间
            nowIndicator={true} // 显示当前时间指示器
            navLinks={true} // 允许点击日期/周数导航
            editable={false} // 事件是否可编辑（拖动、调整大小）
            dayMaxEvents={true} // 月视图中，当一天事件过多时，显示 "+n more"
          />
        )}
      </div>

      {/* 事件详情弹窗 */}
      <Modal
        open={!!modalInfo} // 根据modalInfo是否有值来控制弹窗显隐
        title={<span className="font-semibold text-lg text-blue-700 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>{maskName(modalInfo?.title)}同学的空闲时段</span>}
        onCancel={() => setModalInfo(null)}
        footer={null}
        bodyStyle={{ background: 'var(--card-bg)', borderRadius: 16, boxShadow: '0 4px 32px #0002', padding: 24 }}
      >
        <div className="space-y-3">
          <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>日期：<span className="font-semibold">{modalInfo?.date}</span></p>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>时间：<span className="font-semibold">{modalInfo?.time}</span></p>
          <p className="text-base font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400"></span>后续安排：<span className="font-semibold">{modalInfo?.remarks}</span></p>
          {modalInfo?.isHoliday && <p className="text-base font-bold text-orange-500 flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-orange-400"></span>当天为法定节假日</p>}
        </div>
      </Modal>
    </div>
  );
}
