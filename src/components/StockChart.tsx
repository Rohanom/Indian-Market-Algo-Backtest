import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface StockData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface StockChartProps {
    data: StockData[];
    title?: string;
}

export const StockChart: React.FC<StockChartProps> = ({ data, title = 'Stock Price Chart' }) => {
    const chartData = {
        labels: data.map(item => item.date),
        datasets: [
            {
                label: 'Close Price',
                data: data.map(item => item.close),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: title,
            },
        },
        scales: {
            y: {
                beginAtZero: false,
            },
        },
    };

    return (
        <div className="w-full h-[500px] p-4 bg-white rounded-lg shadow-lg">
            <Line data={chartData} options={options} />
        </div>
    );
}; 