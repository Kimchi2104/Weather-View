
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
// ... other imports
import { useToast } from "@/hooks/use-toast"; // Or the correct path to your use-toast hook
// ... rest of your imports


// Dynamically import html2canvas -- REMOVED next/dynamic for html2canvas
// const html2canvas = dynamic(() => import('html2canvas'), { suspense: true });
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
    if (paddedMin > 0 && dataMin < 0) paddedMin = 0; // Ensure it doesn't cross 0 if min is negative
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
  } else { // dataMax is negative
    const padding = Math.max(3, 0.15 * Math.abs(dataMax));
    paddedMax = Math.ceil(dataMax + padding);
    if (paddedMax > 0 && dataMax < 0) paddedMax = 0; // Ensure it doesn't cross 0 if max is negative
  }
  return paddedMax;
};

// ... (after imports, before WeatherChart component)

const getResolvedBackgroundColor = (theme: 'light' | 'dark' | 'aura-glass', chartElement: HTMLElement): string | null => {
  if (theme === 'aura-glass') return null; // Transparent for aura

  try {
    if (chartElement && typeof getComputedStyle === 'function') {
      const style = getComputedStyle(chartElement.parentElement || document.body);
      const cardBg = style.getPropertyValue('--card').trim();
      // Check if cardBg is a valid HSL string, otherwise use fallbacks.
      // Basic check for hsl, can be more robust.
      if (cardBg && cardBg.startsWith('hsl')) {
        return cardBg;
      }
      console.warn("Computed --card background was not a valid HSL string:", cardBg, "Using fallback.");
    }
  } catch (e) {
    console.warn("Could not compute --card background for export:", e);
  }

  // Fallback to explicit HSL colors matching common ShadCN themes
  // Ensure these are the HSL values *without* the 'hsl()' wrapper, as html2canvas expects the direct value.
  // However, html2canvas is generally fine with `hsl(value)` or `rgb(value)` strings.
  // Let's use the full string for clarity and common usage with html2canvas.
  return theme === 'dark' ? 'hsl(222.2 84% 4.9%)' : 'hsl(0 0% 100%)';
};

// const WeatherChart: FC<WeatherChartProps> = ({ ... }) => { ...


// Should be around line 88
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

// type ExportThemeOption = 'current' | 'light' | 'dark'; // Defined higher up

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
  const { theme: currentSystemTheme, resolvedTheme } = useTheme(); // theme property gives current theme (light, dark, system, aura-glass)
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

    const metricsToConsiderForDomain = numericMetricsForScatter.length > 0 && chartType === 'scatter'
        ? numericMetricsForScatter
        : selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

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
    
    if (dataValues.length === 0 && (!minMaxReferenceData || Object.keys(minMaxReferenceData).length === 0)) {
        return [0, 10] as [number | 'auto', number | 'auto'];
    }

    let effectiveMin = dataValues.length > 0 ? Math.min(...dataValues) : (minMaxReferenceData ? Infinity : 0);
    let effectiveMax = dataValues.length > 0 ? Math.max(...dataValues) : (minMaxReferenceData ? -Infinity : 10);

    if (showMinMaxLines && chartType === 'line' && minMaxReferenceData) {
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
    
    if (effectiveMin === Infinity || effectiveMax === -Infinity) { // If still default after checks
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
        config[`${key}_avg`] = { // For aggregated data, the main data key might be metric_avg
          label: `${metricConf.name} (Avg)`,
          icon: metricConf.Icon,
          color: metricConf.color,
        };
         config[`${key}_stdDev`] = { // For ZAxis in scatter plots
          label: `${metricConf.name} (Std. Dev)`,
          icon: undefined, // No icon needed for ZAxis typically
          color: metricConf.color,
        };
         config[`${key}_count`] = { // For tooltip or other displays
            label: `${metricConf.name} (Count)`,
            icon: undefined,
            color: metricConf.color,
        };
      }
    });
    return config;
  }, [METRIC_CONFIGS, isAggregated]);


  // Inside your WeatherChart component:
const { toast } = useToast(); // Add this line to get the toast function

