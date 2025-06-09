
"use client";

import { FC, useMemo, useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DayNightPeriod, AggregatedDurationData } from '@/types/weather';
import { formatDuration } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTheme } from 'next-themes';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';


type AggregationLevel = 'weekly' | 'monthly' | 'annually';

interface DayNightDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  periods: DayNightPeriod[];
}

const DayNightDurationModal: FC<DayNightDurationModalProps> = ({
  isOpen,
  onClose,
  periods,
}) => {
  const [aggregation, setAggregation] = useState<AggregationLevel>('weekly');
  const [isExporting, setIsExporting] = useState(false);
  const { resolvedTheme } = useTheme();
  const chartRef = useRef<HTMLDivElement>(null);

  const aggregatedData = useMemo((): AggregatedDurationData[] => {
    if (!periods.length) return [];

    const groupedData: { [key: string]: { dayDurations: number[]; nightDurations: number[] } } = {};

    periods.forEach(period => {
      const date = new Date(period.startTimestamp);
      let key = '';

      if (aggregation === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = `Week of ${weekStart.toLocaleDateString()}`;
      } else if (aggregation === 'monthly') {
        key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
      } else { // annually
        key = `${date.getFullYear()}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = { dayDurations: [], nightDurations: [] };
      }

      if (period.type === 'Day') {
        groupedData[key].dayDurations.push(period.duration);
      } else {
        groupedData[key].nightDurations.push(period.duration);
      }
    });

    return Object.entries(groupedData).map(([periodLabel, { dayDurations, nightDurations }]) => {
      const avgDay = dayDurations.length ? dayDurations.reduce((a, b) => a + b, 0) / dayDurations.length : 0;
      const avgNight = nightDurations.length ? nightDurations.reduce((a, b) => a + b, 0) / nightDurations.length : 0;

      return {
        periodLabel,
        averageDayDuration: avgDay,
        averageNightDuration: avgNight,
        dayPeriodsCount: dayDurations.length,
        nightPeriodsCount: nightDurations.length,
      };
    });
  }, [periods, aggregation]);

  const exportChart = async (format: 'png' | 'jpeg' | 'pdf') => {
    if (!chartRef.current || isExporting) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: resolvedTheme === 'dark' ? '#020817' : '#FFFFFF',
      });
      const imgData = canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png');
      const filename = `day-night-durations-${aggregation}.${format}`;

      if (format === 'pdf') {
        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(filename);
      } else {
        const link = document.createElement('a');
        link.href = imgData;
        link.download = filename;
        link.click();
      }
    } catch (error) {
      console.error('Error exporting chart:', error);
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Day/Night Duration Analysis</DialogTitle>
          <DialogDescription>
            Average durations of day and night periods.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={aggregation} onValueChange={(value: AggregationLevel) => setAggregation(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aggregation level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
                 <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={() => exportChart('png')}
                    className="w-full mt-4"
                >
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                    Export as PNG
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={() => exportChart('jpeg')}
                    className="w-full mt-2"
                >
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileImage className="mr-2 h-4 w-4" />}
                    Export as JPEG
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    onClick={() => exportChart('pdf')}
                    className="w-full mt-2"
                >
                    {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Export as PDF
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="md:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Average Durations</CardTitle>
                </CardHeader>
                <CardContent ref={chartRef} className="bg-card">
                    <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={aggregatedData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periodLabel" />
                        <YAxis tickFormatter={(ms) => formatDuration(ms)} />
                        <Tooltip formatter={(value: number) => [formatDuration(value), 'Duration']} />
                        <Legend />
                        <Bar dataKey="averageDayDuration" fill="#FFC658" name="Day" />
                        <Bar dataKey="averageNightDuration" fill="#826AF9" name="Night" />
                    </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-2 flex flex-col">
            <h4 className="text-md font-semibold mb-2 text-muted-foreground flex-shrink-0">
                Aggregated Data
            </h4>
            <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Avg. Day Duration</TableHead>
                        <TableHead>Avg. Night Duration</TableHead>
                        <TableHead>Day Periods</TableHead>
                        <TableHead>Night Periods</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {aggregatedData.map(d => (
                            <TableRow key={d.periodLabel}>
                                <TableCell>{d.periodLabel}</TableCell>
                                <TableCell>{formatDuration(d.averageDayDuration)}</TableCell>
                                <TableCell>{formatDuration(d.averageNightDuration)}</TableCell>
                                <TableCell>{d.dayPeriodsCount}</TableCell>
                                <TableCell>{d.nightPeriodsCount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>


        <DialogFooter className="mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DayNightDurationModal;
