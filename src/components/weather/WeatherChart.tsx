
"use client";

import type { FC } from 'react';
import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';

interface WeatherChartProps {
  data: WeatherDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
}

const formatTimestampToDdMmHhMmUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
};

const formatTimestampToFullUTC = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = date.getUTCDate().toString().padStart(2, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};


const WeatherChart: FC<WeatherChartProps> = ({ data, selectedMetrics, metricConfigs, isLoading, onPointClick }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (document) => {
          // Ensures that the background of the chart container is explicitly white for export
          const chartContainer = document.querySelector('[data-chart]');
          if (chartContainer && chartContainer instanceof HTMLElement) {
            chartContainer.style.backgroundColor = 'white';
          }
        }
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
        <CardContent>
          <Skeleton className="h-[450px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartConfig = Object.fromEntries(
    selectedMetrics.map(key => [
      key,
      {
        label: metricConfigs[key].name,
        color: metricConfigs[key].color,
        icon: metricConfigs[key].Icon,
      },
    ])
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

  if (!data || data.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline">Historical Data Trends</CardTitle>
            <CardDescription>No data available for the selected range or metrics. Use date picker above.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">Please select a date range and metrics to view data, or check data source.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Interactive chart displaying selected weather metrics. 
            Click a point on the chart to use it for AI forecast, or use the button in the &quot;Historical Data Analysis&quot; section below the date picker to use all currently displayed data.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent ref={chartRef}> 
        <ChartContainer config={chartConfig} className="h-[450px] w-full bg-background"> {/* Added bg-background for consistent export */}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={formattedData} 
              margin={{ top: 5, right: 30, left: 0, bottom: 50 }}
              onClick={handleChartClick}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="timestampDisplay" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                angle={-30} 
                textAnchor="end"
                minTickGap={25}
                height={60} 
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(value) => typeof value === 'number' ? value.toFixed(0) : value}
                domain={['auto', 'auto']}
              />
              <Tooltip
                content={<ChartTooltipContent indicator="line" labelKey="tooltipTimestampFull" />}
                cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
                wrapperStyle={{ outline: 'none', zIndex: 100 }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedMetrics.map((key) => {
                const metricConfig = metricConfigs[key];
                if (metricConfig.isString) return null; 

                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={metricConfig.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: metricConfig.color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 1, stroke: metricConfig.color }}
                    name={metricConfig.name}
                    unit={metricConfig.unit}
                    connectNulls={false}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex justify-center p-4">
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
      </CardFooter>
    </Card>
  );
};

export default WeatherChart;
