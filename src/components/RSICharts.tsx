import { useEffect, useRef } from 'react';
import { createChart, ColorType, Time, LineSeries } from 'lightweight-charts';

interface RSIChartsProps {
    rsi5min: {
        timestamp: string;
        value: number;
    }[];
    rsiSma5min: {
        timestamp: string;
        value: number;
    }[];
    rsi15min: {
        timestamp: string;
        value: number;
    }[];
    rsiSma15min: {
        timestamp: string;
        value: number;
    }[];
}

export const RSICharts = ({ rsi5min, rsiSma5min, rsi15min, rsiSma15min }: RSIChartsProps) => {
    const chartContainer5min = useRef<HTMLDivElement>(null);
    const chartContainer15min = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainer5min.current || !chartContainer15min.current) return;

        // Create 5min chart
        const chart5min = createChart(chartContainer5min.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1e293b' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            width: chartContainer5min.current.clientWidth,
            height: 200,
        });

        // Create 15min chart
        const chart15min = createChart(chartContainer15min.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#1e293b' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#334155' },
                horzLines: { color: '#334155' },
            },
            width: chartContainer15min.current.clientWidth,
            height: 200,
        });

        // Add RSI and RSI-SMA series to 5min chart
        const rsiSeries5min = chart5min.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            title: 'RSI',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });
        const rsiSmaSeries5min = chart5min.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            title: 'RSI-SMA',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // Add RSI and RSI-SMA series to 15min chart
        const rsiSeries15min = chart15min.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
            title: 'RSI',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });
        const rsiSmaSeries15min = chart15min.addSeries(LineSeries, {
            color: '#f59e0b',
            lineWidth: 2,
            title: 'RSI-SMA',
            priceFormat: {
                type: 'price',
                precision: 2,
                minMove: 0.01,
            },
        });

        // Set data for 5min chart
        rsiSeries5min.setData(rsi5min
            .filter(item => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
            .map(item => ({
                time: new Date(item.timestamp).getTime() / 1000 as Time,
                value: item.value
            })));
        rsiSmaSeries5min.setData(rsiSma5min
            .filter(item => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
            .map(item => ({
                time: new Date(item.timestamp).getTime() / 1000 as Time,
                value: item.value
            })));

        // Set data for 15min chart
        rsiSeries15min.setData(rsi15min
            .filter(item => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
            .map(item => ({
                time: new Date(item.timestamp).getTime() / 1000 as Time,
                value: item.value
            })));
        rsiSmaSeries15min.setData(rsiSma15min
            .filter(item => item.timestamp && !isNaN(new Date(item.timestamp).getTime()))
            .map(item => ({
                time: new Date(item.timestamp).getTime() / 1000 as Time,
                value: item.value
            })));

        // Fit content to view
        chart5min.timeScale().fitContent();
        chart15min.timeScale().fitContent();

        // Handle resize
        const handleResize = () => {
            if (chartContainer5min.current) {
                chart5min.applyOptions({ width: chartContainer5min.current.clientWidth });
            }
            if (chartContainer15min.current) {
                chart15min.applyOptions({ width: chartContainer15min.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart5min.remove();
            chart15min.remove();
        };
    }, [rsi5min, rsiSma5min, rsi15min, rsiSma15min]);

    return (
        <div className="space-y-4">
            <div className="bg-gray-900 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">5min RSI</h3>
                <div ref={chartContainer5min} />
            </div>
            <div className="bg-gray-900 p-4 rounded shadow">
                <h3 className="text-lg font-semibold mb-4 text-white">15min RSI</h3>
                <div ref={chartContainer15min} />
            </div>
        </div>
    );
}; 