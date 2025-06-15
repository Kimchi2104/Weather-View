"use client";

import type { FC } from 'react';
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import jsPDF from 'jspdf';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint, ChartType, TrendLineType } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2, Sun, Moon, Laptop } from 'lucide-react';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC, calculateTrendLine } from '@/lib/utils';
import { ChartTooltipContent, ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Bar, Scatter, ReferenceLine, ZAxis, ReferenceArea, ScatterChart } from 'recharts';
import { useToast } from "@/hooks/use-toast";

const Select = dynamic(() => import('@/components/ui/select').then(mod => mod.Select), { ssr: false });
const SelectContent = dynamic(() => import('@/components/ui/select').then(mod => mod.SelectContent), { ssr: false });
const SelectItem = dynamic(() => import('@/components/ui/select').then(mod => mod.SelectItem), { ssr: false });
const SelectTrigger = dynamic(() => import('@/components/ui/select').then(mod => mod.SelectTrigger), { ssr: false });
const SelectValue = dynamic(() => import('@/components/ui/select').then(mod => mod.SelectValue), { ssr: false });

const MIN_BUBBLE_AREA = 60;
const MAX_BUBBLE_AREA = 1000;

const getPaddedMinYDomain = (dataMin: number, dataMax: number): number => {
  let paddedMin;
  const range = dataMax - dataMin;
  if (dataMin >= 0 && dataMin <= 30) {
    if (range <= 200 && dataMax <= 200) paddedMin = -10;
    else {
      const proportionalPadding = Math.max(10, 0.05 * dataMax);
      paddedMin = Math.floor(dataMin - proportionalPadding);
      if (dataMin >= 0 && paddedMin > -2) paddedMin = -2;
    }
  } else if (dataMin > 30) {
    const padding = Math.max(5, 0.15 * dataMin);
    paddedMin = Math.floor(dataMin - padding);
  } else {
    const padding = Math.max(3, 0.15 * Math.abs(dataMin));
    paddedMin = Math.floor(dataMin - padding);
    if (paddedMin > 0 && dataMin < 0) paddedMin = 0;
  }
  return paddedMin;
};

const getPaddedMaxYDomain = (dataMax: number, dataMin: number): number => {
  let paddedMax;
  const range = dataMax - dataMin;
  if (dataMax >= 0 && dataMax < 10) {
     if (range <= 200 && dataMin >= -100) {
      paddedMax = Math.ceil(dataMax + Math.max(3, 0.5 * (dataMax - Math.max(0, dataMin) + 3)));
      if (dataMax === 0 && paddedMax < 10) paddedMax = 10;
    } else {
      const proportionalPadding = Math.max(10, 0.05 * Math.abs(dataMin));
      paddedMax = Math.ceil(dataMax + proportionalPadding);
    }
  } else if (dataMax >= 10) {
    const padding = Math.max(5, 0.15 * dataMax);
    paddedMax = Math.ceil(dataMax + padding);
  } else { 
    const padding = Math.max(3, 0.15 * Math.abs(dataMax));
    paddedMax = Math.ceil(dataMax + padding);
    if (paddedMax > 0 && dataMax < 0) paddedMax = 0;
  }
  return paddedMax;
};

const getResolvedBackgroundColor = (theme: 'light' | 'dark' | 'aura-glass', chartElement: HTMLElement): string | null => {
  if (theme === 'aura-glass') return null;
  try {
    if (chartElement && typeof getComputedStyle === 'function') {
      const style = getComputedStyle(chartElement.parentElement || document.body);
      const cardBg = style.getPropertyValue('--card').trim();
      if (cardBg && cardBg.startsWith('hsl')) return cardBg;
    }
  } catch (e) {
    console.warn("Could not compute --card background for export:", e);
  }
  return theme === 'dark' ? 'hsl(222.2 84% 4.9%)' : 'hsl(0 0% 100%)';
};

type ExportThemeOption = 'current' | 'light' | 'dark' | 'aura-glass';

interface WeatherChartProps {
  data: WeatherDataPoint[] | AggregatedDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
  chartType: ChartType;
  isAggregated?: boolean;
  showMinMaxLines?: boolean;
  showTrendLine?: boolean;
  trendLineType?: TrendLineType;
  trendLineOptions?: { polynomialOrder?: number; movingAveragePeriod?: number };
  minMaxReferenceData?: Record<string, { minValue: number; maxValue: number }>;
}

