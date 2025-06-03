
"use client";

import type { FC } from 'react';
import { useRef, useState, useMemo, useEffect } from 'react';
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
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // UTC month is 0-indexed
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

export const formatTimestampToFullUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // UTC month is 0-indexed
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
    if (!data) {
      return [];
    }
    const processed = data.map((point) => ({
      ...point,
      timestampDisplay: formatTimestampToDdMmHhMmUTC(point.timestamp),
      tooltipTimestampFull: formatTimestampToFullUTC(point.timestamp),
    }));
    return processed;
  }, [data]);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    const chartElementToCapture = chartRef.current.querySelector('.recharts-wrapper') || chartRef.current;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartElementToCapture as HTMLElement, {
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
      // Consider adding a user-facing toast notification here for export errors
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-1/2 mb-2" />
          <Skeleton className="h-4 w-1/3" />
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <Skeleton className="h-[450px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!formattedData || formattedData.length === 0 || !selectedMetrics || selectedMetrics.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Select metrics and a date range to display data. Current Chart: {chartType.charAt(0).toUpperCase() + chartType.slice(1)}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    margin: { top: 5, right: 40, left: 20, bottom: 20 },
  };

  const renderChartSpecificElements = () => {
    return selectedMetrics.map((key) => {
      const metricConfig = metricConfigs[key];
      if (!metricConfig || metricConfig.isString) return null;

      const color = metricConfig.color || '#8884d8';
      const name = metricConfig.name || key;
      const seriesKey = `${chartType}-${key}`;


      switch (chartType) {
        case 'bar':
          return <Bar key={seriesKey} dataKey={key} fill={color} name={name} radius={[4, 4, 0, 0]} onClick={(payload) => onPointClick && payload && onPointClick(payload as unknown as WeatherDataPoint)} />;
        case 'scatter':
          return <Scatter key={seriesKey} dataKey={key} fill={color} name={name} onClick={(payload) => onPointClick && payload && onPointClick(payload as unknown as WeatherDataPoint)} />;
        case 'line':
        default:
          return <Line key={seriesKey} type="monotone" dataKey={key} stroke={color} name={name} dot={false} activeDot={{ r: 6 }} onClick={(payload) => onPointClick && payload && onPointClick(payload as unknown as WeatherDataPoint)}/>;
      }
    });
  };

  const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'scatter' ? ScatterChart : LineChart;
  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${formattedData.length}`;

  const yAxisTickFormatter = (value: any) => {
    if (typeof value === 'number' && isFinite(value)) {
      return value.toFixed(0);
    }
    if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      return 'N/A';
    }
    return String(value);
  };

  const tooltipFormatter = (value: any, name: any, entry: any) => {
    const dataKey = entry.dataKey as MetricKey;
    const config = metricConfigs[dataKey];
    let displayValue;

    if (typeof value === 'number' && isFinite(value)) {
      displayValue = value.toFixed(config?.isString ? 0 : (config?.unit === 'ppm' ? 0 : 2));
    } else if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      displayValue = 'N/A';
    } else {
      displayValue = String(value);
    }

    const unitString = (typeof value === 'number' && isFinite(value) && config?.unit) ? ` ${config.unit}` : '';
    return [`${displayValue}${unitString}`, config?.name || name];
  };


  const renderChart = () => (
      <ChartComponent key={chartDynamicKey} data={formattedData} {...commonCartesianProps}>
        {/* <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /> */}
        <XAxis
          dataKey="timestampDisplay"
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          // angle={-45} // Temporarily removed to test export
          // textAnchor="end" // Temporarily removed
          // dy={10} // Temporarily removed
          height={60} // Keep height to ensure space, adjust if necessary
          minTickGap={20} // Increased gap to reduce overlap for horizontal labels
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          tickFormatter={yAxisTickFormatter}
        />
        <Tooltip
          wrapperStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "0.25rem", padding: "0.5rem", color: "hsl(var(--popover-foreground))", boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', zIndex: 1000 }}
          labelStyle={{ fontWeight: "bold", color: "hsl(var(--popover-foreground))", marginBottom: "0.25rem" }}
          itemStyle={{ color: "hsl(var(--popover-foreground))" }}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.tooltipTimestampFull || label}
          formatter={tooltipFormatter}
        />
        <Legend
           wrapperStyle={{paddingBottom: '20px', paddingTop: '0px'}}
           iconSize={14}
           layout="horizontal"
           align="center"
           verticalAlign="top"
        />
        {renderChartSpecificElements()}
      </ChartComponent>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart for selected metrics. Click data points to use for AI forecast.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div ref={chartRef} className="w-full h-[550px] bg-card">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center pt-2">
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
