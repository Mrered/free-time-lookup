// 实训课空闲时间计算工具

export const DEFAULT_TRAINING_FREE = [
  { start: "07:30", end: "13:00" },
  { start: "14:00", end: "20:30" },
];

// 时间字符串转分钟
function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// 求补：用默认空余时间减去占用区间
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

// 主函数：输入timeBlocks，输出真实空闲时间段
export function getTrainingFreeTime(timeBlocks: string[]) {
  // timeBlocks如["14:00-17:30"]
  const busy = timeBlocks.map(tb => {
    const [start, end] = tb.split("-");
    return { start, end };
  });
  return subtractBusyFromFree(DEFAULT_TRAINING_FREE, busy);
} 