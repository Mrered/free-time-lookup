// 教学周序号推算工具

import { fetchSpringFestivalDate } from "./holidayApi";

// 获取某日期是周几（1=周一, 7=周日）
export function getWeekday(date: Date) {
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

// 获取某日期所在周的周一
export function getMonday(date: Date) {
  const d = new Date(date);
  const day = getWeekday(d);
  d.setDate(d.getDate() - (day - 1));
  d.setHours(0,0,0,0);
  return d;
}

// 获取某年春节日期（农历正月初一）
export async function getSpringFestival(year: number): Promise<Date> {
  return await fetchSpringFestivalDate(year);
}

// 获取春季学期第一教学周的周一
export async function getDefaultSpringFirstMonday(year: number): Promise<Date> {
  const springFestival = await getSpringFestival(year);
  // 春节后第二个完整周的周一
  let d = new Date(springFestival);
  d.setDate(d.getDate() + 7); // 春节后一周
  d = getMonday(d);
  d.setDate(d.getDate() + 7); // 第二个完整周
  return d;
}

// 获取秋季学期第一教学周的周一
export function getDefaultAutumnFirstMonday(year: number): Date {
  // 9月第一个完整周的周一
  let d = new Date(year, 8, 1); // 9月1日
  d = getMonday(d);
  return d;
}

// 推算某日期的教学周序号
// 参数：date, firstMonday（数据库设置或默认推算）
export function getWeekIndex(date: Date, firstMonday: Date): number {
  const ms = date.getTime() - firstMonday.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// 例：
// const weekIdx = getWeekIndex(new Date('2024-03-18'), new Date('2024-02-26'));
// weekIdx === 4 