const WeatherChart: FC<WeatherChartProps> = ({
  data: chartInputData,
  selectedMetrics,
  metricConfigs: METRIC_CONFIGS,
  isLoading,
  onPointClick,
  chartType,
  isAggregated = false,
  showMinMaxLines = false,
  showTrendLine = false,
  trendLineType = 'none',
  trendLineOptions,
  minMaxReferenceData,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { theme: currentSystemTheme, resolvedTheme } = useTheme();
  const [exportThemeOption, setExportThemeOption] = useState<ExportThemeOption>('current');

  const dataWithTrend = useMemo(() => {
    if (!showTrendLine || !chartInputData || chartInputData.length < 2 || trendLineType === 'none') return chartInputData;
    let processedData: any[] = [...chartInputData];
    const metricsForTrend = selectedMetrics.filter(key => key !== 'sunriseSunset' && METRIC_CONFIGS[key] && !METRIC_CONFIGS[key].isString);
    metricsForTrend.forEach(metricKey => {
        const dataKey = isAggregated ? `${metricKey}_avg` : metricKey;
        processedData = calculateTrendLine(processedData, dataKey, trendLineType, trendLineOptions);
    });
    return processedData;
  }, [chartInputData, selectedMetrics, showTrendLine, trendLineType, trendLineOptions, isAggregated]);

  const formattedData = useMemo(() => {
    if (!dataWithTrend) return [];
    return dataWithTrend.map((point, index) => ({
        ...point,
        index,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && (point as AggregatedDataPoint).aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
    }));
  }, [dataWithTrend, isAggregated]);

  const yAxisDomain = useMemo(() => {
    const metricsToConsider = selectedMetrics.filter(key => !METRIC_CONFIGS[key].isString);
    if (metricsToConsider.length === 0) return [0, 1];
    let allValues: number[] = [];
    metricsToConsider.forEach(metricKey => {
      const dataKey = isAggregated ? `${metricKey}_avg` : metricKey;
      const values = formattedData.map(p => p[dataKey]).filter(v => typeof v === 'number' && isFinite(v)) as number[];
      allValues = allValues.concat(values);
    });
    if (allValues.length === 0) return [0, 10];
    let effectiveMin = Math.min(...allValues);
    let effectiveMax = Math.max(...allValues);
    if (showMinMaxLines && chartType === 'line' && minMaxReferenceData) {
        metricsToConsider.forEach(metricKey => {
            const minMax = minMaxReferenceData[metricKey];
            if (minMax) {
                effectiveMin = Math.min(effectiveMin, minMax.minValue);
                effectiveMax = Math.max(effectiveMax, minMax.maxValue);
            }
        });
    }
    return [getPaddedMinYDomain(effectiveMin, effectiveMax), getPaddedMaxYDomain(effectiveMax, effectiveMin)];
  }, [formattedData, selectedMetrics, showMinMaxLines, minMaxReferenceData, chartType, isAggregated]);

  const chartConfigForShadcn = useMemo(() => {
    const config: ChartConfig = {};
    Object.entries(METRIC_CONFIGS).forEach(([key, metricConf]) => {
      config[key] = { label: metricConf.name, icon: metricConf.Icon, color: metricConf.color };
      if (isAggregated && !metricConf.isString) {
        config[`${key}_avg`] = { label: `${metricConf.name} (Avg)`, icon: metricConf.Icon, color: metricConf.color };
        config[`${key}_stdDev`] = { label: `${metricConf.name} (Std. Dev)`, color: metricConf.color };
      }
    });
    return config;
  }, [isAggregated]);

  const { toast } = useToast();

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current || isExporting) return;
    const chartElement = chartRef.current.querySelector('.recharts-wrapper');
    if (!chartElement) { toast({ title: "Export Failed", description: "Chart element not found.", variant: "destructive" }); return; }
    setIsExporting(true);
    const htmlEl = document.documentElement;
    const currentTheme = htmlEl.classList.contains('dark') ? 'dark' : 'light';
    const targetTheme = exportThemeOption === 'current' ? currentTheme : exportThemeOption;
    const originalClasses = htmlEl.className;
    htmlEl.className = targetTheme;
    await new Promise(r => setTimeout(r, 300));
    try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(chartElement as HTMLElement, { scale: 2, useCORS: true, backgroundColor: getResolvedBackgroundColor(targetTheme, chartElement as HTMLElement) });
        const imgData = canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png');
        const link = document.createElement('a');
        link.download = `weather-chart-${targetTheme}.${format}`;
        link.href = imgData;
        link.click();
        toast({ title: "Export Successful!", description: `Chart exported as ${format.toUpperCase()}.` });
    } catch (e: any) {
        toast({ title: "Export Failed", description: e.message, variant: "destructive" });
    } finally {
        htmlEl.className = originalClasses;
        setIsExporting(false);
    }
  };

  const handlePointClick = (e: any, explicitMetricKey?: MetricKey) => {
    if (!onPointClick) return;
    const payloadSource = isAggregated && chartType === 'scatter' ? e : e?.activePayload?.[0];
    if (payloadSource) {
      const key = explicitMetricKey || (payloadSource.dataKey as string).replace(/_avg$/, '');
      onPointClick(payloadSource.payload, { ...payloadSource, explicitMetricKey: key });
    } else if (e?.chartX) {
      onPointClick(null, null);
    }
  };
  
  const metricsAvailableForCurrentChartType = useMemo(() => {
    return selectedMetrics.filter(key => !METRIC_CONFIGS[key].isString);
  }, [selectedMetrics]);

  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${isAggregated}-${showTrendLine}-${trendLineType}`;

  if (isLoading || formattedData.length === 0 || metricsAvailableForCurrentChartType.length === 0) {
    return (
      <Card className="shadow-lg h-full">
        <CardHeader className="pb-3"><Skeleton className="h-6 w-1/2 mb-2" /><Skeleton className="h-4 w-1/3" /></CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">{isLoading ? "Loading chart data..." : "No data for selected metrics or time range."}</p>
        </CardContent>
      </Card>
    );
  }
  
  const yAxisTickFormatter = (value: any) => typeof value === 'number' ? value.toFixed(1) : value;
  
  const xAxisProps: any = {
    type: 'number' as const,
    dataKey: "timestamp",
    domain: ['dataMin', 'dataMax'] as [number | string, number | string],
    tickFormatter: (v: number) => formatTimestampToDdMmHhMmUTC(v),
    scale: 'time' as const,
    angle: -45, textAnchor: 'end' as const, height: 70,
    stroke: "hsl(var(--foreground))",
    tick: { fill: "hsl(var(--foreground))", fontSize: 11 }
  };
  
  if (isAggregated) {
    Object.assign(xAxisProps, { dataKey: "timestampDisplay", type: "category" as const, scale: 'point' as const, domain: undefined });
  }

  const yAxisProps = { yAxisId: "left", domain: yAxisDomain, tickFormatter: yAxisTickFormatter, allowDecimals: true, stroke: "hsl(var(--foreground))", tick: { fill: "hsl(var(--foreground))", fontSize: 12 } };

  const tooltipFormatter = (value: any, name: string | number, entry: any) => {
    const dataKey = entry.dataKey as string;
    if (dataKey.endsWith('_trend')) return null;
    const originalKey = dataKey.replace(/_avg$/, '') as MetricKey;
    const config = METRIC_CONFIGS[originalKey];
    if (!config) return [value, name as string];
    const displayName = chartConfigForShadcn[dataKey]?.label as string || name;
    const displayValue = typeof value === 'number' ? value.toFixed(config.isString ? 0 : isAggregated ? 1 : 2) : value;
    return [`${displayValue}${config.unit || ''}`, displayName];
  };

  const tooltipComponent = <Tooltip content={<ChartTooltipContent formatter={tooltipFormatter} />} wrapperStyle={{ outline: "none" }} cursor={{ strokeDasharray: '3 3' }} animationDuration={150} />;
  const legendComponent = <Legend wrapperStyle={{ paddingTop: '20px' }} iconSize={14} formatter={(value, entry) => chartConfigForShadcn[entry.dataKey as string]?.label || value} />;
  const trendLineComponents = showTrendLine ? metricsAvailableForCurrentChartType.map(key => {
    const config = METRIC_CONFIGS[key];
    const dataKey = isAggregated ? `${key}_avg` : key;
    return <Line key={`trend-${key}`} yAxisId="left" type="monotone" dataKey={`${dataKey}_trend`} stroke={config.color} strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} legendType="none" tooltipType="none" />;
  }) : null;

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart {isAggregated ? `(Aggregated Data)` : `(Raw Data)`}.
            {chartType === 'scatter' && isAggregated && " Bubble size indicates data spread."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ChartContainer ref={chartRef} config={chartConfigForShadcn} className="w-full h-[550px] mx-auto">
          <ResponsiveContainer key={chartDynamicKey}>
            {chartType === 'scatter' ? (
                <ScatterChart data={formattedData} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    {tooltipComponent}
                    {legendComponent}
                    {metricsAvailableForCurrentChartType.map(key => {
                        const config = METRIC_CONFIGS[key];
                        const dataKey = isAggregated ? `${key}_avg` : key;
                        const name = chartConfigForShadcn[dataKey]?.label as string || config.name;
                        const zKey = isAggregated ? `${key}_stdDev` : undefined;
                        return (
                            <React.Fragment key={key}>
                                {isAggregated && zKey && <ZAxis zAxisId={key} dataKey={zKey} range={[MIN_BUBBLE_AREA, MAX_BUBBLE_AREA]} name={`${name} Std Dev`} />}
                                <Scatter yAxisId="left" dataKey={dataKey} name={name} fill={config.color} shape="circle" fillOpacity={showTrendLine ? 0.7 : 1} onClick={(props) => handlePointClick(props, key)} />
                            </React.Fragment>
                        );
                    })}
                    {trendLineComponents}
                </ScatterChart>
            ) : (
                <ComposedChart data={formattedData} onClick={handlePointClick} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    {tooltipComponent}
                    {legendComponent}
                    {metricsAvailableForCurrentChartType.map(key => {
                        const config = METRIC_CONFIGS[key];
                        const dataKey = isAggregated ? `${key}_avg` : key;
                        const name = chartConfigForShadcn[dataKey]?.label as string || config.name;
                        if (chartType === 'line') {
                            return <Line key={key} yAxisId="left" type="monotone" dataKey={dataKey} name={name} stroke={config.color} strokeWidth={2} dot={isAggregated ? {r:3} : false} connectNulls={false} strokeOpacity={showTrendLine ? 0.7 : 1} />;
                        }
                        if (chartType === 'bar') {
                            return <Bar key={key} yAxisId="left" dataKey={dataKey} name={name} fill={config.color} radius={[4, 4, 0, 0]} fillOpacity={showTrendLine ? 0.7 : 1} />;
                        }
                        return null;
                    })}
                    {trendLineComponents}
                </ComposedChart>
            )}
          </ResponsiveContainer>
        </ChartContainer>
        <div className="flex justify-center items-center pt-2 space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={isExporting || isLoading && (!formattedData || formattedData.length === 0)} className="min-w-[150px]">
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export Chart
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <Suspense fallback={<Skeleton className="w-full h-9" />}>
                  {Select && SelectTrigger && SelectValue && SelectContent && SelectItem && (
                    <Select value={exportThemeOption} onValueChange={(value) => setExportThemeOption(value as ExportThemeOption)}>
                      <SelectTrigger className="w-full h-9 text-xs mb-1"><SelectValue placeholder="Select export theme" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="current" className="text-xs"><div className="flex items-center"><Laptop className="mr-2 h-3.5 w-3.5" /> Current View Theme</div></SelectItem>
                         {(resolvedTheme === 'dark' || (resolvedTheme === null && currentSystemTheme === 'dark')) ? 
                           <SelectItem value="light" className="text-xs"><div className="flex items-center"><Sun className="mr-2 h-3.5 w-3.5" /> Light Theme</div></SelectItem> : 
                           <SelectItem value="dark" className="text-xs"><div className="flex items-center"><Moon className="mr-2 h-3.5 w-3.5" /> Dark Theme</div></SelectItem>}
                      </SelectContent>
                    </Select>
                  )}
                </Suspense>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => exportChart('png')}><FileImage className="mr-2 h-4 w-4" />Export as PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportChart('jpeg')}><FileImage className="mr-2 h-4 w-4" />Export as JPEG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportChart('pdf')}><FileText className="mr-2 h-4 w-4" />Export as PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeatherChart;