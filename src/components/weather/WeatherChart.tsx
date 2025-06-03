
"use client";

import type { FC } from 'react';
import { useRef, useState } from 'react';
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
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ScatterChart, Scatter } from 'recharts';
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

type ChartType = 'line' | 'bar' | 'scatter';

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
  chartType: ChartType;
}

const WeatherChart: FC<WeatherChartProps> = ({ data, selectedMetrics, metricConfigs, isLoading, onPointClick, chartType }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null, 
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
  
  const chartConfig = Object.fromEntries(
    selectedMetrics
      .map(key => {
        const config = metricConfigs[key];
        if (!config) {
            return null;
        }
        return [
          key,
          {
            label: config.name,
            color: config.color || 'hsl(var(--chart-1))',
            icon: config.Icon,
          },
        ];
      })
      .filter(Boolean) as [MetricKey, ChartConfig[MetricKey]][]
  ) as ChartConfig;
  
  const formattedData = data.map(point => ({
    ...point,
    timestampDisplay: typeof point.timestamp === 'number' ? formatTimestampToDdMmHhMmUTC(point.timestamp) : 'Invalid Date',
    tooltipTimestampFull: typeof point.timestamp === 'number' ? formatTimestampToFullUTC(point.timestamp) : 'Invalid Date',
  }));

  const handleChartClick = (event: any) => {
    if (onPointClick && event && event.activePayload && event.activePayload.length > 0) {
      const clickedPointData = event.activePayload[0].payload;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { timestampDisplay, tooltipTimestampFull, ...originalPoint } = clickedPointData;
      onPointClick(originalPoint as WeatherDataPoint);
    }
  };
  
  if ((!data || data.length === 0 || selectedMetrics.length === 0) && !isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline">Historical Data Trends</CardTitle>
            <CardDescription>No data available for the selected range or no metrics selected. Use controls above.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-[450px] flex items-center justify-center p-4">
          <p className="text-muted-foreground">Please select a date range and metrics to view data.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    data: formattedData,
    margin:{ top: 40, right: 50, left: 50, bottom: 120 },
    onClick: handleChartClick,
  };

  const commonAxisAndGridComponents = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
      <XAxis
        dataKey="timestampDisplay"
        stroke="#888888" 
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#333333', fontSize: 12 }}
        angle={-45}
        textAnchor="end"
        dy={10}
      />
      <YAxis
        stroke="#888888" 
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#333333', fontSize: 12 }}
        tickFormatter={(value) => (typeof value === 'number' ? value.toFixed(0) : String(value))}
      />
      <Tooltip
        cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
        wrapperStyle={{ 
            zIndex: 1000, 
            backgroundColor: '#ffffff', 
            border: '1px solid #cccccc', 
            borderRadius: 'var(--radius)', 
            padding: '10px',
            color: '#000000',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.1)'
        }}
        labelStyle={{ fontWeight: '600', marginBottom: '0.25rem', fontSize: '0.875rem' }}
        itemStyle={{ fontSize: '0.875rem' }}
        formatter={(value: any, name: any, entry: any) => {
            const metricKey = name as MetricKey;
            const config = metricConfigs[metricKey];
            const unit = config?.unit || '';
            const formattedValue = typeof value === 'number' ? value.toFixed(1) : String(value);
            return [`${formattedValue}${unit}`, config?.name || name];
        }}
        labelFormatter={(label: any, payload: any) => {
            if (payload && payload.length > 0 && payload[0] && payload[0].payload && typeof payload[0].payload.tooltipTimestampFull === 'string') {
              return payload[0].payload.tooltipTimestampFull;
            }
            return String(label); 
        }}
      />
      <ChartLegend 
        content={<ChartLegendContent />} 
        wrapperStyle={{ paddingTop: "40px" }}
      />
    </>
  );

  const renderChartSpecificElements = () => {
    return selectedMetrics.map((key) => {
      const metricConfig = metricConfigs[key];
      if (!metricConfig || metricConfig.isString) return null;
      const color = metricConfig.color || chartConfig[key]?.color || 'hsl(var(--chart-1))';

      if (chartType === 'line') {
        return (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={2}
            dot={false}
            name={metricConfig.name}
            connectNulls={false}
          />
        );
      } else if (chartType === 'bar') {
        return (
          <Bar
            key={key}
            dataKey={key}
            fill={color}
            name={metricConfig.name}
            radius={[4, 4, 0, 0]}
          />
        );
      } else if (chartType === 'scatter') {
        return (
          <Scatter
            key={key}
            dataKey={key}
            fill={color}
            name={metricConfig.name}
          />
        );
      }
      return null;
    });
  };
  
  const renderChart = () => {
    const chartSpecificProps = { ...commonCartesianProps }; 

    if (chartType === 'line') {
      return <LineChart {...chartSpecificProps}>{commonAxisAndGridComponents}{renderChartSpecificElements()}</LineChart>;
    } else if (chartType === 'bar') {
      return <BarChart {...chartSpecificProps}>{commonAxisAndGridComponents}{renderChartSpecificElements()}</BarChart>;
    } else if (chartType === 'scatter') {
      return <ScatterChart {...chartSpecificProps}>{commonAxisAndGridComponents}{renderChartSpecificElements()}</ScatterChart>;
    }
    return <LineChart {...chartSpecificProps}>{commonAxisAndGridComponents}{renderChartSpecificElements()}</LineChart>; 
  };

  const chartContainerKey = `${chartType}-${selectedMetrics.join('-')}`;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="font-headline">Historical Data Trends ({chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart)</CardTitle>
          <CardDescription>
            Interactive {chartType} chart displaying selected weather metrics.
            Click a point on the chart to use it for AI forecast, or use the button in the section above to use all currently displayed data.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <div ref={chartRef}>
          <ChartContainer
            key={chartContainerKey}
            config={chartConfig}
            className="h-[550px] w-full" 
          >
            {renderChart()}
          </ChartContainer>
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

