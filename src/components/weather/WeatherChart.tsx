
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
    // Prioritize capturing the .recharts-wrapper if available, otherwise fallback to the chartRef.current
    const chartElementToCapture = chartRef.current.querySelector('.recharts-wrapper') || chartRef.current;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartElementToCapture as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: 'hsl(var(--card))', // This should resolve based on current theme
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
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart for selected metrics. Click data points to use for AI forecast.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    margin: { top: 5, right: 40, left: 20, bottom: 20 }, // Keep bottom margin reduced
  };

  // Simplified for testing - always use Line for now
  const renderChartSpecificElements = () => {
    const firstNumericMetric = selectedMetrics.find(key => {
      const metricConfig = metricConfigs[key];
      return metricConfig && !metricConfig.isString;
    });

    if (!firstNumericMetric) return null;

    const metricConfig = metricConfigs[firstNumericMetric];
    const color = metricConfig.color || '#8884d8'; // Default color
    const name = metricConfig.name || firstNumericMetric;
    // const seriesKey = `line-${firstNumericMetric}`; // simplified key

    return <Line 
            key={`line-${firstNumericMetric}`} 
            type="monotone" 
            dataKey={firstNumericMetric} 
            stroke={color} 
            name={name} 
            dot={false} 
            // activeDot={false} // Simplification
            // onClick={undefined} // Simplification
           />;
  };
  
  // Force LineChart for this test
  const ChartComponent = LineChart;
  // const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'scatter' ? ScatterChart : LineChart;

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

  // Tooltip formatter remains for data inspection if needed, but Tooltip component itself is commented out for now
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
      <ChartComponent 
        key={chartDynamicKey} 
        data={formattedData} 
        width={700} // Fixed width
        height={530} // Fixed height (550px container - margins)
        {...commonCartesianProps}
      >
        {/* <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /> */}
        <XAxis
          dataKey="timestampDisplay"
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          // interval="preserveStartEnd" // Removed for simplification
          // minTickGap={20} // Removed for simplification
        />
        <YAxis
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          // tickFormatter={yAxisTickFormatter} // Temporarily removed
        />
        {/*
        <Tooltip
          // ... (Tooltip component remains commented out)
        />
        */}
        {/*
        <Legend
           // ... (Legend component remains commented out)
        />
        */}
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
        {/* The div with chartRef now directly contains the chart component without ResponsiveContainer */}
        <div ref={chartRef} className="w-[700px] h-[550px] bg-card mx-auto overflow-hidden">
          {renderChart()}
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


    