
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
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint, ChartType } from '@/types/weather';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileImage, FileText, Loader2, Sun, Moon, Laptop } from 'lucide-react';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { ChartTooltipContent, ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, ReferenceLine, ZAxis, ReferenceArea } from 'recharts';
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
      if (cardBg && cardBg.startsWith('hsl')) {
        return cardBg;
      }
      console.warn("Computed --card background was not a valid HSL string:", cardBg, "Using fallback.");
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
    const result = chartInputData.map(point => ({
        ...point,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && (point as AggregatedDataPoint).aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
    }));
    return result;
  }, [chartInputData, isAggregated]);


  const numericMetricsForScatter = useMemo(() => {
    if (chartType === 'scatter') {
      return selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString;
      });
    }
    return [];
  }, [selectedMetrics, METRIC_CONFIGS, chartType]);


  const yAxisDomain = useMemo(() => {
    let dataValues: number[] = [];

    const plottableNumericMetrics = selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString; // Exclude sunriseSunset and other string types
    });

    const metricsToConsiderForDomain = chartType === 'scatter'
        ? numericMetricsForScatter // Already filtered for numeric in scatter context
        : plottableNumericMetrics;

    dataValues = metricsToConsiderForDomain.flatMap(metricKey =>
        formattedData.map(p => {
            let value;
            if (chartType === 'scatter' && isAggregated) {
              value = p[metricKey + '_avg' as keyof typeof p]as number;
            } else {
              value = p[metricKey as keyof typeof p] as number;
            }
            return typeof value === 'number' && isFinite(value) ? value : undefined;
        }).filter(v => v !== undefined) as number[]
    );
    
    if (plottableNumericMetrics.length === 0 && selectedMetrics.includes('sunriseSunset')) {
        return [0, 1] as [number, number]; // Simple domain if only sunriseSunset is "active"
    }

    if (dataValues.length === 0 && (!minMaxReferenceData || Object.keys(minMaxReferenceData).length === 0)) {
        return [0, 10] as [number | 'auto', number | 'auto'];
    }

    let effectiveMin = dataValues.length > 0 ? Math.min(...dataValues) : (minMaxReferenceData ? Infinity : 0);
    let effectiveMax = dataValues.length > 0 ? Math.max(...dataValues) : (minMaxReferenceData ? -Infinity : 10);

    if (showMinMaxLines && chartType === 'line' && minMaxReferenceData) {
        plottableNumericMetrics.forEach(metricKey => { // Use plottableNumericMetrics here
            const metricMinMax = minMaxReferenceData[metricKey];
            if (metricMinMax && typeof metricMinMax.minValue === 'number' && isFinite(metricMinMax.minValue)) {
                effectiveMin = Math.min(effectiveMin, metricMinMax.minValue);
            }
            if (metricMinMax && typeof metricMinMax.maxValue === 'number' && isFinite(metricMinMax.maxValue)) {
                effectiveMax = Math.max(effectiveMax, metricMinMax.maxValue);
            }
        });
    }
    
    if (effectiveMin === Infinity || effectiveMax === -Infinity) { 
      effectiveMin = 0;
      effectiveMax = 10;
    }

    const paddedMin = getPaddedMinYDomain(effectiveMin, effectiveMax);
    const paddedMax = getPaddedMaxYDomain(effectiveMax, effectiveMin);
    
    return [paddedMin, paddedMax] as [number | 'auto', number | 'auto'];
  }, [formattedData, selectedMetrics, numericMetricsForScatter, showMinMaxLines, minMaxReferenceData, chartType, isAggregated, METRIC_CONFIGS]);


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


