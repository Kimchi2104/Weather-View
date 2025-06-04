
"use client";

import type { FC } from 'react';
import React, { useRef, useState, useMemo } from 'react';
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, ReferenceLine, ZAxis } from 'recharts';
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

// Define min/max bubble area for ZAxis scaling
const MIN_BUBBLE_AREA = 60; // Min pixel area for the smallest bubble
const MAX_BUBBLE_AREA = 1000; // Max pixel area for the largest bubble


const getPaddedMinYDomain = (dataMin: number, dataMax: number): number => {
  let paddedMin;
  const range = dataMax - dataMin;

  if (dataMin >= 0 && dataMin <= 30) {
    if (range <= 200 && dataMax <= 200) { // Small min, small overall range
      paddedMin = -10;
    } else { // Small min, large overall range (e.g. AQI 0 to 5000)
      const proportionalPadding = Math.max(10, 0.05 * dataMax);
      paddedMin = Math.floor(dataMin - proportionalPadding);
      if (dataMin >= 0 && paddedMin > -2) paddedMin = -2; // Ensure it's at least -2 for visibility of 0
    }
  } else if (dataMin > 30) {
    const padding = Math.max(5, 0.15 * dataMin); 
    paddedMin = Math.floor(dataMin - padding);
  } else { // dataMin is negative
    const padding = Math.max(3, 0.15 * Math.abs(dataMin));
    paddedMin = Math.floor(dataMin - padding);
  }
  // console.log(`[WeatherChart] getPaddedMinYDomain: dataMin=${dataMin}, dataMax=${dataMax}, output=${paddedMin}`);
  return paddedMin;
};

