"use client";
import { useState, useEffect } from "react";
import { Button, Card, Spin, Empty, message as antdMessage } from "antd"; // 修改处：导入 antdMessage
import { Bar } from "@ant-design/charts";
import { useRouter } from "next/navigation"; // Corrected import for App Router

// 定义 DataRow 接口，与 console/page.tsx 保持一致，用于图表数据
interface DataRow {
  name: string;
  class: string; // 虽然图表不用，但保持接口一致性
  weekday: number;
  isTheory: boolean;
  periods: number[];
  weekType: boolean | null;
  timeBlocks: string[];
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

export default function HomePage() {
  const [chartData, setChartData] = useState<{ name: string; freeDays: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 获取数据用于图表展示
  const fetchDataForChart = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/upload-excel`, { method: "GET" });
      const result = await res.json();
      let fetchedData: DataRow[] = [];
      if (Array.isArray(result.value)) {
        fetchedData = result.value;
      } else if (typeof result.value === "string") {
        try {
          fetchedData = JSON.parse(result.value);
        } catch (e) {
          console.error("解析图表数据失败:", e);
        }
      }

      if (fetchedData.length > 0) {
        // 计算未来7天内所有人的空闲天数
        const today = new Date();
        const daysWindow = 7; // 可调整
        const people = Array.from(new Set(fetchedData.map(row => row.name)));

        const stats = people.map(name => {
          let freeDays = 0;
          for (let i = 0; i < daysWindow; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const currentDayOfWeek = d.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday

            // 只统计工作日 (周一到周五)
            if (currentDayOfWeek >= 1 && currentDayOfWeek <= 5) {
                // 检查当天是否有任何课程安排（理论或实训）
                const hasAnyClass = fetchedData.some(row =>
                    row.name === name &&
                    (
                        (row.isTheory && row.weekday === currentDayOfWeek) || // 理论课在当天 (假设 weekday 1=周一, ..., 5=周五)
                        (!row.isTheory && // 对于实训课，如果它有特定的星期安排且是当天
                            (
                              (row.weekday === currentDayOfWeek) || // 实训课明确安排在这一天
                              (row.weekday === 0 && row.weekType !== null) // 或者，如果 weekday 为 0 且有 weekType，表示特定周的周末安排，这里不计入工作日空闲
                                                                        // 但如果实训课的 weekday 也是 1-5，则上面的判断已足够
                                                                        // 简化：如果当天是工作日，且有任何该老师的实训课记录（无论 weekday 如何标记），都认为不空闲
                                                                        // 除非实训课的 weekday 也严格对应 1-5
                            )
                        )
                    )
                );
                 // 更精确的实训课判断:
                 // 假设实训课的 weekday 也是 1-5 表示周一到周五，或者 weekday 为 0/null/其他值表示按 timeBlocks 和 weekType
                 // 为了简化，我们只看 weekday 是否匹配当前工作日
                 const hasPracticalClassOnThisWeekday = fetchedData.some(row =>
                    row.name === name &&
                    !row.isTheory &&
                    row.weekday === currentDayOfWeek // 假设实训课的 weekday 也用 1-5 表示
                 );


              if (!hasAnyClass) { // 如果没有任何课程安排
                freeDays++;
              }
            }
          }
          return { name, freeDays };
        });
        setChartData(stats);
      } else {
        setChartData([]);
      }
    } catch (err) {
      console.error("获取图表数据失败:", err);
      antdMessage.error("获取图表数据失败"); // 正确使用 antdMessage
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataForChart();
  }, []);

  // 配置条形图
  const barConfig = {
    data: chartData,
    xField: 'freeDays',
    yField: 'name',
    seriesField: 'name', // 根据姓名区分颜色，如果需要统一颜色则移除
    legend: false,
    color: '#1677ff',
    xAxis: { title: { text: '未来7天空闲天数 (工作日)' } , min:0, max: 7},
    yAxis: { title: { text: '教师姓名' } },
    height: Math.max(chartData.length * 35, 250),
    barWidthRatio: 0.6,
    label: {
        position: 'middle' as const,
        layout: [{ type: 'interval-adjust-position' as const }], // 明确指定类型
        style: {
            fill: '#fff',
            fontWeight: 'bold',
        },
        formatter: (datum: any) => `${datum.freeDays}`,
    },
    tooltip: { formatter: (datum: any) => ({ name: '空闲天数', value: `${datum.freeDays} 天` }) },
    interactions: [{ type: 'active-region' as const }], // 明确指定类型
    animation: { appear: { animation: 'path-in', duration: 800 } },
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl text-center mt-8 sm:mt-12 mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 mb-3 sm:mb-4 tracking-tight">
          兴趣班空余时间可视化平台
        </h1>
        <p className="text-gray-700 text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 max-w-2xl mx-auto">
          一目了然地查看所有教师在未来一周的空闲时间，助力高效排课与资源协调。
        </p>
      </div>

      <Card
        title={<span className="text-xl font-semibold text-blue-700">未来7天教师空闲时间统计</span>}
        bordered={false}
        className="w-full max-w-3xl bg-white rounded-xl shadow-xl p-4 sm:p-6 lg:p-8 mb-8"
      >
        <p className="text-gray-500 mb-4 text-sm">
          统计规则：当天（工作日）没有任何理论课或实训课安排即视为全天空闲。
        </p>
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="图表加载中..." />
          </div>
        ) : chartData.length > 0 ? (
          <Bar {...barConfig} />
        ) : (
          <Empty description="暂无数据或所有教师未来7天均无空闲" className="py-10"/>
        )}
      </Card>

      <Button
        type="primary"
        size="large"
        className="mt-4 sm:mt-6 text-base sm:text-lg font-semibold px-8 py-3 h-auto shadow-md hover:shadow-lg transition-shadow duration-300"
        onClick={() => router.push('/console')}
      >
        进入数据管理控制台
      </Button>

      <footer className="mt-12 sm:mt-16 text-gray-500 text-xs text-center w-full">
        © {new Date().getFullYear()} 兴趣班空余时间系统. All rights reserved.
      </footer>
    </div>
  );
}
