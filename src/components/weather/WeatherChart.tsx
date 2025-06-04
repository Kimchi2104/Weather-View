
"use client";

import type { FC } from 'react';
import React, { useRef, useState, useMemo } from 'react';
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ScatterChart, Scatter, ReferenceLine } from 'recharts';
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

  const formattedData = useMemo(() => {
    if (!chartInputData) {
      return [];
    }
    if (!isAggregated && chartType !== 'scatter') { 
      return chartInputData.map((point) => ({
        ...point,
        timestampDisplay: formatTimestampToDdMmHhMmUTC(point.timestamp),
        tooltipTimestampFull: formatTimestampToFullUTC(point.timestamp),
      }));
    }
    return chartInputData.map(point => ({
        ...point,
        timestampDisplay: isAggregated ? point.timestampDisplay : formatTimestampToDdMmHhMmUTC(point.timestamp),
        tooltipTimestampFull: isAggregated ? point.timestampDisplay : formatTimestampToFullUTC(point.timestamp),
    }));
  }, [chartInputData, isAggregated, chartType]);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current) return;
    const chartElementToCapture = chartRef.current.querySelector('.recharts-wrapper') || chartRef.current;

    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartElementToCapture as HTMLElement, {
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
            {chartType !== 'scatter' && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(chartType === 'scatter' || (chartType === 'line' && !isAggregated)) && " Click data points to use for AI forecast."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[450px] flex items-center justify-center">
          <p className="text-muted-foreground">No data available for the selected criteria or metrics.</p>
        </CardContent>
      </Card>
    );
  }

  const commonCartesianProps = {
    margin: { top: 5, right: 40, left: 20, bottom: 20 },
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
    if (onPointClick && !isAggregated && event && event.activePayload && event.activePayload.length > 0) {
      const clickedPointData = event.activePayload[0].payload;
      if ('rawTimestampString' in clickedPointData || chartType === 'scatter') {
         onPointClick(clickedPointData as WeatherDataPoint);
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
          height={(isAggregated && chartType !== 'bar') ? 30 : 60} 
          interval="preserveStartEnd"
          angle={(isAggregated && chartType !== 'bar') ? 0 : -45} 
          textAnchor={(isAggregated && chartType !== 'bar') ? "middle" : "end"} 
          dy={(isAggregated && chartType !== 'bar') ? 0 : 10} 
          minTickGap={(isAggregated && chartType !== 'bar') ? 5 : 20} 
        />
        <YAxis
          stroke="#888888"
          tick={{ fill: "hsl(var(--foreground))", fontSize: 12 }}
          tickFormatter={yAxisTickFormatter}
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
          wrapperStyle={{ paddingTop: '0px', paddingBottom: '5px', marginTop: "10px" }}
          iconSize={14}
          layout="horizontal"
          align="center"
          verticalAlign="top"
        />
        {renderChartSpecificElements()}
        
        {/* Hardcoded Test ReferenceLine for 'temperature' if it's a selected metric */}
        {chartType === 'line' && selectedMetrics.includes('temperature') && showMinMaxLines && (
          <ReferenceLine
            y={15} // Fixed Y value for testing
            stroke={metricConfigs['temperature']?.color || 'red'} // Use temperature color or fallback
            strokeDasharray="3 3"
            strokeOpacity={0.9}
            label={{ value: "Test Line @ 15°C", position: "right", fill: metricConfigs['temperature']?.color || 'red', fontSize: 10, dx: -30 }}
          />
        )}

        {showMinMaxLines && chartType === 'line' && minMaxReferenceData &&
          selectedMetrics.map(metricKey => {
            const metricMinMax = minMaxReferenceData[metricKey];
            const metricConfig = metricConfigs[metricKey];
            
            console.log(`[WeatherChart] Processing MinMax for ${metricKey}: metricMinMax:`, metricMinMax, "metricConfig:", metricConfig);

            if (!metricMinMax || !metricConfig || metricConfig.isString) {
              console.log(`[WeatherChart] Skipping MinMax lines for ${metricKey} - Condition not met.`);
              return null;
            }

            const { minValue, maxValue } = metricMinMax;
            console.log(`[WeatherChart] Rendering MinMax lines for ${metricKey} with minValue: ${minValue}, maxValue: ${maxValue}, color: ${metricConfig.color}`);

            if (typeof minValue !== 'number' || !isFinite(minValue) || typeof maxValue !== 'number' || !isFinite(maxValue)) {
                console.warn(`[WeatherChart] Invalid min/max values for ${metricKey}: min=${minValue}, max=${maxValue}. Skipping lines.`);
                return null;
            }

            return (
              <React.Fragment key={`ref-lines-frag-${metricKey}`}>
                <ReferenceLine
                  key={`min-line-${metricKey}`}
                  y={minValue}
                  stroke={metricConfig.color}
                  strokeDasharray="2 2" // Simplified dash array
                  strokeOpacity={0.7} // Slightly more opaque for visibility
                  // Temporarily removed label for simplicity
                  // label={{
                  //   value: `Min`, 
                  //   position: 'right', 
                  //   fill: metricConfig.color,
                  //   fontSize: 10,
                  //   dx: -25, 
                  //   dy: 5 
                  // }}
                />
                <ReferenceLine
                  key={`max-line-${metricKey}`}
                  y={maxValue}
                  stroke={metricConfig.color}
                  strokeDasharray="2 2" // Simplified dash array
                  strokeOpacity={0.7} // Slightly more opaque
                  // Temporarily removed label for simplicity
                  // label={{
                  //   value: `Max`,
                  //   position: 'right',
                  //   fill: metricConfig.color,
                  //   fontSize: 10,
                  //   dx: -25, 
                  //   dy: -5
                  // }}
                />
              </React.Fragment>
            );
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
            {chartType !== 'scatter' && (isAggregated ? ` (Aggregated Data)` : ` (Raw Data)`)}.
            {(chartType === 'scatter' || (chartType === 'line' && !isAggregated)) && " Click data points to use for AI forecast."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div ref={chartRef} className="w-full h-[550px] bg-card mx-auto overflow-hidden">
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