const getPaddedMaxYDomain = (dataMax: number, dataMin: number): number => {
  let paddedMax;
  const range = dataMax - dataMin;

  if (dataMax >= 0 && dataMax < 10) { 
     if (range <= 200 && dataMin >= -100) { 
      paddedMax = Math.ceil(dataMax + Math.max(3, 0.5 * (dataMax - Math.max(0, dataMin) +1)));
      if (dataMax === 0 && paddedMax < 10) paddedMax = 10;
    } else { 
      const proportionalPadding = Math.max(10, 0.05 * Math.abs(dataMin));
      paddedMax = Math.ceil(dataMax + proportionalPadding);
    }
  } else if (dataMax >= 10) { 
    const padding = Math.max(5, 0.15 * dataMax);
    paddedMax = Math.ceil(dataMax + padding);
  } else { // dataMax is negative
    const padding = Math.max(3, 0.15 * Math.abs(dataMax));
    paddedMax = Math.ceil(dataMax + padding);
    if (paddedMax > 0 && dataMax < 0) paddedMax = 0; // Don't cross 0 unnecessarily
  }
  // console.log(`[WeatherChart] getPaddedMaxYDomain: dataMax=${dataMax}, dataMin=${dataMin}, output=${paddedMax}`);
  return paddedMax;
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

  const yAxisDomain = useMemo(() => {
    const dataValues = selectedMetrics.flatMap(metricKey =>
      formattedData.map(p => {
        // For aggregated scatter, use the _avg value for domain calculation
        if (chartType === 'scatter' && isAggregated) {
          return p[`${metricKey}_avg`] as number;
        }
        return p[metricKey] as number;
      }).filter(v => typeof v === 'number' && isFinite(v))
    );

    let effectiveMin = dataValues.length > 0 ? Math.min(...dataValues) : Infinity;
    let effectiveMax = dataValues.length > 0 ? Math.max(...dataValues) : -Infinity;
    
    if (dataValues.length === 0) { 
        effectiveMin = 0;
        effectiveMax = 10;
    }

    if (showMinMaxLines && minMaxReferenceData && chartType === 'line') {
        selectedMetrics.forEach(metricKey => {
            const metricMinMax = minMaxReferenceData[metricKey];
            if (metricMinMax && typeof metricMinMax.minValue === 'number' && isFinite(metricMinMax.minValue)) {
                effectiveMin = Math.min(effectiveMin, metricMinMax.minValue);
            }
            if (metricMinMax && typeof metricMinMax.maxValue === 'number' && isFinite(metricMinMax.maxValue)) {
                effectiveMax = Math.max(effectiveMax, metricMinMax.maxValue);
            }
        });
    }
    
    const paddedMin = getPaddedMinYDomain(effectiveMin, effectiveMax);
    const paddedMax = getPaddedMaxYDomain(effectiveMax, effectiveMin);
    
    // console.log(`[WeatherChart] yAxisDomain useMemo: effectiveMin=${effectiveMin}, effectiveMax=${effectiveMax}, paddedMin=${paddedMin}, paddedMax=${paddedMax}`);
    
    return [paddedMin, paddedMax] as [number | 'auto', number | 'auto'];
  }, [formattedData, selectedMetrics, showMinMaxLines, minMaxReferenceData, chartType, isAggregated]);

  const metricsWithMinMaxLines = useMemo(() => {
    if (!showMinMaxLines || !minMaxReferenceData || chartType !== 'line') return [];
    return selectedMetrics.filter(metricKey => {
        const metricMinMax = minMaxReferenceData[metricKey];
        const metricConfig = metricConfigs[metricKey];
        if (!metricMinMax || !metricConfig || metricConfig.isString) return false;
        const { minValue, maxValue } = metricMinMax;
        return typeof minValue === 'number' && isFinite(minValue) && typeof maxValue === 'number' && isFinite(maxValue);
    }).sort(); // Sort for consistent label staggering
  }, [showMinMaxLines, minMaxReferenceData, selectedMetrics, metricConfigs, chartType]);


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
            {(chartType !== 'scatter' || (chartType === 'scatter' && isAggregated)) && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && " Bubble size indicates data spread (standard deviation)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

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
    
    await new Promise(resolve => setTimeout(resolve, 100));


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
        pdf.save(`weather-chart-${targetExportTheme}.pdf`);
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

  const commonCartesianProps = {
    margin: { top: 0, right: 80, left: 30, bottom: 20 },
  };

  const yAxisTickFormatter = (value: any) => {
    if (typeof value === 'number' && isFinite(value)) {
      return value.toFixed( (chartType === 'line' || chartType === 'scatter') && Math.abs(value) < 10 && value !== 0 ? 1 : 0 ); 
    }
    if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      return 'N/A';
    }
    return String(value);
  };

  const tooltipFormatter = (value: any, name: any, entry: any) => {
    const dataKey = entry.dataKey as MetricKey | string; // Can be "metricKey_avg"
    const originalMetricKey = dataKey.replace(/_avg$/, '') as MetricKey;
    const config = metricConfigs[originalMetricKey];
    
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
    const baseLabel = config?.name || name;

    if (chartType === 'scatter' && isAggregated && entry.payload) {
        const stdDev = entry.payload[`${originalMetricKey}_stdDev`];
        const count = entry.payload[`${originalMetricKey}_count`];
        let tooltipContent = [`Avg. ${baseLabel}: ${displayValue}${unitString}`];
        if (typeof stdDev === 'number') {
            tooltipContent.push(`Std. Dev: ${stdDev.toFixed(2)}${unitString}`);
        }
        if (typeof count === 'number') {
            tooltipContent.push(`Data Points: ${count}`);
        }
        return [tooltipContent.join('\n'), null]; // Return array for multi-line, null for name part
    }

    return [`${displayValue}${unitString}`, baseLabel];
  };


  const handleChartClick = (event: any) => {
    if (onPointClick && event && event.activePayload && event.activePayload.length > 0) {
      const clickedPointData = event.activePayload[0].payload;
       if ((chartType === 'line' && !isAggregated) || (chartType === 'scatter' && !isAggregated)) {
         if ('rawTimestampString' in clickedPointData || ('timestamp' in clickedPointData && !isAggregated && !('aggregationPeriod' in clickedPointData)) ) {
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
              dataKey={key} // For line chart, dataKey directly uses metricKey (which holds avg if aggregated)
              stroke={color}
              name={name}
              dot={isAggregated ? { r: 3 } : false}
              connectNulls={false} 
              animationDuration={300}
            />
          );
        case 'bar':
          return (
            <Bar
              key={`bar-${key}`}
              dataKey={key} // For bar chart, dataKey directly uses metricKey
              fill={color}
              name={name}
              radius={[4, 4, 0, 0]}
              animationDuration={300}
            />
          );
        case 'scatter':
          const avgDataKey = isAggregated ? `${key}_avg` : key;
          const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
          const zAxisId = isAggregated ? `${key}_z` : undefined;

          return (
            <React.Fragment key={`scatter-frag-${key}`}>
              {isAggregated && stdDevDataKey && (
                <ZAxis
                  key={`zaxis-${key}`}
                  zAxisId={zAxisId}
                  type="number"
                  dataKey={stdDevDataKey}
                  range={[MIN_BUBBLE_AREA, MAX_BUBBLE_AREA]}
                  name="Data Spread (Std. Dev.)"
                />
              )}
              <Scatter
                key={`scatter-${key}`}
                name={name}
                dataKey={avgDataKey}
                fill={color}
                shape="circle"
                zAxisId={zAxisId}
                animationDuration={300}
              />
            </React.Fragment>
          );
        default:
          return null;
      }
    });
  };

  let ChartComponent: React.ComponentType<any> = LineChart;
  if (chartType === 'bar') ChartComponent = BarChart;
  else if (chartType === 'scatter') ChartComponent = ScatterChart;
  
  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${formattedData.length}-${isAggregated}-${showMinMaxLines}-${JSON.stringify(yAxisDomain)}`;
  
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
          height={((chartType === 'line' || chartType === 'scatter') && !isAggregated) ? 60 : 30}
          interval="preserveStartEnd"
          angle={((chartType === 'line' || chartType === 'scatter') && !isAggregated) ? -45 : 0}
          textAnchor={((chartType === 'line' || chartType === 'scatter') && !isAggregated) ? "end" : "middle"}
          dy={((chartType === 'line' || chartType === 'scatter') && !isAggregated) ? 10 : 0}
          minTickGap={((chartType === 'line' || chartType === 'scatter') && !isAggregated) ? 20 : 5}
        />
        <YAxis
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          tickFormatter={yAxisTickFormatter}
          domain={yAxisDomain}
          allowDecimals={true}
          type="number"
          scale="linear"
          allowDataOverflow={chartType === 'line' || chartType === 'scatter' ? true : undefined} // Allow for scatter as well
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
            color: 'hsl(var(--popover-foreground))',
            whiteSpace: 'pre-line', // Allow \n for newlines in tooltip
          }}
          itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
          cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' }}
          animationDuration={150}
          animationEasing="ease-out"
        />
        <Legend
          wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
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
            
            const orderIndex = metricsWithMinMaxLines.indexOf(metricKey);
            const activeOrderIndex = orderIndex !== -1 ? orderIndex : 0;
            
            const dyMinLabel = 5 + activeOrderIndex * 12;
            const dyMaxLabel = -5 - activeOrderIndex * 12;

            // console.log(`[WeatherChart] Rendering MinMax lines for ${metricKey} with minValue: ${minValue}, maxValue: ${maxValue}, color: ${metricConfig.color}, dyMin: ${dyMinLabel}, dyMax: ${dyMaxLabel}`);

            return [
              <ReferenceLine
                key={`min-line-${metricKey}`}
                y={Number(minValue)}
                stroke={metricConfig.color}
                strokeDasharray="2 2"
                strokeOpacity={0.7}
                strokeWidth={1}
                label={{ 
                  value: `Min: ${Number(minValue).toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`, 
                  position: "right",
                  textAnchor: "end",
                  dx: -5, 
                  fill: metricConfig.color, 
                  fontSize: 10,
                  dy: dyMinLabel 
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
                  value: `Max: ${Number(maxValue).toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`, 
                  position: "right",
                  textAnchor: "end",
                  dx: -5, 
                  fill: metricConfig.color, 
                  fontSize: 10,
                  dy: dyMaxLabel
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
            {(chartType !== 'scatter' || (chartType === 'scatter' && isAggregated)) && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && " Bubble size indicates data spread (standard deviation)."}
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
                    {resolvedTheme === 'dark' ? (
                       <SelectItem value="light" className="text-xs">
                        <div className="flex items-center">
                          <Sun className="mr-2 h-3.5 w-3.5" /> Light Theme
                        </div>
                      </SelectItem>
                    ) : (
                      <SelectItem value="dark" className="text-xs">
                        <div className="flex items-center">
                          <Moon className="mr-2 h-3.5 w-3.5" /> Dark Theme
                        </div>
                      </SelectItem>
                    )}
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

