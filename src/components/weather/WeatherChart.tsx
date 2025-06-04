
"use client";

import type { FC } from 'react';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2, Sun, Moon, Laptop } from 'lucide-react';

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
  data: WeatherDataPoint[] | any[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (point: WeatherDataPoint) => void;
  chartType: 'line' | 'bar' | 'scatter';
  isAggregated?: boolean;
  showMinMaxLines?: boolean;
  minMaxReferenceData?: Record<string, { minValue: number; maxValue: number }>;
}

type ExportThemeOption = 'current' | 'light' | 'dark';

const WeatherChart: FC<WeatherChartProps> = ({
  data: chartInputData,
  selectedMetrics,
  metricConfigs,
  isLoading,
  onPointClick,
  chartType,
  isAggregated = false,
  showMinMaxLines = false,
  minMaxReferenceData,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { theme: currentSystemTheme, resolvedTheme } = useTheme();
  const [exportThemeOption, setExportThemeOption] = useState<ExportThemeOption>('current');


  const formattedData = useMemo(() => {
    if (!chartInputData) {
      return [];
    }
    return chartInputData.map(point => ({
        ...point,
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp)),
    }));
  }, [chartInputData, isAggregated]);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current || isExporting) return;

    const chartElementToCapture = chartRef.current.querySelector('.recharts-wrapper') || chartRef.current;
    setIsExporting(true);

    const actualCurrentTheme = resolvedTheme || currentSystemTheme || 'light';
    const targetExportTheme = exportThemeOption === 'current' ? actualCurrentTheme : exportThemeOption;

    const htmlElement = document.documentElement;
    const originalHtmlClasses = htmlElement.className;

    if (targetExportTheme === 'light') {
      htmlElement.classList.remove('dark');
    } else if (targetExportTheme === 'dark') {
      htmlElement.classList.add('dark');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = (chartElementToCapture as HTMLElement).offsetHeight;
    await new Promise(resolve => setTimeout(resolve, 50)); 

    try {
      const canvas = await html2canvas(chartElementToCapture as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: targetExportTheme === 'dark' ? 'hsl(210 20% 5%)' : 'hsl(210 20% 98%)',
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
        link.download = `weather-chart-${targetExportTheme}.${format}`;
        link.href = imgData;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
    } finally {
      htmlElement.className = originalHtmlClasses;
      setIsExporting(false);
    }
  };

  const getPaddedMaxYDomain = (dataMax: number): number | 'auto' => {
    if (typeof dataMax !== 'number' || !isFinite(dataMax)) return 'auto';
    if (dataMax === 0) return 5; // Ensure some space if max is 0
    const padding = Math.max(Math.abs(dataMax * 0.05), 1); // At least 1 unit padding
    return Math.ceil(dataMax + padding);
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
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(chartType === 'line' || chartType === 'bar') && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || chartType === 'scatter') && " Point clicks can populate AI forecast."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    margin: { top: 50, right: 40, left: 20, bottom: 20 },
  };

  const yAxisTickFormatter = (value: any) => {
    if (typeof value === 'number' && isFinite(value)) {
      return isAggregated ? value.toFixed(1) : value.toFixed(0);
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
      const precision = isAggregated ? 1 : (config?.unit === 'ppm' ? 0 : (config?.isString ? 0 : 2));
      displayValue = value.toFixed(precision);
    } else if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      displayValue = 'N/A';
    } else {
      displayValue = String(value);
    }

    const unitString = (typeof value === 'number' && isFinite(value) && config?.unit) ? ` ${config.unit}` : '';
    return [`${displayValue}${unitString}`, config?.name || name];
  };

  const handleChartClick = (event: any) => {
    if (onPointClick && event && event.activePayload && event.activePayload.length > 0) {
      const clickedPointData = event.activePayload[0].payload;
       if (((chartType === 'line' && !isAggregated) || chartType === 'scatter')) {
         if ('rawTimestampString' in clickedPointData || chartType === 'scatter' || ('timestamp' in clickedPointData && !isAggregated && !('aggregationPeriod' in clickedPointData)) ) {
            onPointClick(clickedPointData as WeatherDataPoint);
         }
      }
    }
  };

  const renderChartSpecificElements = () => {
    return selectedMetrics.map((key) => {
      const metricConfig = metricConfigs[key];
      if (!metricConfig || (metricConfig.isString && chartType !== 'bar')) return null;

      const color = metricConfig.color || '#8884d8';
      const name = metricConfig.name || key;

      switch (chartType) {
        case 'line':
          return (
            <Line
              key={`line-${key}`}
              type="monotone"
              dataKey={key}
              stroke={color}
              name={name}
              dot={isAggregated ? { r: 3 } : false}
              connectNulls={false} 
            />
          );
        case 'bar':
          return (
            <Bar
              key={`bar-${key}`}
              dataKey={key}
              fill={color}
              name={name}
              radius={[4, 4, 0, 0]}
            />
          );
        case 'scatter':
          return (
            <Scatter
              key={`scatter-${key}`}
              dataKey={key}
              fill={color}
              name={name}
            />
          );
        default:
          return null;
      }
    });
  };

  let ChartComponent: React.ComponentType<any> = LineChart;
  if (chartType === 'bar') ChartComponent = BarChart;
  else if (chartType === 'scatter') ChartComponent = ScatterChart;

  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${formattedData.length}-${isAggregated}-${showMinMaxLines}`;

  const renderChart = () => (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComponent
        key={chartDynamicKey}
        data={formattedData}
        onClick={handleChartClick}
        {...commonCartesianProps}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="timestampDisplay"
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
          height={(chartType === 'line' && !isAggregated) ? 60 : 30}
          interval="preserveStartEnd"
          angle={(chartType === 'line' && !isAggregated) ? -45 : 0}
          textAnchor={(chartType === 'line' && !isAggregated) ? "end" : "middle"}
          dy={(chartType === 'line' && !isAggregated) ? 10 : 0}
          minTickGap={(chartType === 'line' && !isAggregated) ? 20 : 5}
        />
        <YAxis
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          tickFormatter={yAxisTickFormatter}
          domain={chartType === 'line' ? ['auto', getPaddedMaxYDomain] : ['auto', 'auto']}
        />
        <Tooltip
          formatter={tooltipFormatter}
          labelFormatter={(label, payload) => {
            if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
              return payload[0].payload.tooltipTimestampFull;
            }
            return label;
          }}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
            color: 'hsl(var(--popover-foreground))'
          }}
          itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
          cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          iconSize={14}
          layout="horizontal"
          align="center"
          verticalAlign="top"
        />
        {renderChartSpecificElements()}

        {showMinMaxLines && chartType === 'line' && minMaxReferenceData &&
          selectedMetrics.flatMap(metricKey => {
            const metricMinMax = minMaxReferenceData[metricKey];
            const metricConfig = metricConfigs[metricKey];
            
            if (!metricMinMax || !metricConfig || metricConfig.isString) {
              return [];
            }

            const { minValue, maxValue } = metricMinMax;
            
             if (typeof minValue !== 'number' || !isFinite(minValue) || typeof maxValue !== 'number' || !isFinite(maxValue)) {
                return [];
            }

            return [
              <ReferenceLine
                key={`min-line-${metricKey}`}
                y={Number(minValue)}
                stroke={metricConfig.color}
                strokeDasharray="2 2"
                strokeOpacity={0.7}
                strokeWidth={1}
                label={{ 
                  value: `Min: ${minValue.toFixed(isAggregated ? 1 : 0)}${metricConfig.unit || ''}`, 
                  position: "right", 
                  fill: metricConfig.color, 
                  fontSize: 10, 
                  dx: -30, 
                  dy: 7 
                }}
              />,
              <ReferenceLine
                key={`max-line-${metricKey}`}
                y={Number(maxValue)}
                stroke={metricConfig.color}
                strokeDasharray="2 2"
                strokeOpacity={0.7}
                strokeWidth={1}
                label={{ 
                  value: `Max: ${maxValue.toFixed(isAggregated ? 1 : 0)}${metricConfig.unit || ''}`, 
                  position: "right", 
                  fill: metricConfig.color, 
                  fontSize: 10, 
                  dx: -30, 
                  dy: -7
                }}
              />
            ];
          })
        }
      </ChartComponent>
    </ResponsiveContainer>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(chartType === 'line' || chartType === 'bar') && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || chartType === 'scatter') && " Point clicks can populate AI forecast."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div ref={chartRef} className="w-full h-[550px] bg-card mx-auto overflow-hidden">
          {renderChart()}
        </div>
        <div className="flex justify-center items-center pt-2 space-x-4">
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
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <Select value={exportThemeOption} onValueChange={(value) => setExportThemeOption(value as ExportThemeOption)}>
                  <SelectTrigger className="w-full h-9 text-xs mb-1">
                    <SelectValue placeholder="Select export theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current" className="text-xs">
                      <div className="flex items-center">
                        <Laptop className="mr-2 h-3.5 w-3.5" /> Current View Theme
                      </div>
                    </SelectItem>
                    <SelectItem value="light" className="text-xs">
                      <div className="flex items-center">
                        <Sun className="mr-2 h-3.5 w-3.5" /> Light Theme
                      </div>
                    </SelectItem>
                    <SelectItem value="dark" className="text-xs">
                      <div className="flex items-center">
                        <Moon className="mr-2 h-3.5 w-3.5" /> Dark Theme
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DropdownMenuSeparator />
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
    

    
