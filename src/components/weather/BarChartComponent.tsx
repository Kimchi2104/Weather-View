import type { FC } from 'react';
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AggregatedDataPoint, MetricKey, MetricConfig, WeatherDataPoint } from '@/types/weather';
import { formatTimestampToDdMmHhMmUTC, formatTimestampToFullUTC } from '@/lib/utils';
import { ChartTooltipContent } from '@/components/ui/chart';

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
  }
  return paddedMax;
};

interface BarChartComponentProps {
  data: WeatherDataPoint[] | AggregatedDataPoint[];
  selectedMetrics: MetricKey[];
  metricConfigs: Record<MetricKey, MetricConfig>;
  isAggregated?: boolean;
  onPointClick?: (pointPayload: WeatherDataPoint | AggregatedDataPoint | null, rechartsClickProps: any | null) => void;
}

const BarChartComponent: FC<BarChartComponentProps> = ({
  data: chartInputData,
  selectedMetrics,
  metricConfigs: METRIC_CONFIGS,
  isAggregated = false,
  onPointClick,
}) => {

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

  const yAxisDomain = useMemo(() => {
    let dataValues: number[] = [];

    const metricsToConsiderForDomain = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

    dataValues = metricsToConsiderForDomain.flatMap(metricKey =>
        formattedData.map(p => {
            const value = p[metricKey as keyof typeof p] as number;
            return typeof value === 'number' && isFinite(value) ? value : undefined;
        }).filter(v => v !== undefined) as number[]
    );

    if (dataValues.length === 0) {
        return [0, 10] as [number | 'auto', number | 'auto'];
    }

    const effectiveMin = Math.min(...dataValues);
    const effectiveMax = Math.max(...dataValues);

    const paddedMin = getPaddedMinYDomain(effectiveMin, effectiveMax);
    const paddedMax = getPaddedMaxYDomain(effectiveMax, effectiveMin);

    return [paddedMin, paddedMax] as [number | 'auto', number | 'auto'];
  }, [formattedData, selectedMetrics, METRIC_CONFIGS]);

  const handleBarClick = (rechartsEvent: any) => {
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

  const tooltipLabelFormatter = (label: string | number, payload: any[] | undefined) => {
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
            return null;
        }
    }

    const config = METRIC_CONFIGS[dataKey as MetricKey];
    const displayName = config?.name || dataKey;

    if (typeof displayName === 'string' && displayName.toLowerCase().includes("timestamp")) return null;
    if (typeof displayName === 'string' && (displayName.toLowerCase().includes('data points') || displayName.toLowerCase().includes('aggregation period'))) return null;
     if (typeof displayName === 'string' && displayName.toLowerCase().includes('std. dev')) return null;


    let displayValue: string;
    if (typeof value === 'number' && isFinite(value)) {
      const precision = (config?.unit === 'ppm' ? 0 : (isAggregated ? 1 : 2));
      displayValue = value.toFixed(precision);
    } else if (value === undefined || value === null || (typeof value === 'number' && !isFinite(value))) {
      displayValue = 'N/A';
    } else {
      displayValue = String(value);
    }
    const unitString = (typeof value === 'number' && isFinite(value) && config?.unit) ? ` ${config.unit}` : '';

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
        labelFormatter={tooltipLabelFormatter}
      />
    );
  };


  const metricsToRenderForBar = selectedMetrics.filter(key => !METRIC_CONFIGS[key]?.isString);

  if (metricsToRenderForBar.length === 0) {
      return null; // Or a message indicating no numeric metrics selected
  }

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

  const xAxisProps: any = {
    dataKey: "timestampDisplay",
    type: "category",
    angle: 0,
    textAnchor: "middle",
    dy: 0,
    height: 30,
    minTickGap: 5,
    interval: isAggregated ? "preserveStartEnd" : (formattedData.length > 20 ? Math.floor(formattedData.length / (formattedData.length > 0 ? Math.min(10, formattedData.length) : 5)) : 0),
    stroke: "hsl(var(--foreground))",
    tick: { fill: "hsl(var(--foreground))", fontSize: 11 },
  };

  const yAxisProps: any = {
    stroke: "hsl(var(--foreground))",
    tick: { fill: "hsl(var(--foreground))", fontSize: 12 },
    tickFormatter: yAxisTickFormatter,
    domain: yAxisDomain,
    allowDecimals: true,
    type: "number" as const,
    scale: "linear" as const,
    allowDataOverflow: true,
  };


  return (
    <BarChart
      data={formattedData}
      onClick={handleBarClick}
      {...commonCartesianProps}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
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
        formatter={(value, entry: any) => {
           const rechartsName = entry.name as string | undefined;
           if (typeof rechartsName !== 'string') {
            return value;
           }

           const config = METRIC_CONFIGS[rechartsName as MetricKey];
           return config?.label || value;
        }}
      />
      {metricsToRenderForBar.map((key) => {
        const metricConfig = METRIC_CONFIGS[key];
        if (!metricConfig) return null;
        const color = metricConfig.color || '#8884d8';
        const name = metricConfig.name || key;
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
      })}
    </BarChart>
  );
};

export default BarChartComponent;