
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
import type { WeatherDataPoint, MetricKey, MetricConfig, AggregatedDataPoint } from '@/types/weather';
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
  data: WeatherDataPoint[] | any[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isLoading: boolean;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
  chartType: 'line' | 'bar' | 'scatter';
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
    if (!chartInputData) {
      return [];
    }
    const result = chartInputData.map(point => ({
        ...point,
        timestamp: typeof point.timestamp === 'number' ? point.timestamp : (point.timestampDisplay ? new Date(point.timestampDisplay).getTime() : Date.now()),
        timestampDisplay: point.timestampDisplay || formatTimestampToDdMmHhMmUTC(point.timestamp || Date.now()),
        tooltipTimestampFull: point.tooltipTimestampFull || (isAggregated && point.aggregationPeriod ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp || Date.now())),
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
    const metricsToConsiderForDomain = chartType === 'scatter'
        ? numericMetricsForScatter
        : selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

    const dataValues = metricsToConsiderForDomain.flatMap(metricKey =>
      formattedData.map(p => {
        let value;
        if (chartType === 'scatter' && isAggregated) {
          value = p[metricKey + '_avg'] as number;
        } else {
          value = p[metricKey] as number;
        }
        return typeof value === 'number' && isFinite(value) ? value : undefined;
      }).filter(v => v !== undefined) as number[]
    );

    let effectiveMin = dataValues.length > 0 ? Math.min(...dataValues) : 0;
    let effectiveMax = dataValues.length > 0 ? Math.max(...dataValues) : 10;

    if (dataValues.length === 0 && (!minMaxReferenceData || Object.keys(minMaxReferenceData).length === 0)) {
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
            lowerDataKey.includes("aggregationperiod")) {
            return null;
        }
    }

    let originalMetricKeyForConfig = dataKey;
    let isAvgKey = false;
    if (isAggregated) {
      if (dataKey.endsWith('_avg')) {
        originalMetricKeyForConfig = dataKey.substring(0, dataKey.length - 4);
        isAvgKey = true;
      }
    }
    originalMetricKeyForConfig = originalMetricKeyForConfig as MetricKey;

    const config = METRIC_CONFIGS[originalMetricKeyForConfig];
    const displayName = config?.name || (isAvgKey ? `${originalMetricKeyForConfig} (Avg)` : originalMetricKeyForConfig);
    
    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (displayName.toLowerCase().includes('std dev') || displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period')) return null;

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
      return <div dangerouslySetInnerHTML={{ __html: tooltipHtml }} />;
    }
    
    return [`${displayValue}${unitString}`, displayName];
  };


  const handleScatterPointClick = (scatterPointProps: any, index: number) => {
    console.log('[WeatherChart] Scatter Point Clicked. Index:', index);
    // Log the full scatterPointProps object to inspect its structure
    console.log('[WeatherChart] Full scatterPointProps from Recharts (raw):', scatterPointProps);
    try {
      console.log('[WeatherChart] Full scatterPointProps from Recharts (JSON):', JSON.stringify(scatterPointProps, null, 2));
    } catch (e) {
      console.warn('[WeatherChart] Could not stringify scatterPointProps:', e);
    }

    if (scatterPointProps) {
      console.log('[WeatherChart] Keys available on scatterPointProps:', Object.keys(scatterPointProps));
      if (scatterPointProps.payload) {
        console.log('[WeatherChart] Scatter point payload:', scatterPointProps.payload);
      }
      // Pass the entire scatterPointProps as the second argument (rechartsClickProps)
      // as it contains Recharts context like dataKey, name, etc.
      onPointClick?.(scatterPointProps.payload, scatterPointProps);
    } else {
      console.warn('[WeatherChart] scatterPointProps was null or undefined for scatter click.');
      onPointClick?.(null, null);
    }
  };

  const handleLineBarChartClick = (rechartsEvent: any) => {
    let eventDataString = 'Could not stringify event';
    try {
      eventDataString = JSON.stringify(rechartsEvent, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        if (value instanceof Element) return '[DOM Element]';
        if (key === 'target' && value instanceof EventTarget) return '[EventTarget]';
        return value;
      }, 2);
    } catch (e) { /* ignore stringify errors */ }
    console.log('[WeatherChart] Line/Bar Chart Click. Full Event Data (Sanitized):', eventDataString);

    if (rechartsEvent && rechartsEvent.activePayload && rechartsEvent.activePayload.length > 0) {
      console.log('[WeatherChart] Line/Bar - Active Payload FOUND:', rechartsEvent.activePayload);
      onPointClick?.(rechartsEvent.activePayload[0].payload, rechartsEvent.activePayload[0]); // Pass activePayload[0] as rechartsClickProps
    } else if (rechartsEvent && (rechartsEvent.chartX || rechartsEvent.xValue)) {
      console.log('[WeatherChart] Line/Bar - Click on chart area (empty space). Calling onPointClick with nulls.');
      onPointClick?.(null, null);
    } else {
      console.log('[WeatherChart] Line/Bar - Generic chart click, no specific active payload or chart coordinates. Calling onPointClick with nulls.');
      onPointClick?.(null, null);
    }
  };


  const renderChartSpecificElements = () => {
    if (chartType === 'scatter') {
      if (numericMetricsForScatter.length === 0) {
        return null;
      }
      return numericMetricsForScatter.flatMap((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig || metricConfig.isString) {
          return [];
        }
  
        const yDataKey = isAggregated ? `${key}_avg` : key;
        const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
        const zAxisUniqueId = `z-${key}`;
  
        const elements = [];
  
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
            name={yDataKey} // Set name to yDataKey for programmatic parsing
            dataKey={yDataKey}
            fill={metricConfig.color || '#8884d8'}
            shape="circle"
            animationDuration={300}
            {...(isAggregated && stdDevDataKey ? { zAxisId: zAxisUniqueId } : {})}
            onClick={handleScatterPointClick}
          />
        );
        return elements;
      });
    }

    const metricsToRenderForLineBar = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
    return metricsToRenderForLineBar.map((key) => {
      const metricConfig = METRIC_CONFIGS[key];
      if (!metricConfig) return null;

      const color = metricConfig.color || '#8884d8';
      // Use the raw key for the name prop if a label isn't found, for programmatic access
      const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;

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
              animationDuration={300}
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
              animationDuration={300}
            />
          );
        default:
          return null;
      }
    });
  };

  let ChartComponent: React.ComponentType<any> = LineChart;
  
  const xAxisDataKey = chartType === 'scatter' ? "timestamp" : "timestampDisplay";
  const xAxisType = chartType === 'scatter' ? "number" : "category";
  
  const xAxisTickFormatter = chartType === 'scatter' ?
    (value: number) => formatTimestampToDdMmHhMmUTC(value) :
    undefined;
  const xAxisDomain = chartType === 'scatter' ? (['dataMin', 'dataMax'] as [number | 'auto', number | 'auto']) : undefined;
  const xAxisScale = chartType === 'scatter' ? "time" : "auto";
  
  const numTicks = formattedData.length > 0 ? Math.min(10, formattedData.length) : 5;
  const xAxisAngle = (chartType === 'scatter' || ((chartType === 'line') && !isAggregated)) ? -45 : 0;
  const xAxisTextAnchor = (chartType === 'scatter' || ((chartType === 'line') && !isAggregated)) ? "end" : "middle";
  const xAxisDy = (chartType === 'scatter' || ((chartType === 'line') && !isAggregated)) ? 10 : 0;
  const xAxisHeight = (chartType === 'scatter' || ((chartType === 'line') && !isAggregated)) ? 70 : 30;

  const xAxisMinTickGap = chartType === 'scatter' ? 20 : (((chartType === 'line') && !isAggregated) ? 10 : 5);

  const xAxisInterval = chartType === 'scatter' ?
    (formattedData.length > 15 ? Math.floor(formattedData.length / 10) : 0) :
    (isAggregated ? "preserveStartEnd" : (formattedData.length > 20 ? Math.floor(formattedData.length / numTicks) : 0));


  if (chartType === 'bar') {
    ChartComponent = BarChart;
  } else if (chartType === 'scatter') {
    ChartComponent = ScatterChart;
  }

  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${JSON.stringify(yAxisDomain)}-${isAggregated}-${formattedData.length}-${showMinMaxLines}`;
  
  const scatterLabelFormatter = (label: string | number, payload: any[] | undefined) => {
    if (chartType === 'scatter') return null;
    if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
      return payload[0].payload.tooltipTimestampFull;
    }
    return String(label);
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
            name.includes("std dev") ||
            dataKey.includes("stddev") ||
            dataKey.includes("count") ||
            dataKey.includes("aggregationperiod")
           ) {
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
        labelFormatter={scatterLabelFormatter}
        hideIndicator={chartType === 'scatter' && isAggregated}
      />
    );
  };

  const renderChart = () => (
    <ChartComponent
      key={chartDynamicKey}
      data={formattedData}
      onClick={chartType === 'line' || chartType === 'bar' ? handleLineBarChartClick : undefined}
      {...commonCartesianProps}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis
        dataKey={xAxisDataKey}
        type={xAxisType}
        domain={xAxisDomain}
        scale={xAxisScale}
        tickFormatter={xAxisTickFormatter}
        stroke="#888888"
        tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
        height={xAxisHeight}
        interval={xAxisInterval}
        angle={xAxisAngle}
        textAnchor={xAxisTextAnchor}
        dy={xAxisDy}
        minTickGap={xAxisMinTickGap}
      />
      <YAxis
        stroke="#888888"
        tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
        tickFormatter={yAxisTickFormatter}
        domain={yAxisDomain}
        allowDecimals={true}
        type="number"
        scale="linear"
        allowDataOverflow={chartType === 'line' || chartType === 'scatter'}
      />
      <Tooltip
        content={renderCustomTooltipContent}
        wrapperStyle={{ outline: "none" }}
        cursor={chartType !== 'scatter' ? { stroke: 'hsl(var(--accent))', strokeWidth: 1, strokeDasharray: '3 3' } : false }
        animationDuration={150}
        animationEasing="ease-out"
      />
      <Legend
        wrapperStyle={{ paddingTop: '0px', paddingBottom: '20px' }}
        iconSize={14}
        layout="horizontal"
        align="center"
        verticalAlign="top"
        formatter={(value, entry, index) => {
          // The 'value' here is the 'name' prop from the <Line />, <Bar />, or <Scatter /> component
          const rechartsName = entry.name as string; // This should be the yDataKey like 'temperature_avg' for scatter
          let originalKey = rechartsName;

          if (isAggregated && rechartsName.endsWith('_avg')) {
            originalKey = rechartsName.substring(0, rechartsName.length - 4);
          } else if (isAggregated && rechartsName.endsWith('_stdDev')) {
             if (chartType === 'scatter' && numericMetricsForScatter.includes(originalKey.replace('_stdDev','') as MetricKey) ) {
                 return null; // Don't show std dev in legend for scatter
             }
          }
          
          const config = chartConfigForShadcn[originalKey as MetricKey];
          return config?.label || value; // Fallback to the original value (which might be label or key)
        }}
      />
      {renderChartSpecificElements()}

      {showMinMaxLines && chartType === 'line' && minMaxReferenceData &&
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
  );


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

  const metricsAvailableForCurrentChartType = chartType === 'scatter' ? numericMetricsForScatter : selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

  if (!formattedData || formattedData.length === 0 || metricsAvailableForCurrentChartType.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
          <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(chartType !== 'scatter' || (chartType === 'scatter' && isAggregated)) && (isAggregated ? ` (Aggregated Data - ${formattedData[0]?.aggregationPeriod || ''})` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && numericMetricsForScatter.length > 0 && " Bubble size indicates data spread (standard deviation)."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">
            {chartType === 'scatter' && numericMetricsForScatter.length === 0 && selectedMetrics.length > 0
              ? "Please select numeric metrics (e.g., Temperature, Humidity) for the scatter chart."
              : "No data available for the selected criteria or metrics."
            }
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="font-headline">Historical Data Trends</CardTitle>
           <CardDescription>
            Displaying {chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart
            {(chartType !== 'scatter' || (chartType === 'scatter' && isAggregated)) && (isAggregated ? ` (Aggregated Data - ${formattedData[0]?.aggregationPeriod || ''})` : ` (Raw Data)`)}.
            {(((chartType === 'line' && !isAggregated)) || (chartType === 'scatter' && !isAggregated)) && " Point clicks can populate AI forecast."}
            {chartType === 'scatter' && isAggregated && numericMetricsForScatter.length > 0 && " Bubble size indicates data spread (standard deviation)."}
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
    

