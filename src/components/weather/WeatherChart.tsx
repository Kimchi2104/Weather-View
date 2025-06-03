
"use client";

import type { FC } from 'react';
import { useRef, useState, useMemo } from 'react'; // Removed useEffect as it's not used in this simplified version
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';

// export const formatTimestampToDdMmHhMmUTC = (timestamp: number): string => {
//   const date = new Date(timestamp);
//   const day = date.getUTCDate().toString().padStart(2, '0');
//   const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
//   const hours = date.getUTCHours().toString().padStart(2, '0');
//   const minutes = date.getUTCMinutes().toString().padStart(2, '0');
//   return `${day}/${month} ${hours}:${minutes}`;
// };

// export const formatTimestampToFullUTC = (timestamp: number): string => {
//   const date = new Date(timestamp);
//   const day = date.getUTCDate().toString().padStart(2, '0');
//   const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
//   const year = date.getUTCFullYear();
//   const hours = date.getUTCHours().toString().padStart(2, '0');
//   const minutes = date.getUTCMinutes().toString().padStart(2, '0');
//   const seconds = date.getUTCSeconds().toString().padStart(2, '0');
//   return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} UTC`;
// };

interface WeatherChartProps {
  data: WeatherDataPoint[]; // Real data still passed as prop, but not used by dummy chart
  selectedMetrics: MetricKey[]; // Real prop, not used by dummy chart
  metricConfigs: Record<MetricKey, MetricConfig>; // Real prop, not used by dummy chart
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void; // Real prop, not used by dummy chart
  chartType: 'line' | 'bar' | 'scatter'; // Real prop, not used by dummy chart
}

const WeatherChart: FC<WeatherChartProps> = ({ 
  data: realData, // Renaming to avoid confusion with dummyData
  selectedMetrics: realSelectedMetrics,
  // metricConfigs, 
  isLoading, 
  // onPointClick, 
  // chartType 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Hardcoded dummy data for testing
  const dummyData = [
    { label: "Jan", value: 100, value2: 150 },
    { label: "Feb", value: 120, value2: 130 },
    { label: "Mar", value: 150, value2: 180 },
    { label: "Apr", value: 130, value2: 160 },
    { label: "May", value: 160, value2: 190 },
    { label: "Jun", value: 140, value2: 170 },
  ];

  console.log("[WeatherChart] Using DUMMY DATA for testing. Real props:", { realDataLength: realData?.length, realSelectedMetrics });

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', format === 'jpeg' ? 0.9 : 1.0);
      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save('weather-chart.pdf');
      } else {
        const link = document.createElement('a');
        link.download = `weather-chart.${format}`;
        link.href = imgData;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <Skeleton className="h-6 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="p-4">
          <Skeleton className="h-[450px] w-full" />
        </CardContent>
      </Card>
    );
  }
  
  // Basic check if realData would have been empty, for context, even though we use dummyData
  if (!realData || realData.length === 0 || !realSelectedMetrics || realSelectedMetrics.length === 0) {
     console.log("[WeatherChart] Note: Real data or selected metrics would have been empty.");
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="font-headline">Historical Data Trends (Dummy Test)</CardTitle>
          <CardDescription>
            Displaying a hardcoded dummy chart for debugging purposes.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div ref={chartRef} className="w-full h-[550px]"> {/* Explicit height for ResponsiveContainer's parent */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={dummyData} 
              margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="label" 
                stroke="#888888" 
                tick={{ fill: "#555555", fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                dy={10}
                minTickGap={5}
              />
              <YAxis 
                stroke="#888888" 
                tick={{ fill: "#555555", fontSize: 12 }}
                tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : String(value))}
              />
              <Tooltip
                wrapperStyle={{ zIndex: 1000, backgroundColor: "#ffffff", border: "1px solid #cccccc", borderRadius: "3px", padding: "10px", color: "#000000", boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: "bold", color: "#333333", marginBottom: "4px" }}
                itemStyle={{ color: "#333333" }}
              />
              <Legend wrapperStyle={{ paddingTop: "20px", paddingBottom: "10px" }} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={2}
                name="Dummy Value 1"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="value2"
                stroke="#82ca9d"
                strokeWidth={2}
                name="Dummy Value 2"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center -mt-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={isExporting} className="min-w-[150px]">
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export Chart
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => exportChart('png')}>
                <FileImage className="mr-2 h-4 w-4" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportChart('jpeg')}>
                <FileImage className="mr-2 h-4 w-4" />
                Export as JPEG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportChart('pdf')}>
                <FileText className="mr-2 h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherChart;
    