const { toast } = useToast(); 

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current || isExporting) return;

    const chartElementToCapture = chartRef.current.querySelector('.recharts-wrapper') || chartRef.current;
    if (!chartElementToCapture) {
        console.error('Chart element to capture not found.');
        toast({ title: "Export Failed", description: "Chart element not found.", variant: "destructive" });
        return;
    }
    setIsExporting(true);

    const htmlElement = document.documentElement;
    const actualCurrentTheme = htmlElement.classList.contains('dark') ? 'dark' : 
                               htmlElement.classList.contains('aura-glass') ? 'aura-glass' : 'light';
                               
    let targetExportTheme: ExportThemeOption = exportThemeOption === 'current' ? actualCurrentTheme : exportThemeOption;

    const originalHtmlClasses = htmlElement.className;
    const originalBodyClasses = document.body.className;

    htmlElement.className = ''; 
    document.body.className = ''; 

    if (targetExportTheme === 'light') {
      htmlElement.classList.add('light'); 
      document.body.classList.add('light');
    } else if (targetExportTheme === 'dark') {
      htmlElement.classList.add('dark'); 
      document.body.classList.add('dark');
    } else if (targetExportTheme === 'aura-glass') { 
      htmlElement.classList.add('aura-glass');
      document.body.classList.add('aura-glass');          
    }
    
    await new Promise(resolve => setTimeout(resolve, 300)); 

    try {
      const html2canvasModule = await import('html2canvas'); 
      const actualHtml2Canvas = html2canvasModule.default; 

      if (typeof actualHtml2Canvas !== 'function') {
        console.error('html2canvas did not load correctly.', html2canvasModule);
        throw new Error('html2canvas is not available or not a function.');
      }
      
      const resolvedBgColor = getResolvedBackgroundColor(targetExportTheme, chartElementToCapture as HTMLElement);

      const canvas = await actualHtml2Canvas(chartElementToCapture as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: resolvedBgColor,
        logging: process.env.NODE_ENV === 'development', 
        onclone: (documentClone) => {
            const clonedHtmlElement = documentClone.documentElement;
            const clonedBodyElement = documentClone.body;
            clonedHtmlElement.className = ''; 
            clonedBodyElement.className = ''; 

            if (targetExportTheme === 'light') {
              clonedHtmlElement.classList.add('light');
              clonedBodyElement.classList.add('light');
            } else if (targetExportTheme === 'dark') {
              clonedHtmlElement.classList.add('dark');
              clonedBodyElement.classList.add('dark');
            } else if (targetExportTheme === 'aura-glass') {
                clonedHtmlElement.classList.add('aura-glass');
                clonedBodyElement.classList.add('aura-glass');
            }
        }
      });

      if (!(canvas instanceof HTMLCanvasElement)) {
        console.error('Error exporting chart: html2canvas did not return a valid canvas element.', canvas);
        throw new Error('Failed to produce canvas. Output from html2canvas was not a CanvasElement.');
      }

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
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast({ title: "Export Successful!", description: `Chart exported as ${format.toUpperCase()}.`, variant: "default" });

    } catch (error: any) {
      console.error('Error exporting chart:', error);
      toast({ title: "Export Failed", description: error.message || "Could not export chart.", variant: "destructive" });
    } finally {
      htmlElement.className = originalHtmlClasses;
      document.body.className = originalBodyClasses;
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
    if (scatterPointProps && onPointClick) {
      onPointClick(scatterPointProps.payload, { ...scatterPointProps, explicitMetricKey: explicitMetricKey });
    }
  };

  const handleLineBarChartClick = (rechartsEvent: any) => {
    let activePayloadData: any = null;
    let activePayloadFull: any = null;

    if (rechartsEvent && rechartsEvent.activePayload && rechartsEvent.activePayload.length > 0) {
        activePayloadData = rechartsEvent.activePayload[0].payload;
        activePayloadFull = rechartsEvent.activePayload[0]; 
        onPointClick?.(activePayloadData, activePayloadFull);
    } else if (rechartsEvent && (rechartsEvent.chartX || rechartsEvent.xValue)) { 
        onPointClick?.(null, null); 
    } else { 
        onPointClick?.(null, null);
    }
  };

  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${JSON.stringify(yAxisDomain)}-${isAggregated}-${(chartInputData || []).length}-${showMinMaxLines}`;

  const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
    if (chartType === 'scatter') {
      if (payload && payload.length > 0 && payload[0].payload.timestampDisplay) {
        return payload[0].payload.timestampDisplay;
      }
       if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
        return payload[0].payload.tooltipTimestampFull;
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
    
    if (typeof nameFromRecharts === 'string' && nameFromRecharts.toLowerCase().includes("timestamp")) return null;
    if (typeof dataKey === 'string') {
        const lowerDataKey = dataKey.toLowerCase();
        if (lowerDataKey === 'timestamp' ||
            lowerDataKey === 'timestampdisplay' ||
            lowerDataKey === 'tooltiptimestampfull' ||
            lowerDataKey.includes("stddev") || 
            lowerDataKey.includes("count") ||
            lowerDataKey.includes("aggregationperiod")
           ) {
            if (chartType === 'scatter' && (nameFromRecharts.toLowerCase().includes("std dev") || dataKey.includes("stddev"))) {
            } else {
                return null;
            }
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
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;
    if (typeof displayName === 'string' && displayName.toLowerCase().includes('std. dev') && chartType !== 'scatter') return null;


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

        if (name.includes("timestamp") ||
            dataKey === 'timestamp' ||
            dataKey === 'timestampdisplay' ||
            dataKey === 'tooltiptimestampfull' ||
            dataKey.includes("count") || 
            dataKey.includes("aggregationperiod")
           ) {
          return false;
        }
         if (chartType === 'scatter' && dataKey.includes("stddev") && !numericMetricsForScatter.some(m => `${m}_stdDev` === dataKey)) {
             return false;
         }

        return true;
      });

    if (filteredPayload.length === 0) {
      return null; 
    }

    return (
      <ChartTooltipContent
        {...props}
        payload={filteredPayload} 
        formatter={tooltipFormatter}
        labelFormatter={tooltipLabelFormatter}
        hideIndicator={(chartType === 'scatter' && isAggregated)} 
      />
    );
  };

  const metricsAvailableForCurrentChartType = useMemo(() => {
    // Filter out 'sunriseSunset' for direct plotting as line/bar/scatter
    const plottableMetrics = selectedMetrics.filter(key => key !== 'sunriseSunset');

    if (chartType === 'scatter') {
      return plottableMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString; 
      });
    }
    return plottableMetrics;
  }, [selectedMetrics, METRIC_CONFIGS, chartType]);

  const sunriseSunsetBlocks = useMemo(() => {
    if (!formattedData || formattedData.length === 0 || !selectedMetrics.includes('sunriseSunset')) {
      return [];
    }

    const blocks: { x1: any; x2: any; type: "Sunrise" | "Sunset" }[] = [];
    let currentBlock: { start: any; type: "Sunrise" | "Sunset" | null; startIndex: number } | null = null;

    for (let i = 0; i < formattedData.length; i++) {
      const point = formattedData[i];
      const pointType = point.sunriseSunset as "Sunrise" | "Sunset";
      const xValue = isAggregated ? point.timestampDisplay : point.timestamp;

      if (currentBlock === null) {
        currentBlock = { start: xValue, type: pointType, startIndex: i };
      } else if (pointType !== currentBlock.type) {
        const prevPointXValue = isAggregated ? formattedData[i - 1].timestampDisplay : formattedData[i - 1].timestamp;
        blocks.push({ x1: currentBlock.start, x2: prevPointXValue, type: currentBlock.type as "Sunrise" | "Sunset" });
        currentBlock = { start: xValue, type: pointType, startIndex: i };
      }
    }

    if (currentBlock && currentBlock.type) {
      const lastPointXValue = isAggregated ? formattedData[formattedData.length - 1].timestampDisplay : formattedData[formattedData.length - 1].timestamp;
      blocks.push({ x1: currentBlock.start, x2: lastPointXValue, type: currentBlock.type as "Sunrise" | "Sunset"});
    }
    return blocks;
  }, [formattedData, isAggregated, selectedMetrics]);


  const renderChartSpecificElements = () => {
    const plottableMetrics = selectedMetrics.filter(key => key !== 'sunriseSunset');

    if (chartType === 'scatter') {
      const numericMetricsForScatterFiltered = plottableMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString;
      });
      if (numericMetricsForScatterFiltered.length === 0) return null;
      
      const elements: JSX.Element[] = [];
      numericMetricsForScatterFiltered.forEach((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig || metricConfig.isString) return; 

        const yDataKey = isAggregated ? `${key}_avg` : key; 
        const baseMetricKey = key; 
        const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
        const zAxisUniqueId = `z-${key}`; 

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
            yAxisId="left"
            key={`scatter-${key}`}
            name={chartConfigForShadcn[yDataKey]?.label || yDataKey} 
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
        const metricsToRenderForLine = plottableMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
        if (metricsToRenderForLine.length === 0) return null;
        return metricsToRenderForLine.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig) return null; 
          const color = metricConfig.color || '#8884d8';
          const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
          return (
            <Line
              yAxisId="left"
              key={`line-${key}`}
              type="monotone"
              dataKey={key} 
              stroke={color}
              name={name}
              strokeWidth={2} 
              dot={isAggregated ? { r: 3, fill: color, stroke: color, strokeWidth: 1 } : false} 
              connectNulls={false} 
              animationDuration={300}
            />
          );
        });
    } else if (chartType === 'bar') {
        const metricsToRenderForBar = plottableMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
        if (metricsToRenderForBar.length === 0) return null;
        return metricsToRenderForBar.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig) return null;
          const color = metricConfig.color || '#8884d8';
          const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
          return (
            <Bar
              yAxisId="left"
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

  const renderChart = () => {
    let currentChartDataForRender: any[] = formattedData; 

    const actualPlottableMetrics = selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        // sunriseSunset is not directly plottable as a series
        if (key === 'sunriseSunset') return false;
        // For scatter, only numeric are plottable
        if (chartType === 'scatter' && config && config.isString) return false;
        return true;
    });

    if (isLoading || !currentChartDataForRender || currentChartDataForRender.length === 0 || (actualPlottableMetrics.length === 0 && !selectedMetrics.includes('sunriseSunset'))) {
      return (
        <Card className="shadow-lg h-full">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center"> 
            <p className="text-muted-foreground">
              {isLoading ? "Loading chart data..." :
                (actualPlottableMetrics.length === 0 && selectedMetrics.includes('sunriseSunset')) ?
                "Displaying Day/Night periods. Select another metric to see its trend." :
                (actualPlottableMetrics.length === 0 && selectedMetrics.length > 0 && chartType === 'scatter') ?
                `Please select numeric metrics for the ${chartType} chart.` :
                "No data available for the selected criteria or metrics."
              }
            </p>
          </CardContent>
        </Card>
      );
    }

    const xAxisProps: any = {
        stroke: "hsl(var(--foreground))", 
        tick: { fill: "hsl(var(--foreground))", fontSize: 11 },
    };
    const yAxisProps: any = {
        yAxisId: "left", 
        stroke: "hsl(var(--foreground))", 
        tick: { fill: "hsl(var(--foreground))", fontSize: 12 },
        tickFormatter: yAxisTickFormatter,
        domain: yAxisDomain,
        allowDecimals: true,
        type: "number" as const, 
        scale: "linear" as const,
        allowDataOverflow: chartType !== 'bar', 
    };


    if (chartType === 'scatter') {
        if (!isAggregated) { 
            xAxisProps.dataKey = "timestamp";
            xAxisProps.type = "number";
            xAxisProps.domain = ['dataMin', 'dataMax']; 
            xAxisProps.tickFormatter = (value: number) => formatTimestampToDdMmHhMmUTC(value);
            xAxisProps.scale = "time";
            xAxisProps.angle = -45;
            xAxisProps.textAnchor = "end";
            xAxisProps.dy = 10;
            xAxisProps.height = 70; 
            xAxisProps.minTickGap = 20;
            xAxisProps.interval = currentChartDataForRender.length > 15 ? Math.floor(currentChartDataForRender.length / 10) : 0; 
        } else { 
            xAxisProps.dataKey = "timestampDisplay";
            xAxisProps.type = "category"; 
            xAxisProps.angle = -45;
            xAxisProps.textAnchor = "end";
            xAxisProps.dy = 10;
            xAxisProps.height = 70;
            xAxisProps.minTickGap = 5; 
            xAxisProps.interval = "preserveStartEnd"; 
        }
         return (
            <ScatterChart
                key={chartDynamicKey}
                data={currentChartDataForRender}
                {...commonCartesianProps}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                {selectedMetrics.includes('sunriseSunset') && sunriseSunsetBlocks.map((block, index) => (
                  <ReferenceArea
                    key={`sunrise-sunset-block-${index}`}
                    x1={block.x1}
                    x2={block.x2}
                    yAxisId="left"
                    fill={block.type === "Sunrise" ? "hsla(50, 100%, 85%, 0.3)" : "hsla(220, 20%, 40%, 0.25)"}
                    stroke="none"
                    ifOverflow="hidden"
                    label={{
                      value: block.type === "Sunrise" ? "Day" : "Night",
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      dx: 5,
                      dy: 5
                    }}
                  />
                ))}
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip
                  content={renderCustomTooltipContent}
                  wrapperStyle={{ outline: "none" }}
                  cursor={false}
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
                    if (typeof rechartsName !== 'string') return value;
                    let originalKey = rechartsName;
                    if (isAggregated && rechartsName.endsWith('_avg')) {
                      originalKey = rechartsName.substring(0, rechartsName.length - 4);
                    } else if (isAggregated && rechartsName.endsWith('_stdDev')) {
                        if (numericMetricsForScatter.includes(originalKey.replace('_stdDev','') as MetricKey) ) {
                            return null;
                        }
                    }
                    const config = chartConfigForShadcn[originalKey as MetricKey];
                    return config?.label || value;
                  }}
                />
                {renderChartSpecificElements()}
            </ScatterChart>
        );
    } else if (chartType === 'bar') {
        xAxisProps.dataKey = "timestampDisplay";
        xAxisProps.type = "category";
        xAxisProps.angle = 0; 
        xAxisProps.textAnchor = "middle";
        xAxisProps.dy = 0;
        xAxisProps.height = 30; 
        xAxisProps.minTickGap = 5;
        xAxisProps.interval = isAggregated ? "preserveStartEnd" : (currentChartDataForRender.length > 20 ? Math.floor(currentChartDataForRender.length / (currentChartDataForRender.length > 0 ? Math.min(10, currentChartDataForRender.length) : 5)) : 0);
        return (
            <BarChart
                key={chartDynamicKey}
                data={currentChartDataForRender}
                onClick={handleLineBarChartClick}
                {...commonCartesianProps}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                 {selectedMetrics.includes('sunriseSunset') && sunriseSunsetBlocks.map((block, index) => (
                  <ReferenceArea
                    key={`sunrise-sunset-block-${index}`}
                    x1={block.x1}
                    x2={block.x2}
                    yAxisId="left"
                    fill={block.type === "Sunrise" ? "hsla(50, 100%, 85%, 0.3)" : "hsla(220, 20%, 40%, 0.25)"}
                    stroke="none"
                    ifOverflow="hidden"
                    label={{
                      value: block.type === "Sunrise" ? "Day" : "Night",
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      dx: 5,
                      dy: 5
                    }}
                  />
                ))}
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip
                  content={renderCustomTooltipContent}
                  wrapperStyle={{ outline: "none" }}
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
                  formatter={(value, entry: any, index) => {
                    const rechartsName = entry.name as string | undefined;
                    if (typeof rechartsName !== 'string') return value;
                    let originalKey = rechartsName;
                     if (isAggregated && rechartsName.endsWith('_avg')) {
                        originalKey = rechartsName.substring(0, rechartsName.length - 4);
                    }
                    const config = chartConfigForShadcn[originalKey as MetricKey];
                    return config?.label || value;
                  }}
                />
                {renderChartSpecificElements()}
            </BarChart>
        );
    } else { 
        xAxisProps.dataKey = "timestampDisplay";
        xAxisProps.type = "category";
        xAxisProps.angle = (chartType === 'line' && !isAggregated) ? -45 : 0;
        xAxisProps.textAnchor = (chartType === 'line' && !isAggregated) ? "end" : "middle";
        xAxisProps.dy = (chartType === 'line' && !isAggregated) ? 10 : 0;
        xAxisProps.height = (chartType === 'line' && !isAggregated) ? 70 : 30;
        xAxisProps.minTickGap = ((chartType === 'line') && !isAggregated) ? 10 : 5;
        xAxisProps.interval = isAggregated ? "preserveStartEnd" : (currentChartDataForRender.length > 20 ? Math.floor(currentChartDataForRender.length / (currentChartDataForRender.length > 0 ? Math.min(10, currentChartDataForRender.length) : 5)) : 0);
        return (
            <LineChart
                key={chartDynamicKey}
                data={currentChartDataForRender}
                onClick={handleLineBarChartClick}
                {...commonCartesianProps}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                {selectedMetrics.includes('sunriseSunset') && sunriseSunsetBlocks.map((block, index) => (
                  <ReferenceArea
                    key={`sunrise-sunset-block-${index}`}
                    x1={block.x1}
                    x2={block.x2}
                    yAxisId="left"
                    fill={block.type === "Sunrise" ? "hsla(50, 100%, 85%, 0.3)" : "hsla(220, 20%, 40%, 0.25)"}
                    stroke="none"
                    ifOverflow="hidden"
                    label={{
                      value: block.type === "Sunrise" ? "Day" : "Night",
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                      dx: 5,
                      dy: 5
                    }}
                  />
                ))}
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip
                  content={renderCustomTooltipContent}
                  wrapperStyle={{ outline: "none" }}
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
                  formatter={(value, entry: any, index) => {
                    const rechartsName = entry.name as string | undefined;
                    if (typeof rechartsName !== 'string') return value;
                    let originalKey = rechartsName;
                    if (isAggregated && rechartsName.endsWith('_avg')) {
                        originalKey = rechartsName.substring(0, rechartsName.length - 4);
                    }
                    const config = chartConfigForShadcn[originalKey as MetricKey];
                    return config?.label || value;
                  }}
                />
                {renderChartSpecificElements()}
                {showMinMaxLines && chartType === 'line' && minMaxReferenceData &&
                  selectedMetrics.filter(key => key !== 'sunriseSunset').flatMap(metricKey => { // Exclude sunriseSunset from min/max lines
                    const metricMinMax = minMaxReferenceData[metricKey];
                    const metricConfig = METRIC_CONFIGS[metricKey];
                    if (!metricMinMax || !metricConfig || metricConfig.isString || 
                        typeof metricMinMax.minValue !== 'number' || !isFinite(metricMinMax.minValue) ||
                        typeof metricMinMax.maxValue !== 'number' || !isFinite(metricMinMax.maxValue)
                    ) {
                      return [];
                    }
                    const { minValue, maxValue } = metricMinMax;
                    const orderIndex = metricsWithMinMaxLines.indexOf(metricKey);
                    const activeOrderIndex = orderIndex !== -1 ? orderIndex : 0;
                    const dyMinLabel = 5 + activeOrderIndex * 12;
                    const dyMaxLabel = -5 - activeOrderIndex * 12;
                    return [
                      <ReferenceLine
                        yAxisId="left"
                        key={`min-line-${metricKey}`}
                        y={minValue}
                        stroke={metricConfig.color}
                        strokeDasharray="2 2"
                        strokeOpacity={0.7}
                        strokeWidth={1.5} 
                        label={{
                          value: `Min: ${minValue.toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`,
                          position: "right",
                          textAnchor: "end",
                          dx: -5,
                          fill: 'hsl(var(--popover-foreground))',
                          fontSize: 10,
                          dy: dyMinLabel
                        }}
                      />,
                      <ReferenceLine
                        yAxisId="left"
                        key={`max-line-${metricKey}`}
                        y={maxValue}
                        stroke={metricConfig.color}
                        strokeDasharray="2 2"
                        strokeOpacity={0.7}
                        strokeWidth={1.5}
                        label={{
                          value: `Max: ${maxValue.toFixed(isAggregated ? 1 : (metricConfig.unit === 'ppm' ? 0 : 2))}${metricConfig.unit || ''}`,
                          position: "right",
                          textAnchor: "end",
                          dx: -5,
                          fill: 'hsl(var(--popover-foreground))',
                          fontSize: 10,
                          dy: dyMaxLabel
                        }}
                      />
                    ];
                  })
                }
            </LineChart>
        );
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
           <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(isAggregated && chartInputData.length > 0 ? ` (Aggregated Data - ${chartInputData[0]?.timestampDisplay ? (chartInputData[0] as AggregatedDataPoint).aggregationPeriod : 'N/A'})` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && numericMetricsForScatter.length > 0 && " Bubble size indicates data spread (standard deviation)."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ChartContainer
            ref={chartRef}
            config={chartConfigForShadcn} 
            className="w-full h-[550px] mx-auto overflow-hidden" 
          >
            {renderChart()}
        </ChartContainer>
        <div className="flex justify-center items-center pt-2 space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" disabled={isExporting || isLoading && (!formattedData || formattedData.length === 0)} className="min-w-[150px]">
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
                <Suspense fallback={<Skeleton className="w-full h-9" />}>
                  {Select && SelectTrigger && SelectValue && SelectContent && SelectItem && (
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
                         {(resolvedTheme === 'dark' || (resolvedTheme === null && currentSystemTheme === 'dark')) ? ( 
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
                  )}
                </Suspense>
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