// ... other state and memoized values ...

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

    // Apply target theme for export
    htmlElement.className = ''; // Reset classes
    document.body.className = ''; // Reset body classes

    if (targetExportTheme === 'light') {
      htmlElement.classList.add('light'); // Add your base 'light' class
      document.body.classList.add('light');
    } else if (targetExportTheme === 'dark') {
      htmlElement.classList.add('dark'); // Add your base 'dark' class
      document.body.classList.add('dark');
    } else if (targetExportTheme === 'aura-glass') { 
      htmlElement.classList.add('aura-glass');
      document.body.classList.add('aura-glass');          
    }
    
    // Add a consistent root class if your Tailwind setup depends on it, e.g., for font loading.
    // document.body.classList.add('font-sans', 'antialiased'); // Example

    await new Promise(resolve => setTimeout(resolve, 300)); // Delay for styles

    try {
      const html2canvasModule = await import('html2canvas'); // Standard dynamic import
      const actualHtml2Canvas = html2canvasModule.default; // Access default export

      if (typeof actualHtml2Canvas !== 'function') {
        console.error('html2canvas did not load correctly.', html2canvasModule);
        throw new Error('html2canvas is not available or not a function.');
      }
      
      const resolvedBgColor = getResolvedBackgroundColor(targetExportTheme, chartElementToCapture as HTMLElement);

      const canvas = await actualHtml2Canvas(chartElementToCapture as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: resolvedBgColor,
        logging: process.env.NODE_ENV === 'development', // More detailed logs from html2canvas
        onclone: (documentClone) => {
            // This onclone step is powerful. Re-apply classes to the cloned document's html and body.
            // This helps ensure styles are correctly captured by html2canvas, especially for Tailwind.
            const clonedHtmlElement = documentClone.documentElement;
            const clonedBodyElement = documentClone.body;
            clonedHtmlElement.className = ''; // Clear
            clonedBodyElement.className = ''; // Clear

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
            // clonedBodyElement.classList.add('font-sans', 'antialiased'); // Example if needed
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

  // Handler for scatter plot point clicks
  const handleScatterPointClick = (scatterPointProps: any, index: number, event: React.MouseEvent<SVGElement>, explicitMetricKey: MetricKey) => {
    if (scatterPointProps && onPointClick) {
      // Pass the original payload and the explicitMetricKey
      onPointClick(scatterPointProps.payload, { ...scatterPointProps, explicitMetricKey: explicitMetricKey });
    }
  };


  // Handler for line and bar chart clicks
  const handleLineBarChartClick = (rechartsEvent: any) => {
    let activePayloadData: any = null;
    let activePayloadFull: any = null;

    if (rechartsEvent && rechartsEvent.activePayload && rechartsEvent.activePayload.length > 0) {
        activePayloadData = rechartsEvent.activePayload[0].payload;
        activePayloadFull = rechartsEvent.activePayload[0]; // Keep the full Recharts event data if needed
        onPointClick?.(activePayloadData, activePayloadFull);
    } else if (rechartsEvent && (rechartsEvent.chartX || rechartsEvent.xValue)) { // Click on empty chart area
        onPointClick?.(null, null); // Indicate no specific point was clicked
    } else { // Fallback, potentially for programmatic interactions or unusual cases
        onPointClick?.(null, null);
    }
  };

  const chartDynamicKey = `${chartType}-${selectedMetrics.join('-')}-${JSON.stringify(yAxisDomain)}-${isAggregated}-${(chartInputData || []).length}-${showMinMaxLines}`;

  const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
    // For scatter plots, the label might be the x-axis data key's value.
    // We want to show the timestampDisplay or tooltipTimestampFull from the payload.
    if (chartType === 'scatter') {
      if (payload && payload.length > 0 && payload[0].payload.timestampDisplay) {
        return payload[0].payload.timestampDisplay;
      }
       if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
        return payload[0].payload.tooltipTimestampFull;
      }
      return String(label); // Fallback if specific timestamp fields are not found
    }

    // For line and bar charts, use tooltipTimestampFull if available
    if (payload && payload.length > 0 && payload[0].payload.tooltipTimestampFull) {
      return payload[0].payload.tooltipTimestampFull;
    }
    return String(label); // Fallback for line/bar or if tooltipTimestampFull is missing
  };


 const tooltipFormatter = (value: any, nameFromRecharts: string, entry: any): React.ReactNode | [string, string] | null => {
    const dataKey = entry.dataKey as string; // The actual key from the data object
    
    // Skip unwanted internal/timestamp keys, unless it's a stdDev for scatter
    if (typeof nameFromRecharts === 'string' && nameFromRecharts.toLowerCase().includes("timestamp")) return null;
    if (typeof dataKey === 'string') {
        const lowerDataKey = dataKey.toLowerCase();
        if (lowerDataKey === 'timestamp' ||
            lowerDataKey === 'timestampdisplay' ||
            lowerDataKey === 'tooltiptimestampfull' ||
            lowerDataKey.includes("stddev") || // Default skip for stddev
            lowerDataKey.includes("count") ||
            lowerDataKey.includes("aggregationperiod")
           ) {
            // Exception: Allow stdDev if it's explicitly part of a scatter plot's ZAxis configuration
            if (chartType === 'scatter' && (nameFromRecharts.toLowerCase().includes("std dev") || dataKey.includes("stddev"))) {
                // This allows stdDev to be formatted for scatter tooltips when it's a ZAxis
            } else {
                return null;
            }
        }
    }

    // Determine the original metric key for config lookup
    let originalMetricKeyForConfig = dataKey;
    let isAvgKey = false;
    if (isAggregated) {
      // If it's an aggregated value like 'temperature_avg', strip '_avg' to get 'temperature'
      if (typeof originalMetricKeyForConfig === 'string' && originalMetricKeyForConfig.endsWith('_avg')) {
        originalMetricKeyForConfig = originalMetricKeyForConfig.substring(0, originalMetricKeyForConfig.length - 4);
        isAvgKey = true;
      }
    }
    originalMetricKeyForConfig = originalMetricKeyForConfig as MetricKey; // Cast to MetricKey

    // Get config and display name
    const config = METRIC_CONFIGS[originalMetricKeyForConfig];
    const displayName = config?.name || (isAvgKey ? `${originalMetricKeyForConfig} (Avg)` : originalMetricKeyForConfig);

    // Skip other unwanted labels
    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;
    // For scatter, std. dev might be shown via ZAxis, for other charts, usually not in main tooltip items
    if (typeof displayName === 'string' && displayName.toLowerCase().includes('std. dev') && chartType !== 'scatter') return null;


    // Format the value
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

    // Special handling for aggregated scatter plots to include StdDev and Count in the same tooltip item
    if (chartType === 'scatter' && isAggregated && config && !config.isString && entry.payload) {
      let tooltipHtml = `<div style="color: ${config.color || 'inherit'};"><strong>${displayName}:</strong> ${displayValue}${unitString}`;
      const stdDevValue = entry.payload[`${originalMetricKeyForConfig}_stdDev`]; // e.g., temperature_stdDev
      const countValue = entry.payload[`${originalMetricKeyForConfig}_count`]; // e.g., temperature_count

      if (typeof stdDevValue === 'number' && isFinite(stdDevValue)) {
        tooltipHtml += `<br/>Std. Dev: ${stdDevValue.toFixed(2)}${config?.unit || ''}`;
      }
      if (typeof countValue === 'number' && isFinite(countValue)) {
        tooltipHtml += `<br/>Data Points: ${countValue}`;
      }
      tooltipHtml += `</div>`;
      return React.createElement('div', { dangerouslySetInnerHTML: { __html: tooltipHtml } });
    }
    
    return [`${displayValue}${unitString}`, displayName]; // Standard format for other charts
  };


  const renderCustomTooltipContent = (props: any) => {
    if (!props.active || !props.payload || props.payload.length === 0) {
      return null;
    }

    // Filter out payloads that should not be displayed in the tooltip
    const filteredPayload = props.payload.filter((pldItem: any) => {
        const name = typeof pldItem.name === 'string' ? pldItem.name.toLowerCase() : '';
        const dataKey = typeof pldItem.dataKey === 'string' ? pldItem.dataKey.toLowerCase() : '';

        // General exclusions
        if (name.includes("timestamp") ||
            dataKey === 'timestamp' ||
            dataKey === 'timestampdisplay' ||
            dataKey === 'tooltiptimestampfull' ||
            // dataKey.includes("stddev") || // Let scatter handle its own stddev tooltip
            dataKey.includes("count") || // Usually shown as part of scatter tooltip if aggregated
            dataKey.includes("aggregationperiod")
           ) {
          return false;
        }
        // For scatter plots, if the dataKey is for stdDev, but it's not one of the selected ZAxis metrics, hide it.
        // This prevents stdDev from showing up as a separate line item if it's only used for bubble size.
         if (chartType === 'scatter' && dataKey.includes("stddev") && !numericMetricsForScatter.some(m => `${m}_stdDev` === dataKey)) {
             return false;
         }

        return true;
      });

    if (filteredPayload.length === 0) {
      return null; // Don't render tooltip if no valid items remain
    }

    return (
      <ChartTooltipContent
        {...props}
        payload={filteredPayload} // Use the filtered payload
        formatter={tooltipFormatter}
        labelFormatter={tooltipLabelFormatter}
        hideIndicator={(chartType === 'scatter' && isAggregated)} // Hide default indicator for aggregated scatter, as info is in the bubble/custom format
      />
    );
  };

  const metricsAvailableForCurrentChartType = useMemo(() => {
    if (chartType === 'scatter') {
      return selectedMetrics.filter(key => {
        const config = METRIC_CONFIGS[key];
        return config && !config.isString; // Scatter only for numeric
      });
    }
    // Line and Bar can show string data (though typically they won't make sense, they don't break)
    return selectedMetrics;
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
        // End previous block
        const prevPointXValue = isAggregated ? formattedData[i - 1].timestampDisplay : formattedData[i - 1].timestamp;
        blocks.push({ x1: currentBlock.start, x2: prevPointXValue, type: currentBlock.type as "Sunrise" | "Sunset" });
        currentBlock = { start: xValue, type: pointType, startIndex: i };
      }
    }

    // Add the last block
    if (currentBlock && currentBlock.type) {
      const lastPointXValue = isAggregated ? formattedData[formattedData.length - 1].timestampDisplay : formattedData[formattedData.length - 1].timestamp;
      blocks.push({ x1: currentBlock.start, x2: lastPointXValue, type: currentBlock.type as "Sunrise" | "Sunset"});
    }
    return blocks;
  }, [formattedData, isAggregated, selectedMetrics]);


  const renderChartSpecificElements = () => {
    
    if (chartType === 'scatter') {
      if (numericMetricsForScatter.length === 0) return null;
      // For scatter plots, each metric is a separate <Scatter> component
      // If aggregated, ZAxis is used for stdDev to control bubble size.
      const elements: JSX.Element[] = [];
      numericMetricsForScatter.forEach((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig || metricConfig.isString) return; // Should be pre-filtered by numericMetricsForScatter

        const yDataKey = isAggregated ? `${key}_avg` : key; // Y-axis is always the value (or avg)
        const baseMetricKey = key; // For click handler to know original metric
        const stdDevDataKey = isAggregated ? `${key}_stdDev` : undefined;
        const zAxisUniqueId = `z-${key}`; // Unique ID for ZAxis if used

        // Add ZAxis only if aggregated and stdDevDataKey exists
        if (isAggregated && stdDevDataKey) {
          elements.push(
            <ZAxis
              key={`zaxis-${key}`}
              zAxisId={zAxisUniqueId} // Associate ZAxis with Scatter by this ID
              dataKey={stdDevDataKey}
              range={[MIN_BUBBLE_AREA, MAX_BUBBLE_AREA]} // Define bubble size range
              name={chartConfigForShadcn[`${key}_stdDev`]?.label || `${metricConfig.name} Std Dev`}
            />
          );
        }
        elements.push(
          <Scatter
            yAxisId="left"
            key={`scatter-${key}`}
            name={chartConfigForShadcn[yDataKey]?.label || yDataKey} // Legend name
            dataKey={yDataKey} // Y-axis value
            fill={metricConfig.color || '#8884d8'}
            shape="circle"
            animationDuration={300}
            {...(isAggregated && stdDevDataKey ? { zAxisId: zAxisUniqueId } : {})} // Apply ZAxis if defined
            onClick={(props, index, event) => handleScatterPointClick(props, index, event as React.MouseEvent<SVGElement>, baseMetricKey)}
          />
        );
      });
      return elements;
    } else if (chartType === 'line') {
        const metricsToRenderForLine = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
        if (metricsToRenderForLine.length === 0) return null;
        return metricsToRenderForLine.map((key) => {
          const metricConfig = METRIC_CONFIGS[key];
          if (!metricConfig) return null; // Should not happen if selectedMetrics are valid
          const color = metricConfig.color || '#8884d8';
          const name = chartConfigForShadcn[key]?.label || metricConfig.name || key;
          return (
            <Line
              yAxisId="left"
              key={`line-${key}`}
              type="monotone"
              dataKey={key} // For raw data, this is the direct metric key
              stroke={color}
              name={name}
              strokeWidth={2} // Line thickness
              dot={isAggregated ? { r: 3, fill: color, stroke: color, strokeWidth: 1 } : false} // Dots for aggregated, none for raw to avoid clutter
              connectNulls={false} // Do not connect across null/missing data points
              animationDuration={300}
            />
          );
        });
    } else if (chartType === 'bar') {
        const metricsToRenderForBar = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);
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
    return null; // Should not be reached if chartType is valid
  };

  // This function determines which Recharts component to render
  const renderChart = () => {
    let currentChartDataForRender: any[] = formattedData; // Use the memoized formattedData

    // Loading state or no data/metrics selected
    if (isLoading || !currentChartDataForRender || currentChartDataForRender.length === 0 || (metricsAvailableForCurrentChartType.length === 0 && selectedMetrics.length > 0)) {
      return (
        <Card className="shadow-lg h-full">
          <CardHeader className="pb-3">
            <Skeleton className="h-6 w-1/2 mb-2" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center"> {/* Ensure chart area has a defined height */}
            <p className="text-muted-foreground">
              {isLoading ? "Loading chart data..." :
                (metricsAvailableForCurrentChartType.length === 0 && selectedMetrics.length > 0 && chartType === 'scatter') ?
                `Please select numeric metrics for the ${chartType} chart.` :
                "No data available for the selected criteria or metrics."
              }
            </p>
          </CardContent>
        </Card>
      );
    }

    // Common X and Y Axis props
    const xAxisProps: any = {
        stroke: "hsl(var(--foreground))", // Ensure this uses a theme variable
        tick: { fill: "hsl(var(--foreground))", fontSize: 11 },
    };
    const yAxisProps: any = {
        yAxisId: "left", // Ensure YAxis has an ID
        stroke: "hsl(var(--foreground))", // Ensure this uses a theme variable
        tick: { fill: "hsl(var(--foreground))", fontSize: 12 },
        tickFormatter: yAxisTickFormatter,
        domain: yAxisDomain,
        allowDecimals: true,
        type: "number" as const, // Important for correct axis scaling
        scale: "linear" as const,
        allowDataOverflow: chartType !== 'bar', // Bar charts usually clip, others can extend
    };


    // Determine chart component and specific X-axis props based on chartType
    if (chartType === 'scatter') {
        // Scatter-specific X-axis props
        if (!isAggregated) { // Raw data scatter plot
            xAxisProps.dataKey = "timestamp";
            xAxisProps.type = "number";
            xAxisProps.domain = ['dataMin', 'dataMax']; // Numeric domain for time
            xAxisProps.tickFormatter = (value: number) => formatTimestampToDdMmHhMmUTC(value);
            xAxisProps.scale = "time";
            xAxisProps.angle = -45;
            xAxisProps.textAnchor = "end";
            xAxisProps.dy = 10;
            xAxisProps.height = 70; // Taller to accommodate angled labels
            xAxisProps.minTickGap = 20;
            xAxisProps.interval = currentChartDataForRender.length > 15 ? Math.floor(currentChartDataForRender.length / 10) : 0; // Dynamic interval
        } else { // Aggregated data scatter plot
            xAxisProps.dataKey = "timestampDisplay";
            xAxisProps.type = "category"; // Categories for aggregated timestamps
            xAxisProps.angle = -45;
            xAxisProps.textAnchor = "end";
            xAxisProps.dy = 10;
            xAxisProps.height = 70;
            xAxisProps.minTickGap = 5; // Closer ticks for categories
            xAxisProps.interval = "preserveStartEnd"; // Show first and last, and some in between
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
        // Bar chart X-axis (always categorical for this setup)
        xAxisProps.dataKey = "timestampDisplay";
        xAxisProps.type = "category";
        xAxisProps.angle = 0; // Horizontal labels for bar chart usually
        xAxisProps.textAnchor = "middle";
        xAxisProps.dy = 0;
        xAxisProps.height = 30; // Standard height
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
    } else { // Default to Line chart
        // Line chart X-axis (categorical for timestampDisplay)
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
                  selectedMetrics.flatMap(metricKey => {
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
            {/* Specific message for scatter plots when aggregated */}
            {chartType === 'scatter' && isAggregated && numericMetricsForScatter.length > 0 && " Bubble size indicates data spread (standard deviation)."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {/* ChartContainer from shadcn/ui/chart for consistent styling context */}
        <ChartContainer
            ref={chartRef}
            config={chartConfigForShadcn} // Pass the generated chart config
            className="w-full h-[550px] mx-auto overflow-hidden" 
          >
          {/* Suspense fallback for dynamic imports if any part of renderChart is heavy or dynamic itself */}
          {/* <Suspense fallback={<Skeleton className="h-[450px] w-full]" />}> */}
            {renderChart()}
          {/* </Suspense> */}
        </ChartContainer>
        {/* Export button and options */}
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
