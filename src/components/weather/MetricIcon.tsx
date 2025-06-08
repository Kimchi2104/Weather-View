
import type { FC } from 'react';
import type { LucideProps } from 'lucide-react';
import { CloudRain, Thermometer, Droplets, SunDim, Wind, AlertTriangle, HelpCircle, Gauge, ShieldCheck } from 'lucide-react';
import type { MetricKey } from '@/types/weather';

interface MetricIconProps extends Omit<LucideProps, 'color'> {
  metric: MetricKey | 'alert' | 'unknown';
  isAlerting?: boolean;
}

const iconMap: Record<MetricKey | 'alert' | 'unknown', React.ElementType> = {
  precipitation: CloudRain, // String status
  temperature: Thermometer,
  humidity: Droplets,
  lux: SunDim,
  airQuality: ShieldCheck, // Icon for string-based "Safe Air" etc.
  aqiPpm: Wind, // Icon for numerical PPM AQI
  pressure: Gauge,
  sunriseSunset: SunDim, // Or a dynamic icon based on value
  rainAnalog: CloudRain, // Can use the same icon
  precipitationIntensity: CloudRain, // Can use the same icon
  alert: AlertTriangle,
  unknown: HelpCircle,
};

const MetricIcon: FC<MetricIconProps> = ({ metric, className, isAlerting, ...props }) => {
  const IconComponent = iconMap[metric] || iconMap.unknown;
  const colorClass = isAlerting ? 'text-destructive' : 'text-accent';

  return <IconComponent className={`${colorClass} ${className || ''}`} {...props} />;
};

export default MetricIcon;

