import { useEffect, useRef } from 'react';
import { createChart, ColorType, Time, LineSeries } from 'lightweight-charts';

interface CCIChartProps {
    cci: { timestamp: string; value: number }[];
}

export const CCIChart = ({ cci }: CCIChartProps) => {
    const chartContainer = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainer.current) return;

        // Create chart
        const chart = createChart(chartContainer.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1e293b' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            width: chartContainer.current.clientWidth,
            height: 300,
            rightPriceScale: {
                borderColor: '#485563',
            },
            timeScale: {
                borderColor: '#485563',
            },
        });

        // Add CCI series
        const cciSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            title: 'CCI',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // Add horizontal reference lines for key CCI levels
        const overboughtExtreme = chart.addSeries(LineSeries, {
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: '+200 (Extreme Overbought)',
        });

        const overbought = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: '+100 (Overbought)',
        });

        const zeroLine = chart.addSeries(LineSeries, {
            color: '#6b7280',
            lineWidth: 1,
            lineStyle: 3, // dotted
            title: 'Zero Line',
        });

        const oversold = chart.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: '-100 (Oversold)',
        });

        const oversoldExtreme = chart.addSeries(LineSeries, {
            color: '#ef4444',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: '-200 (Extreme Oversold)',
        });

        // Set CCI data
        const cciData = cci
            .filter(item => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
            .map(item => ({
                time: new Date(item.timestamp).getTime() / 1000 as Time,
                value: item.value
            }));

        cciSeries.setData(cciData);

        // Create reference line data if we have CCI data
        if (cciData.length > 1) {
            const firstTime = cciData[0].time;
            const lastTime = cciData[cciData.length - 1].time;

            // Only create reference lines if we have different time points
            if (firstTime !== lastTime) {
                // Reference lines data
                const refLineData = [
                    { time: firstTime, value: 0 },
                    { time: lastTime, value: 0 }
                ];
                overboughtExtreme.setData(refLineData.map(item => ({ ...item, value: 200 })));
                overbought.setData(refLineData.map(item => ({ ...item, value: 100 })));
                zeroLine.setData(refLineData.map(item => ({ ...item, value: 0 })));
                oversold.setData(refLineData.map(item => ({ ...item, value: -100 })));
                oversoldExtreme.setData(refLineData.map(item => ({ ...item, value: -200 })));
            }
        }

        // Fit content to view
        chart.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (chartContainer.current) {
                chart.applyOptions({ width: chartContainer.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [cci]);

    if (cci.length === 0) {
        return (
            <div className="bg-gray-900 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">CCI Chart (5min)</h3>
                <div className="text-gray-400 text-center py-8">
                    Insufficient data for CCI calculation (need 21+ candles)
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 p-4 rounded shadow">
            <h3 className="text-lg font-semibold mb-4 text-white">CCI Chart (5min)</h3>
            <div ref={chartContainer} />
            
            {/* Legend */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-red-500 mr-2 rounded opacity-60"></div>
                    <span className="text-gray-300">±200 (Extreme)</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-yellow-500 mr-2 rounded opacity-60"></div>
                    <span className="text-gray-300">±100 (Strong)</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-500 mr-2 rounded opacity-20"></div>
                    <span className="text-gray-300">Normal Range</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-500 mr-2 rounded opacity-60"></div>
                    <span className="text-gray-300">Zero Line</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 mr-2 rounded"></div>
                    <span className="text-gray-300">CCI Value</span>
                </div>
            </div>
        </div>
    );
}; 