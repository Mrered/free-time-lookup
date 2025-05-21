// 法定节假日API查询工具
// 依赖 apihubs.cn

const API_URL = 'https://api.apihubs.cn/holiday/get';
const API_KEY = process.env.NEXT_PUBLIC_HOLIDAY_API_KEY || '';

// 查询某年所有法定节假日
export async function fetchYearHolidays(year: number) {
  const url = `${API_URL}?year=${year}&holiday_legal=1&cn=1&api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code === 0 && data.data && data.data.list) {
    return data.data.list;
  }
  throw new Error(data.msg || '节假日API查询失败');
}

// 查询某天是否为法定节假日
export async function isHoliday(date: Date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const url = `${API_URL}?date=${y}${m}${d}&holiday_legal=1&cn=1&api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code === 0 && data.data && data.data.list && data.data.list.length > 0) {
    return true;
  }
  return false;
}

// 获取某年春节（农历正月初一）日期
export async function fetchSpringFestivalDate(year: number): Promise<Date> {
  // apihubs.cn 支持农历查询，春节为农历1月1日
  const url = `${API_URL}?year=${year}&lunar=1&cn=1&api_key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code === 0 && data.data && data.data.list) {
    // 找到农历1月1日
    const spring = data.data.list.find((d: any) => d.lunar_month % 100 === 1 && d.lunar_date % 100 === 1);
    if (spring) {
      const y = spring.year;
      const m = Math.floor(spring.month % 100);
      const d = Math.floor(spring.date % 100);
      return new Date(y, m - 1, d);
    }
  }
  throw new Error('未找到春节日期');
} 