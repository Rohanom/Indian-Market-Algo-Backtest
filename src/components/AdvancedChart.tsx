'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, CandlestickSeries, Time } from 'lightweight-charts';

interface AdvancedChartProps {
    data: any[];
    title: string;
    onTimeframeChange: (timeframe: typeof TIMEFRAMES[number]['value']) => void;
    selectedTimeframe: typeof TIMEFRAMES[number]['value'];
}

const TIMEFRAMES = [
    { label: '1 Minute', value: 'minute' },
    { label: '5 Minutes', value: '5minute' },
    { label: '15 Minutes', value: '15minute' },
    { label: '30 Minutes', value: '30minute' },
    { label: '1 Hour', value: '60minute' },
    { label: '1 Day', value: 'day' },
] as const;

export const AdvancedChart = ({ data, title, onTimeframeChange, selectedTimeframe }: AdvancedChartProps) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#000000' },
                textColor: '#d1d5db',
            },
            grid: {
                vertLines: { color: '#1f2937' },
                horzLines: { color: '#1f2937' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 600,
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#374151',
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
            leftPriceScale: {
                borderColor: '#374151',
            },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#059669',
            downColor: '#dc2626',
            borderVisible: false,
            wickUpColor: '#059669',
            wickDownColor: '#dc2626',
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (chartRef.current) {
                chartRef.current.remove();
            }
        };
    }, []);

    useEffect(() => {
        if (!seriesRef.current || !data || data.length === 0) return;

        try {
            // Validate and format data
            const formattedData: CandlestickData[] = data
                .filter(item => {
                    // Filter out invalid data points
                    return item && 
                           item.date && 
                           !isNaN(Number(item.open)) && 
                           !isNaN(Number(item.high)) && 
                           !isNaN(Number(item.low)) && 
                           !isNaN(Number(item.close));
                })
                .map(item => {
                    // Parse the UTC date string
                    const dateStr = item.date;
                    // console.log('Original UTC date:', dateStr);
                    
                    // Convert UTC to IST (UTC+5:30)
                    const utcDate = new Date(dateStr);
                    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                    
                    // Format as yyyy-mm-dd hh:mm:ss
                    const formattedDate = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')} ${String(istDate.getHours()).padStart(2, '0')}:${String(istDate.getMinutes()).padStart(2, '0')}:${String(istDate.getSeconds()).padStart(2, '0')}`;
                    // console.log('Converted to IST:', formattedDate);
                    
                    // For the chart library, we need a timestamp
                    const timestamp = Math.floor(istDate.getTime() / 1000);
                    return {
                        time: timestamp as Time,
                        open: Number(item.open),
                        high: Number(item.high),
                        low: Number(item.low),
                        close: Number(item.close),
                    };
                })
                .sort((a, b) => (a.time as number) - (b.time as number)); // Sort by time

            if (formattedData.length > 0) {
                seriesRef.current.setData(formattedData);
            }
        } catch (error) {
            console.error('Error formatting chart data:', error);
        }
    }, [data]);

    return (
        <div className="bg-black p-4 rounded-lg shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                <div className="flex space-x-2">
                    {TIMEFRAMES.map((timeframe) => (
                        <button
                            key={timeframe.value}
                            onClick={() => onTimeframeChange(timeframe.value)}
                            className={`px-3 py-1 rounded text-sm ${
                                selectedTimeframe === timeframe.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}
                        >
                            {timeframe.label}
                        </button>
                    ))}
                </div>
            </div>
            <div ref={chartContainerRef} className="w-full h-[600px]" />
        </div>
    );
};