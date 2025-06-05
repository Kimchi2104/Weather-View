
import Header from '@/components/Header';
import WeatherDashboard from '@/components/weather/WeatherDashboard';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <WeatherDashboard />
      </main>
      <footer className="text-muted-foreground py-6 text-center text-sm"> {/* Removed bg-muted */}
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} WeatherView. All rights reserved.</p>
          <p className="text-xs mt-1">Data visualization for your weather station.</p>
          <div className="mt-4 border-t border-border/50 pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">PROJECT CONTRIBUTIONS BY SUNZI & KIMJOO</h4>
            <ul className="text-xs mt-2 space-y-0.5 text-muted-foreground">
              <li>Weather Station Setup for Data Collection</li>
              <li>Weather Station Data Integration</li>
              <li>Realtime Database Setup & Rules Configuration</li>
              <li>AI-Powered Forecasting Flow Implementation</li>
              <li>Deep Learning and LLM Models Trained for Forecast</li>
              <li>Weather Viewer Application Development & UI Design</li>
              <li>Application Publishing & Deployment Setup</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
