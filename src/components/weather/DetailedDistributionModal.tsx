
"use client";

import type { FC } from 'react';
import React, { useMemo, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WeatherDataPoint, MetricConfig, MetricKey, DetailModalData as DetailModalDataType } from '@/types/weather';
import { formatTimestampToFullUTC } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle as ModalCardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface DetailedDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DetailModalDataType | null;
}

const getMetricValueFromPoint = (point: WeatherDataPoint, metricKey: MetricKey, metricConfig?: MetricConfig): number | string | undefined => {
  if (!point || metricKey === undefined) return undefined;

  const value = point[metricKey];

  if (metricConfig?.isString) {
    return typeof value === 'string' ? value : (value !== undefined && value !== null ? String(value) : undefined);
  } else {
    const num = Number(value);
    return isFinite(num) ? num : undefined;
  }
};

const CustomViolinTooltip: FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataPoint = payload[0].payload;
    const metricConfig = payload[0].payload.metricConfig as MetricConfig; // Assuming metricConfig is passed in payload
    
    return (
      <div className="bg-popover text-popover-foreground border rounded-md shadow-md p-2 text-xs">
        <p className="font-semibold">{metricConfig?.name || 'Value'}: 
          <span className="font-normal"> {Number(dataPoint.yValue).toFixed(metricConfig?.unit === 'ppm' ? 0 : 2)}{metricConfig?.unit || ''}</span>
        </p>
      </div>
    );
  }
  return null;
};


