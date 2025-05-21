// 理论课空闲时间计算工具

// 节次与时间段映射
export const PERIOD_TIME = [
  { start: "08:30", end: "09:15" }, // 1
  { start: "09:25", end: "10:10" }, // 2
  { start: "10:20", end: "11:05" }, // 3
  { start: "11:15", end: "12:00" }, // 4
  { start: "14:10", end: "14:55" }, // 5
  { start: "15:05", end: "15:50" }, // 6
  { start: "16:00", end: "16:45" }, // 7
  { start: "16:45", end: "17:30" }, // 8
];
export const DEFAULT_THEORY_FREE = [
  { start: "08:30", end: "12:00" },
  { start: "14:10", end: "17:30" },
  { start: "18:30", end: "20:30" },
];

// 时间字符串转分钟
export function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
// 分钟转时间字符串
export function minToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// 合并理论课节次为忙碌区间（含课间）
export function mergeBusyPeriods(periods: number[]) {
  if (!periods.length) return [];
  const sorted = [...periods].sort((a, b) => a - b);
  const result: { start: string, end: string }[] = [];
  let groupStart = sorted[0] - 1;
  let groupEnd = sorted[0] - 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      groupEnd = sorted[i] - 1;
    } else {
      result.push({
        start: PERIOD_TIME[groupStart].start,
        end: PERIOD_TIME[groupEnd].end,
      });
      groupStart = sorted[i] - 1;
      groupEnd = sorted[i] - 1;
    }
  }
  result.push({
    start: PERIOD_TIME[groupStart].start,
    end: PERIOD_TIME[groupEnd].end,
  });
  return result;
}

// 求补：用默认空余时间减去忙碌区间
export function subtractBusyFromFree(free: {start:string,end:string}[], busy: {start:string,end:string}[]) {
  let freeMin = free.map(r => [timeToMin(r.start), timeToMin(r.end)]);
  let busyMin = busy.map(r => [timeToMin(r.start), timeToMin(r.end)]);
  let result: {start:string,end:string}[] = [];
  for (let [fs, fe] of freeMin) {
    let segs = [[fs, fe]];
    for (let [bs, be] of busyMin) {
      segs = segs.flatMap(([ss, se]) => {
        if (be <= ss || bs >= se) return [[ss, se]];
        let arr = [];
        if (bs > ss) arr.push([ss, bs]);
        if (be < se) arr.push([be, se]);
        return arr;
      });
    }
    result.push(...segs.map(([s, e]) => ({ start: minToTime(s), end: minToTime(e) })));
  }
  return result.filter(r => timeToMin(r.end) > timeToMin(r.start));
}

// 主函数：输入节次数组，输出真实空闲时间段
export function getTheoryFreeTime(periods: number[]) {
  const busy = mergeBusyPeriods(periods);
  return subtractBusyFromFree(DEFAULT_THEORY_FREE, busy);
} 