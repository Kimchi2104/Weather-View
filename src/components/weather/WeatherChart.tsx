
"use client";

import type { FC } from 'react';
import { useRef, useState, useMemo } from 'react';
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';

export const formatTimestampToDdMmHhMmUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const formatTimestampToFullUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} UTC`;
};

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
  chartType: 'line' | 'bar' | 'scatter';
}

const WeatherChart: FC<WeatherChartProps> = ({
  data,
  selectedMetrics,
  metricConfigs,
  isLoading,
  onPointClick,
  chartType
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const formattedData = useMemo(() => {
    if (!data) return [];
    const processed = data.map((point) => ({
      ...point,
      timestampDisplay: formatTimestampToDdMmHhMmUTC(point.timestamp),
      tooltipTimestampFull: formatTimestampToFullUTC(point.timestamp),
    }));
    // console.log("[WeatherChart] Formatted Data (first 3):", processed.slice(0,3));
    return processed;
  }, [data]);

  // console.log("[WeatherChart] Props:", { dataLength: data?.length, selectedMetrics, chartType, isLoading });
  // console.log("[WeatherChart] metricConfigs:", metricConfigs);


  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current.querySelector('.recharts-wrapper') || chartRef.current, { // Target recharts-wrapper for better accuracy
        scale: 2,
        useCORS: true,
        backgroundColor: 'hsl(var(--card))',
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

  if (!formattedData || formattedData.length === 0 || !selectedMetrics || selectedMetrics.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Select metrics and a date range to display data. Current Chart: {chartType.charAt(0).toUpperCase() + chartType.slice(1)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    margin: { top: 20, right: 30, left: 20, bottom: 80 },
  };

  const renderChartSpecificElements = () => {
    return selectedMetrics.map((key) => {
      const metricConfig = metricConfigs[key];
      if (!metricConfig || metricConfig.isString) return null; // Don't plot string data like "Precipitation Description"

      const color = metricConfig.color || '#8884d8'; // Default color if not specified
      const name = metricConfig.name || key;

      switch (chartType) {
        case 'bar':
          return <Bar key={key} dataKey={key} fill={color} name={name} radius={[4, 4, 0, 0]} />;
        case 'scatter':
          return <Scatter key={key} dataKey={key} fill={color} name={name} />;
        case 'line':
        default:
          return <Line key={key} type="monotone" dataKey={key} stroke={color} name={name} dot={false} activeDot={{ r: 6 }} onClick={(payload) => onPointClick && payload && onPointClick(payload as unknown as WeatherDataPoint)}/>;
      }
    });
  };
  
  const renderChart = () => {
    const chartKey = `${chartType}-${selectedMetrics.join('-')}-${formattedData.length}`;

    switch (chartType) {
      case 'bar':
        return (
          <BarChart key={chartKey} data={formattedData} {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="timestampDisplay" stroke="#888888" tick={{ fill: "#555555", fontSize: 11 }} angle={-45} textAnchor="end" dy={10} minTickGap={5} interval="preserveStartEnd" />
            <YAxis stroke="#888888" tick={{ fill: "#555555", fontSize: 12 }} tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : String(value))} />
            <Tooltip wrapperStyle={{ zIndex: 1000, backgroundColor: "#ffffff", border: "1px solid #cccccc", borderRadius: "3px", padding: "10px", color: "#000000", boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: "bold", color: "#333333", marginBottom: "4px" }} itemStyle={{ color: "#333333" }} labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipTimestampFull || label} formatter={(value: any, name: any, entry: any) => { const config = metricConfigs[name as MetricKey]; return [`${typeof value === 'number' ? value.toFixed(config?.isString ? 0 : 2) : value}${config?.unit || ''}`, config?.name || name]; }} />
            <Legend wrapperStyle={{ paddingTop: "20px", paddingBottom: "10px" }} />
            {renderChartSpecificElements()}
          </BarChart>
        );
      case 'scatter':
        return (
          <ScatterChart key={chartKey} data={formattedData} {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis type="category" dataKey="timestampDisplay" name="Time" stroke="#888888" tick={{ fill: "#555555", fontSize: 11 }} angle={-45} textAnchor="end" dy={10} minTickGap={5} interval="preserveStartEnd" />
            <YAxis type="number" dataKey={selectedMetrics.find(m => !metricConfigs[m]?.isString) || selectedMetrics[0]} name="Value" stroke="#888888" tick={{ fill: "#555555", fontSize: 12 }} tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : String(value))} />
            <Tooltip wrapperStyle={{ zIndex: 1000, backgroundColor: "#ffffff", border: "1px solid #cccccc", borderRadius: "3px", padding: "10px", color: "#000000", boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: "bold", color: "#333333", marginBottom: "4px" }} itemStyle={{ color: "#333333" }} labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipTimestampFull || label} formatter={(value: any, name: any, entry: any) => { const config = metricConfigs[name as MetricKey]; return [`${typeof value === 'number' ? value.toFixed(config?.isString ? 0 : 2) : value}${config?.unit || ''}`, config?.name || name]; }} cursor={{ strokeDasharray: '3 3' }} />
            <Legend wrapperStyle={{ paddingTop: "20px", paddingBottom: "10px" }} />
            {renderChartSpecificElements()}
          </ScatterChart>
        );
      case 'line':
      default:
        return (
          <LineChart key={chartKey} data={formattedData} {...commonCartesianProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="timestampDisplay" stroke="#888888" tick={{ fill: "#555555", fontSize: 11 }} angle={-45} textAnchor="end" dy={10} minTickGap={5} interval="preserveStartEnd" />
            <YAxis stroke="#888888" tick={{ fill: "#555555", fontSize: 12 }} tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : String(value))} />
            <Tooltip wrapperStyle={{ zIndex: 1000, backgroundColor: "#ffffff", border: "1px solid #cccccc", borderRadius: "3px", padding: "10px", color: "#000000", boxShadow: '2px 2px 5px rgba(0,0,0,0.1)' }} labelStyle={{ fontWeight: "bold", color: "#333333", marginBottom: "4px" }} itemStyle={{ color: "#333333" }} labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipTimestampFull || label} formatter={(value: any, name: any, entry: any) => { const config = metricConfigs[name as MetricKey]; return [`${typeof value === 'number' ? value.toFixed(config?.isString ? 0 : 2) : value}${config?.unit || ''}`, config?.name || name]; }} />
            <Legend wrapperStyle={{ paddingTop: "20px", paddingBottom: "10px" }} />
            {renderChartSpecificElements()}
          </LineChart>
        );
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart for selected metrics.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div ref={chartRef} className="w-full h-[550px] bg-background">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center -mt-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={isExporting || !formattedData || formattedData.length === 0} className="min-w-[150px]">
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
