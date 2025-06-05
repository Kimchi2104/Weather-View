
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, ReferenceLine, ZAxis } from 'recharts';
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint, ChartType } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2, Sun, Moon, Laptop } from 'lucide-react';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { ChartTooltipContent, ChartContainer, type ChartConfig } from '@/components/ui/chart';


const MIN_BUBBLE_AREA = 60;
const MAX_BUBBLE_AREA = 1000;

const getPaddedMinYDomain = (dataMin: number, dataMax: number): number => {
  let paddedMin;
  const range = dataMax - dataMin;

  if (dataMin >= 0 && dataMin <= 30) {
    if (range <= 200 && dataMax <= 200) {
      paddedMin = -10;
    } else {
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


interface WeatherChartProps {
  data: WeatherDataPoint[] | AggregatedDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
  chartType: ChartType;
  isAggregated?: boolean;
  showMinMaxLines?: boolean;
  minMaxReferenceData?: Record<string, { minValue: number; maxValue: number }>;
}

type ExportThemeOption = 'current' | 'light' | 'dark';

const WeatherChart: FC<WeatherChartProps> = ({
  data: chartInputData,
  selectedMetrics,
  metricConfigs: METRIC_CONFIGS,
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
    if (!chartInputData || chartType === 'violin') { 
      return [];
    }
    const result = chartInputData.map(point => ({
        ...point,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && (point as AggregatedDataPoint).aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
    }));
    return result;
  }, [chartInputData, isAggregated, chartType]);


  const violinChartProcessedData = useMemo(() => {
    if (chartType !== 'violin' || !chartInputData || !isAggregated) return { flatData: [], categoryMap: new Map(), categories: [] };

    const flatData: Array<{
      xNumeric: number;
      yValue: number;
      metricName: string;
      metricKey: MetricKey;
      categoryName: string;
      originalRawPoint: WeatherDataPoint;
      color: string;
    }> = [];
    
    const categories = (chartInputData as AggregatedDataPoint[]).map(ap => ap.timestampDisplay).filter((v, i, a) => a.indexOf(v) === i);
    const categoryMap = new Map<string, number>();
    categories.forEach((cat, idx) => categoryMap.set(cat, idx));


    (chartInputData as AggregatedDataPoint[]).forEach(aggPoint => {
      const currentXNumericBase = categoryMap.get(aggPoint.timestampDisplay)!;

      selectedMetrics.forEach(metricKey => {
        const metricConfig = METRIC_CONFIGS[metricKey];
        if (metricConfig && !metricConfig.isString && aggPoint.rawPointsInGroup) {
          aggPoint.rawPointsInGroup.forEach(rawPoint => {
            const value = rawPoint[metricKey];
            if (typeof value === 'number' && isFinite(value)) {
              flatData.push({
                xNumeric: currentXNumericBase + (Math.random() - 0.5) * 0.7, 
                yValue: value,
                metricName: metricConfig.name,
                metricKey: metricKey,
                categoryName: aggPoint.timestampDisplay,
                originalRawPoint: rawPoint,
                color: metricConfig.color,
              });
            }
          });
        }
      });
    });
    return { flatData, categoryMap, categories };
  }, [chartInputData, selectedMetrics, METRIC_CONFIGS, chartType, isAggregated]);


  const numericMetricsForScatterOrViolin = useMemo(() => {
    if (chartType === 'scatter' || chartType === 'violin') {
      return selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString;
      });
    }
    return [];
  }, [selectedMetrics, METRIC_CONFIGS, chartType]);


  const yAxisDomain = useMemo(() => {
    let dataValues: number[] = [];

    if (chartType === 'violin') {
        dataValues = violinChartProcessedData.flatData.map(p => p.yValue);
    } else {
        const metricsToConsiderForDomain = numericMetricsForScatterOrViolin.length > 0 && chartType === 'scatter'
            ? numericMetricsForScatterOrViolin
            : selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

        dataValues = metricsToConsiderForDomain.flatMap(metricKey =>
            formattedData.map(p => {
                let value;
                if (chartType === 'scatter' && isAggregated) {
                  value = p[metricKey + '_avg' as keyof typeof p] as number;
                } else {
                  value = p[metricKey as keyof typeof p] as number;
                }
                return typeof value === 'number' && isFinite(value) ? value : undefined;
            }).filter(v => v !== undefined) as number[]
        );
    }

    let effectiveMin = dataValues.length > 0 ? Math.min(...dataValues) : 0;
    let effectiveMax = dataValues.length > 0 ? Math.max(...dataValues) : 10;

    if (dataValues.length === 0 && (!minMaxReferenceData || Object.keys(minMaxReferenceData).length === 0)) {
      effectiveMin = 0;
      effectiveMax = 10;
    }

    if (showMinMaxLines && chartType === 'line') {
        selectedMetrics.forEach(metricKey => {
            if (!minMaxReferenceData) return;
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

    return [paddedMin, paddedMax] as [number | 'auto', number | 'auto'];
  }, [formattedData, violinChartProcessedData, selectedMetrics, numericMetricsForScatterOrViolin, showMinMaxLines, minMaxReferenceData, chartType, isAggregated, METRIC_CONFIGS]);


  const metricsWithMinMaxLines = useMemo(() => {
    if (!showMinMaxLines || !minMaxReferenceData || chartType !== 'line') return [];
    return selectedMetrics.filter(metricKey => {
        const metricMinMax = minMaxReferenceData[metricKey];
        const metricConfig = METRIC_CONFIGS[metricKey];
        if (!metricMinMax || !metricConfig || metricConfig.isString) return false;
        const { minValue, maxValue } = metricMinMax;
        return typeof minValue === 'number' && isFinite(minValue) && typeof maxValue === 'number' && isFinite(maxValue);
    }).sort();
  }, [showMinMaxLines, minMaxReferenceData, selectedMetrics, METRIC_CONFIGS, chartType]);

   const chartConfigForShadcn = useMemo(() => {
    const config: ChartConfig = {};
    (Object.keys(METRIC_CONFIGS) as MetricKey[]).forEach(key => {
      const metricConf = METRIC_CONFIGS[key];
      config[key] = {
        label: metricConf.name,
        icon: metricConf.Icon,
        color: metricConf.color,
      };
      if (isAggregated && !metricConf.isString) {
        config[`${key}_avg`] = {
          label: `${metricConf.name} (Avg)`,
          icon: metricConf.Icon,
          color: metricConf.color,
        };
         config[`${key}_stdDev`] = {
          label: `${metricConf.name} (Std. Dev)`,
          icon: undefined, 
          color: metricConf.color,
        };
         config[`${key}_count`] = {
            label: `${metricConf.name} (Count)`,
            icon: undefined,
            color: metricConf.color,
        };
      }
    });
    return config;
  }, [METRIC_CONFIGS, isAggregated]);


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
      return value.toFixed( Math.abs(value) < 10 && value !== 0 ? 1 : 0 );
    }
    if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      return 'N/A';
    }
    return String(value);
  };

  const handleScatterPointClick = (scatterPointProps: any, index: number, event: React.MouseEvent<SVGElement>, explicitMetricKey: MetricKey) => {
    console.log('[WeatherChart] Scatter Point Clicked. Index:', index, "Explicit MetricKey:", explicitMetricKey);
    console.log('[WeatherChart] Full scatterPointProps from Recharts:', scatterPointProps);
     try {
        console.log('[WeatherChart] Full scatterPointProps from Recharts (JSON):', JSON.stringify(scatterPointProps, null, 2));
    } catch (e) {
        console.warn('[WeatherChart] Could not stringify full scatterPointProps for logging:', e);
    }
    if (scatterPointProps) {
        console.log('[WeatherChart] Keys available on scatterPointProps:', Object.keys(scatterPointProps));
    }
    if (scatterPointProps && scatterPointProps.payload) {
        console.log('[WeatherChart] Scatter point payload:', scatterPointProps.payload);
    }
    onPointClick?.(scatterPointProps.payload, { ...scatterPointProps, explicitMetricKey: explicitMetricKey });
  };
  

  const handleLineBarChartClick = (rechartsEvent: any) => {
    let eventDataString = 'Could not stringify event';
    let activePayloadData: any = null;
    let activePayloadFull: any = null;

    try {
        eventDataString = JSON.stringify(rechartsEvent, (key, value) => {
            if (typeof value === 'function') return '[Function]';
            if (value instanceof Element) return '[DOM Element]';
            if (key === 'target' && value instanceof EventTarget) return '[EventTarget]';
            if (typeof value === 'bigint') return value.toString() + 'n';
            if (key === 'chartContainer' || key === 'viewBox' || key === 'offset') return '{...omitted_large_object...}';
            if (value && typeof value === 'object' && Object.keys(value).length > 20) return '{...large_object_omitted...}';
            return value;
        }, 2);
    } catch (e) {
        console.warn('[WeatherChart] Could not stringify full rechartsEvent for Line/Bar click:', e);
        eventDataString = 'Event object too complex or circular to stringify.';
    }
    console.log('[WeatherChart] Line/Bar Chart Click. Full Event Data (Sanitized):', eventDataString);


    if (rechartsEvent && rechartsEvent.activePayload && rechartsEvent.activePayload.length > 0) {
        console.log('[WeatherChart] Line/Bar - Active Payload FOUND:', rechartsEvent.activePayload);
        activePayloadData = rechartsEvent.activePayload[0].payload;
        activePayloadFull = rechartsEvent.activePayload[0];
        onPointClick?.(activePayloadData, activePayloadFull);
    } else if (rechartsEvent && (rechartsEvent.chartX || rechartsEvent.xValue)) {
        console.log('[WeatherChart] Line/Bar - Click on chart area (empty space). Calling onPointClick with nulls.');
        onPointClick?.(null, null);
    } else {
        console.log('[WeatherChart] Line/Bar - Generic chart click, no specific active payload or chart coordinates. Calling onPointClick with nulls.');
        onPointClick?.(null, null);
    }
  };


  const renderChartSpecificElements = () => {
    console.log('[WeatherChart] renderChartSpecificElements called. chartType:', chartType);
    if (chartType === 'violin') {
      console.log('[WeatherChart] Rendering VIOLIN elements.');
      if (numericMetricsForScatterOrViolin.length === 0) {
           console.warn("[WeatherChart] Violin plot selected, but no numeric metrics available or selected.");
           return null;
      }
      return numericMetricsForScatterOrViolin.flatMap(metricKey => {
          const metricConfig = METRIC_CONFIGS[metricKey];
          if (!metricConfig) return null;
          const metricSpecificFlatData = violinChartProcessedData.flatData.filter(d => d.metricKey === metricKey);
          const baseMetricKey = metricKey; 
          return (
              <Scatter
                  key={`violin-scatter-${metricKey}`}
                  name={metricConfig.name} 
                  data={metricSpecificFlatData} 
                  dataKey="yValue" 
                  xAxisId="violinXNumeric" 
                  yAxisId="violinY"
                  fill={metricConfig.color}
                  shape="circle" 
                  strokeWidth={0} 
                  animationDuration={300}
                  onClick={(props, index, event) => handleScatterPointClick(props, index, event as React.MouseEvent<SVGElement>, baseMetricKey)}
              />
          );
      });
    } else if (chartType === 'scatter') {
      console.log('[WeatherChart] Rendering SCATTER elements.');
      if (numericMetricsForScatterOrViolin.length === 0) return null;
      const elements: JSX.Element[] = [];
      numericMetricsForScatterOrViolin.forEach((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig || metricConfig.isString) return;

        const yDataKey = isAggregated ? `${key}_avg` : key;
        const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
        const zAxisUniqueId = `z-${key}`;
        const baseMetricKey = key;

        if (isAggregated && stdDevDataKey) {
          elements.push(
            <ZAxis
              key={`zaxis-${key}`}
              zAxisId={zAxisUniqueId}
              dataKey={stdDevDataKey}
              range={[MIN_BUBBLE_AREA, MAX_BUBBLE_AREA]}
              name={chartConfigForShadcn[`${key}_stdDev`]?.label || `${metricConfig.name} Std Dev`}
            />
          );
        }
        elements.push(
          <Scatter
            key={`scatter-${key}`}
            name={yDataKey} 
            dataKey={yDataKey}
            fill={metricConfig.color || '#8884d8'}
            shape="circle"
            animationDuration={300}
            {...(isAggregated && stdDevDataKey ? { zAxisId: zAxisUniqueId } : {})}
            onClick={(props, index, event) => handleScatterPointClick(props, index, event as React.MouseEvent<SVGElement>, baseMetricKey)}
          />
        );
      });
      return elements;
    } else if (chartType === 'line') {
        console.log('[WeatherChart] Rendering LINE elements because chartType is line.');
        const metricsToRenderForLine = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
        if (metricsToRenderForLine.length === 0) return null;
        return metricsToRenderForLine.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig) return null;
          const color = metricConfig.color || '#8884d8';
          const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
          return (
            <Line
              key={`line-${key}`}
              type="monotone"
              dataKey={key}
              stroke={color}
              name={name}
              dot={isAggregated ? { r: 3 } : false}
              connectNulls={false}
              animationDuration={300}
            />
          );
        });
    } else if (chartType === 'bar') {
        console.log('[WeatherChart] Rendering BAR elements.');
        const metricsToRenderForBar = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
        if (metricsToRenderForBar.length === 0) return null;
        return metricsToRenderForBar.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig) return null;
          const color = metricConfig.color || '#8884d8';
          const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
          return (
            <Bar
              key={`bar-${key}`}
              dataKey={key}
              fill={color}
              name={name}
              radius={[4, 4, 0, 0]}
              animationDuration={300}
            />
          );
        });
    }
    return null;
  };

  let ChartComponent: React.ComponentType<any> = LineChart;
  let currentChartData: any[] = formattedData; 
  
  let currentXAxisId: string | undefined = undefined;
  let yAxisId: string | undefined = undefined;
  let xAxisDataKey: string = "timestampDisplay";
  let xAxisType: "category" | "number" = "category";
  let xAxisDomain: any = undefined;
  let xAxisTickFormatterFunc: ((value: any, index: number) => string) | undefined = undefined;
  let xAxisScale: "auto" | "time" | "linear" | "point" | "pow" | "sqrt" | "log" | "identity" | "band" = "auto";
  let xAxisAngleProp = 0;
  let xAxisTextAnchorProp: "start" | "middle" | "end" = "middle";
  let xAxisDyProp = 0;
  let xAxisHeightProp = 30;
  let xAxisMinTickGapProp = 5;
  let xAxisIntervalProp: number | "preserveStart" | "preserveEnd" | "preserveStartEnd" = 0;
  

  if (chartType === 'bar') ChartComponent = BarChart;
  else if (chartType === 'scatter') ChartComponent = ScatterChart;
  else if (chartType === 'violin') {
    ChartComponent = ScatterChart; 
    currentChartData = violinChartProcessedData.flatData; 
  }
  

  if (chartType === 'violin') {
    currentXAxisId = "violinXNumeric";
    yAxisId = "violinY";
    xAxisDataKey = "xNumeric"; 
    xAxisType = "number";
    xAxisDomain = [-0.5, violinChartProcessedData.categories.length - 0.5] as [number, number];
    xAxisTickFormatterFunc = (value: number, index: number) => {
        const categoryIndex = Math.round(value); 
        return violinChartProcessedData.categories[categoryIndex] || '';
    };
    xAxisScale = "linear"; 
    xAxisAngleProp = -45;
    xAxisTextAnchorProp = "end";
    xAxisDyProp = 10;
    xAxisHeightProp = 70;
    xAxisMinTickGapProp = 1; 
  } else if (chartType === 'scatter' && !isAggregated) { 
    xAxisDataKey = "timestamp";
    xAxisType = "number";
    xAxisDomain = ['dataMin', 'dataMax'] as [number | 'auto', number | 'auto'];
    xAxisTickFormatterFunc = (value: number) => formatTimestampToDdMmHhMmUTC(value);
    xAxisScale = "time";
    xAxisAngleProp = -45;
    xAxisTextAnchorProp = "end";
    xAxisDyProp = 10;
    xAxisHeightProp = 70;
    xAxisMinTickGapProp = 20;
    xAxisIntervalProp = formattedData.length > 15 ? Math.floor(formattedData.length / 10) : 0;
  } else if (chartType === 'scatter' && isAggregated) { 
     xAxisDataKey = "timestampDisplay"; 
     xAxisType = "category"; 
     xAxisAngleProp = -45;
     xAxisTextAnchorProp = "end";
     xAxisDyProp = 10;
     xAxisHeightProp = 70;
     xAxisMinTickGapProp = 5;
     xAxisIntervalProp = "preserveStartEnd";
  } else { 
    xAxisDataKey = "timestampDisplay";
    xAxisType = "category";
    xAxisAngleProp = (chartType === 'line' && !isAggregated) ? -45 : 0;
    xAxisTextAnchorProp = (chartType === 'line' && !isAggregated) ? "end" : "middle";
    xAxisDyProp = (chartType === 'line' && !isAggregated) ? 10 : 0;
    xAxisHeightProp = (chartType === 'line' && !isAggregated) ? 70 : 30;
    xAxisMinTickGapProp = ((chartType === 'line') && !isAggregated) ? 10 : 5;
    xAxisIntervalProp = isAggregated ? "preserveStartEnd" : (formattedData.length > 20 ? Math.floor(formattedData.length / (formattedData.length > 0 ? Math.min(10, formattedData.length) : 5)) : 0);
  }
  
  const chartDynamicKey = `${chartType}-${currentXAxisId || 'defaultX'}-${selectedMetrics.join('-')}-${JSON.stringify(yAxisDomain)}-${isAggregated}-${currentChartData.length}-${showMinMaxLines}`;
  
  const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
    if (chartType === 'violin') {
        if (payload && payload.length > 0 && payload[0].payload.categoryName) {
            return payload[0].payload.categoryName; 
        }
        return '';
    }
    if (chartType === 'scatter' && !isAggregated) return null; 
    if (chartType === 'scatter' && isAggregated) { 
      if (payload && payload.length > 0 && payload[0].payload.timestampDisplay) {
        return payload[0].payload.timestampDisplay;
      }
      return String(label);
    }
    if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
      return payload[0].payload.tooltipTimestampFull;
    }
    return String(label);
  };


 const tooltipFormatter = (value: any, nameFromRecharts: string, entry: any): React.ReactNode | [string, string] | null => {
    const dataKey = entry.dataKey as string; 
    
    if (chartType === 'violin' && entry.payload) {
        const { metricName, yValue, originalRawPoint, categoryName } = entry.payload;
        const config = METRIC_CONFIGS[entry.payload.metricKey as MetricKey];
        const displayValue = typeof yValue === 'number' && isFinite(yValue) 
            ? yValue.toFixed(config?.unit === 'ppm' ? 0 : (config?.isString ? 0 : 2)) 
            : 'N/A';
        const unitString = (typeof yValue === 'number' && isFinite(yValue) && config?.unit) ? ` ${config.unit}` : '';
        
        const fullTimestamp = originalRawPoint?.rawTimestampString || formatTimestampToFullUTC(originalRawPoint?.timestamp || Date.now());

        const tooltipContent = (
            React.createElement('div', null,
                React.createElement('div', null, React.createElement('strong', null, 'Period:'), ` ${categoryName}`),
                React.createElement('div', null, React.createElement('strong', null, 'Metric:'), ` ${metricName}`),
                React.createElement('div', null, React.createElement('strong', null, 'Value:'), ` ${displayValue}${unitString}`),
                React.createElement('div', null, React.createElement('strong', null, 'Time:'), ` ${fullTimestamp}`)
            )
        );
        return [tooltipContent, null]; 
    }


    if (typeof nameFromRecharts === 'string' && nameFromRecharts.toLowerCase().includes("timestamp")) return null;
    if (typeof dataKey === 'string') {
        const lowerDataKey = dataKey.toLowerCase();
        if (lowerDataKey === 'timestamp' ||
            lowerDataKey === 'timestampdisplay' ||
            lowerDataKey === 'tooltiptimestampfull' ||
            lowerDataKey.includes("stddev") ||
            lowerDataKey.includes("count") ||
            lowerDataKey.includes("aggregationperiod") ||
            lowerDataKey === 'xnumeric' 
            ) {
            return null;
        }
    }

    let originalMetricKeyForConfig = dataKey;
    let isAvgKey = false;
    if (isAggregated) {
      if (typeof originalMetricKeyForConfig === 'string' && originalMetricKeyForConfig.endsWith('_avg')) {
        originalMetricKeyForConfig = originalMetricKeyForConfig.substring(0, originalMetricKeyForConfig.length - 4);
        isAvgKey = true;
      }
    }
    originalMetricKeyForConfig = originalMetricKeyForConfig as MetricKey;

    const config = METRIC_CONFIGS[originalMetricKeyForConfig];
    const displayName = config?.name || (isAvgKey ? `${originalMetricKeyForConfig} (Avg)` : originalMetricKeyForConfig);
    
    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('std dev') || displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;


    let displayValue: string;
    if (typeof value === 'number' && isFinite(value)) {
      const precision = (config?.unit === 'ppm' ? 0 : (config?.isString ? 0 : (isAggregated ? 1 : 2)));
      displayValue = value.toFixed(precision);
    } else if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      displayValue = 'N/A';
    } else {
      displayValue = String(value);
    }
    const unitString = (typeof value === 'number' && isFinite(value) && config?.unit) ? ` ${config.unit}` : '';

    if (chartType === 'scatter' && isAggregated && config && !config.isString && entry.payload) {
      let tooltipHtml = `<div style="color: ${config.color || 'inherit'};"><strong>${displayName}:</strong> ${displayValue}${unitString}`;
      const stdDevValue = entry.payload[`${originalMetricKeyForConfig}_stdDev`];
      const countValue = entry.payload[`${originalMetricKeyForConfig}_count`];

      if (typeof stdDevValue === 'number' && isFinite(stdDevValue)) {
        tooltipHtml += `<br/>Std. Dev: ${stdDevValue.toFixed(2)}${config?.unit || ''}`;
      }
      if (typeof countValue === 'number' && isFinite(countValue)) {
        tooltipHtml += `<br/>Data Points: ${countValue}`;
      }
      tooltipHtml += `</div>`;
      return React.createElement('div', { dangerouslySetInnerHTML: { __html: tooltipHtml } });
    }
    
    return [`${displayValue}${unitString}`, displayName];
  };


  const renderCustomTooltipContent = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }
  
    const filteredPayload = props.payload.filter((pldItem: any) => {
        const name = typeof pldItem.name === 'string' ? pldItem.name.toLowerCase() : '';
        const dataKey = typeof pldItem.dataKey === 'string' ? pldItem.dataKey.toLowerCase() : '';
        
        if (chartType === 'violin' && pldItem.payload && pldItem.payload.originalRawPoint) {
            return true; 
        }

        if (name.includes("timestamp") ||
            dataKey === 'timestamp' ||
            dataKey === 'timestampdisplay' ||
            dataKey === 'tooltiptimestampfull' ||
            name.includes("std dev") ||
            dataKey.includes("stddev") ||
            dataKey.includes("count") ||
            dataKey.includes("aggregationperiod") ||
            dataKey === 'xnumeric'
           ) {
          return false;
        }
        return true;
      });
  
    if (filteredPayload.length === 0 && chartType !== 'violin') { 
      return null;
    }
    
    return (
      <ChartTooltipContent
        {...props}
        payload={filteredPayload} 
        formatter={tooltipFormatter}
        labelFormatter={tooltipLabelFormatter}
        hideIndicator={(chartType === 'scatter' && isAggregated) || chartType === 'violin'}
      />
    );
  };

  const metricsAvailableForCurrentChartType = useMemo(() => {
    if (chartType === 'violin' || chartType === 'scatter') {
      return selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString;
      });
    }
    // For line and bar charts, allow all selected metrics initially.
    // renderChartSpecificElements will filter out string metrics for actual rendering.
    return selectedMetrics;
  }, [selectedMetrics, METRIC_CONFIGS, chartType]);

  const renderChart = () => {
    console.log(`[WeatherChart] renderChart: chartType='${chartType}', currentXAxisId='${currentXAxisId || 'undefined'}', yAxisId='${yAxisId || 'undefined'}'`);
    if (isLoading || !currentChartData || currentChartData.length === 0 || (metricsAvailableForCurrentChartType.length === 0 && selectedMetrics.length > 0) ) {
      return (
        <Card className="shadow-lg h-full">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
            <p className="text-muted-foreground">
              {isLoading ? "Loading chart data..." :
                (metricsAvailableForCurrentChartType.length === 0 && selectedMetrics.length > 0) ?
                `Please select numeric metrics for the ${chartType} chart.` :
                "No data available for the selected criteria or metrics."
              }
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
    <ChartComponent
      key={chartDynamicKey}
      data={currentChartData} 
      onClick={chartType === 'line' || chartType === 'bar' ? handleLineBarChartClick : undefined}
      {...commonCartesianProps}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis
        dataKey={xAxisDataKey}
        type={xAxisType}
        domain={xAxisDomain as any} 
        scale={xAxisScale}
        tickFormatter={xAxisTickFormatterFunc}
        stroke="#888888"
        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
        height={xAxisHeightProp}
        interval={xAxisIntervalProp}
        angle={xAxisAngleProp}
        textAnchor={xAxisTextAnchorProp}
        dy={xAxisDyProp}
        minTickGap={xAxisMinTickGapProp}
        xAxisId={currentXAxisId}
        ticks={chartType === 'violin' ? violinChartProcessedData.categoryMap.size > 0 ? Array.from(Array(violinChartProcessedData.categoryMap.size).keys()) : undefined : undefined}
      />
      <YAxis
        stroke="#888888"
        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
        tickFormatter={yAxisTickFormatter}
        domain={yAxisDomain as any}
        allowDecimals={true}
        type="number"
        scale="linear"
        allowDataOverflow={chartType !== 'bar'}
        yAxisId={yAxisId}
        dataKey={chartType === 'violin' ? 'yValue' : undefined} 
      />
      <Tooltip
        content={renderCustomTooltipContent}
        wrapperStyle={{ outline: "none" }}
        cursor={(chartType === 'line' || chartType === 'bar') ? { stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' } : false }
        animationDuration={150}
        animationEasing="ease-out"
      />
      <Legend
        wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
        iconSize={14}
        layout="horizontal"
        align="center"
        verticalAlign="top"
        formatter={(value, entry: any, index) => {
          const rechartsName = entry.name as string | undefined; 
          if (typeof rechartsName !== 'string') { 
            return value; 
          }

          let originalKey = rechartsName;
          if (isAggregated && rechartsName.endsWith('_avg')) {
            originalKey = rechartsName.substring(0, rechartsName.length - 4);
          } else if (isAggregated && rechartsName.endsWith('_stdDev')) {
             if (chartType === 'scatter' && numericMetricsForScatterOrViolin.includes(originalKey.replace('_stdDev','') as MetricKey) ) {
                 return null; 
             }
          }
          
          const config = chartType === 'violin' && entry.payload && METRIC_CONFIGS[entry.payload.metricKey as MetricKey] 
            ? METRIC_CONFIGS[entry.payload.metricKey as MetricKey] 
            : chartConfigForShadcn[originalKey as MetricKey];
          return config?.label || value;
        }}
      />
      {renderChartSpecificElements()}

      {showMinMaxLines && chartType === 'line' && !currentXAxisId && minMaxReferenceData &&
        selectedMetrics.flatMap(metricKey => {
          const metricMinMax = minMaxReferenceData[metricKey];
          const metricConfig = METRIC_CONFIGS[metricKey];

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
  )};
  
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
           <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(chartType !== 'scatter' || (chartType === 'scatter' && isAggregated)) && (chartType !== 'violin') && (isAggregated && chartInputData.length > 0 ? ` (Aggregated Data - ${chartInputData[0]?.timestampDisplay ? (chartInputData[0] as AggregatedDataPoint).aggregationPeriod : 'N/A'})` : ` (Raw Data)`)}.
            {chartType === 'violin' && isAggregated && chartInputData.length > 0 && ` (Aggregated Data - ${chartInputData[0]?.timestampDisplay ? (chartInputData[0] as AggregatedDataPoint).aggregationPeriod : 'N/A'})`}
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && numericMetricsForScatterOrViolin.length > 0 && " Bubble size indicates data spread (standard deviation)."}
            {chartType === 'violin' && " Jittered dots show raw data distribution for each period."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ChartContainer
            ref={chartRef}
            config={chartConfigForShadcn}
            className="w-full h-[550px] bg-card mx-auto overflow-hidden"
          >
          {renderChart()}
        </ChartContainer>
        <div className="flex justify-center items-center pt-2 space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={isExporting || !currentChartData || currentChartData.length === 0 || (isLoading && currentChartData.length === 0)} className="min-w-[150px]">
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
                     {(resolvedTheme === 'dark' || currentSystemTheme === 'dark') && resolvedTheme !== 'light' ? (
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