const DetailedDistributionModal: FC<DetailedDistributionModalProps> = ({ isOpen, onClose, data }) => {
  const [selectedDistributionChart, setSelectedDistributionChart] = useState<'histogram' | 'violin'>('histogram');

  const numericValuesForDistribution = useMemo(() => {
    if (!data || !data.rawPoints || !data.metricKey || !data.metricConfig || data.metricConfig.isString) {
      return null;
    }
    return data.rawPoints
      .map(point => getMetricValueFromPoint(point, data.metricKey, data.metricConfig))
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
  }, [data]);

  const histogramData = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length < 2 || !data?.metricConfig) {
      return null;
    }

    const values = numericValuesForDistribution;
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);

    if (dataMin === dataMax) {
      return [{ range: `${dataMin.toFixed(2)} ${data.metricConfig.unit || ''}`, count: values.length, min: dataMin, max: dataMax }];
    }

    const numBins = Math.min(10, Math.max(3, Math.floor(Math.sqrt(values.length))));
    const binWidth = (dataMax - dataMin) / numBins;

    if (binWidth <= 0) {
        return null;
    }

    const bins = Array(numBins).fill(0).map((_, i) => {
      const binStart = dataMin + i * binWidth;
      const binEnd = dataMin + (i + 1) * binWidth;
      return {
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        min: binStart,
        max: binEnd,
        count: 0,
      };
    });

    values.forEach(value => {
      for (let i = 0; i < bins.length; i++) {
        if (value >= bins[i].min && (value < bins[i].max || (i === bins.length - 1 && value <= bins[i].max + 0.00001))) {
          bins[i].count++;
          break;
        }
      }
    });
    return bins.filter(bin => bin.count > 0 || bins.length ===1);
  }, [numericValuesForDistribution, data?.metricConfig]);

  const jitteredViolinData = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length === 0 || !data?.metricConfig) {
      return null;
    }
    return numericValuesForDistribution.map(val => ({
      yValue: val,
      xJitter: (Math.random() - 0.5) * 0.6, // Jitter between -0.3 and 0.3
      metricConfig: data.metricConfig, // Pass config for tooltip
    }));
  }, [numericValuesForDistribution, data?.metricConfig]);

  const violinYAxisDomain = useMemo(() => {
    if (!numericValuesForDistribution || numericValuesForDistribution.length === 0) {
      return undefined; 
    }
    const minVal = Math.min(...numericValuesForDistribution);
    const maxVal = Math.max(...numericValuesForDistribution);
    if (minVal === maxVal) {
      return [minVal - 1, maxVal + 1]; 
    }
    const padding = (maxVal - minVal) * 0.1 || 1; 
    return [minVal - padding, maxVal + padding];
  }, [numericValuesForDistribution]);


  if (!isOpen || !data) {
    return null;
  }

  const { metricKey, metricConfig, aggregationLabel, stats, rawPoints } = data;

  const canShowDistributionPlots = numericValuesForDistribution && numericValuesForDistribution.length > 0;


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl">
            Detailed View: {metricConfig.name}
          </DialogTitle>
          <DialogDescription>
            Distribution analysis for the aggregation period: {aggregationLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 flex-shrink-0">
            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">Summary Statistics</ModalCardTitle>
                </CardHeader>
                <CardContent className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                    {stats.avg !== undefined && (
                        <div className="flex justify-between"><span>Average:</span> <span className="font-semibold text-primary">{stats.avg.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.min !== undefined && (
                         <div className="flex justify-between"><span>Min:</span> <span className="font-semibold text-primary">{stats.min.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.max !== undefined && (
                         <div className="flex justify-between"><span>Max:</span> <span className="font-semibold text-primary">{stats.max.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.stdDev !== undefined && (
                         <div className="flex justify-between"><span>Std. Dev:</span> <span className="font-semibold text-primary">{stats.stdDev.toFixed(2)} {metricConfig.unit}</span></div>
                    )}
                    {stats.count !== undefined && (
                         <div className="flex justify-between col-span-2"><span>Data Points:</span> <span className="font-semibold text-primary">{stats.count}</span></div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2 pt-4">
                    <ModalCardTitle className="text-md font-semibold">
                        Value Distribution: {selectedDistributionChart === 'histogram' ? 'Histogram' : 'Jitter Plot'}
                    </ModalCardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Tabs defaultValue="histogram" onValueChange={(value) => setSelectedDistributionChart(value as 'histogram' | 'violin')} className="w-full pt-2">
                        <TabsList className="grid w-full grid-cols-2 mb-1 px-2">
                            <TabsTrigger value="histogram" className="text-xs h-8">Histogram</TabsTrigger>
                            <TabsTrigger value="violin" className="text-xs h-8">Jitter Plot</TabsTrigger>
                        </TabsList>
                        <TabsContent value="histogram" className="h-[150px] p-0 pr-4 pb-2 mt-0">
                            {canShowDistributionPlots && histogramData && histogramData.length > 0 ? (
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={histogramData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="range" angle={-25} textAnchor="end" height={40} tick={{ fontSize: 9 }} interval={0} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                        <Tooltip
                                            formatter={(value: number) => [`${value} points`, 'Count']}
                                            labelFormatter={(label: string) => `Range: ${label} ${metricConfig.unit || ''}`}
                                            cursor={{fill: 'hsl(var(--accent) / 0.3)'}}
                                        />
                                        <Bar dataKey="count" fill={metricConfig.color || 'hsl(var(--primary))'} radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    {metricConfig.isString ? "Histogram not applicable for textual data." : "Not enough data or variation for histogram."}
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="violin" className="h-[150px] p-0 pr-1 pb-2 mt-0">
                            {canShowDistributionPlots && jitteredViolinData && jitteredViolinData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis type="number" dataKey="xJitter" domain={[-0.5, 0.5]} hide />
                                        <YAxis 
                                            type="number" 
                                            dataKey="yValue" 
                                            domain={violinYAxisDomain} 
                                            allowDecimals 
                                            tick={{ fontSize: 10 }} 
                                            width={50}
                                            tickFormatter={(value) => Number(value).toFixed(metricConfig?.unit === 'ppm' ? 0 : 1)}
                                        />
                                        <Tooltip cursor={{ fill: 'hsl(var(--accent) / 0.3)' }} content={<CustomViolinTooltip />} />
                                        <Scatter 
                                            name={metricConfig.name} 
                                            data={jitteredViolinData} 
                                            fill={metricConfig.color || 'hsl(var(--primary))'} 
                                            shape="circle"
                                            legendType="none" 
                                        />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            ) : (
                                 <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                    {metricConfig.isString ? "Jitter plot not applicable for textual data." : "Not enough data for jitter plot."}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>

        <div className="flex-grow overflow-hidden mt-2">
          <h4 className="text-md font-semibold mb-2 text-muted-foreground">Contributing Raw Data Points ({rawPoints.length} points):</h4>
          <ScrollArea className="h-[250px] border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead>Timestamp (UTC)</TableHead>
                  <TableHead className="text-right">Value ({metricConfig.unit || 'N/A'})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawPoints.length > 0 ? (
                  rawPoints.map((point, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-xs">
                        {formatTimestampToFullUTC(point.timestamp)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        { metricConfig.isString
                          ? (getMetricValueFromPoint(point, metricKey, metricConfig) as string || 'N/A')
                          : (getMetricValueFromPoint(point, metricKey, metricConfig) as number | undefined)?.toFixed(metricConfig.unit === 'ppm' ? 0 : 2) ?? 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No raw data points for this aggregate.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DetailedDistributionModal;
    
