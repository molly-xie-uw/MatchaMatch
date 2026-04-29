import { useState, useEffect } from 'react';
import { Calendar, Check, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface AvailabilitySelectorProps {
  initialAvailability?: { [key: string]: string[] };
  onChange: (availability: { [key: string]: string[] }) => void;
  hideHeader?: boolean;
}

export default function AvailabilitySelector({ initialAvailability = {}, onChange, hideHeader }: AvailabilitySelectorProps) {
  // Convert map to local state: active days and a common time range
  const existingDays = Object.keys(initialAvailability);
  const firstDayWithTime = existingDays.find(d => initialAvailability[d]?.length === 2);
  
  const [activeDays, setActiveDays] = useState<string[]>(existingDays);
  const [startTime, setStartTime] = useState<string>(
    firstDayWithTime ? initialAvailability[firstDayWithTime][0] : "09:00"
  );
  const [endTime, setEndTime] = useState<string>(
    firstDayWithTime ? initialAvailability[firstDayWithTime][1] : "17:00"
  );

  useEffect(() => {
    const newAvailability: { [key: string]: string[] } = {};
    activeDays.forEach(day => {
      newAvailability[day] = [startTime, endTime];
    });
    onChange(newAvailability);
  }, [activeDays, startTime, endTime]);

  const toggleDay = (day: string) => {
    setActiveDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day) 
        : [...prev, day]
    );
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex items-center gap-2 text-brand mb-2">
          <Calendar size={18} />
          <h3 className="font-bold uppercase tracking-widest text-xs">Weekly Coffee Chat Availability</h3>
        </div>
      )}
      
      <div className="glass p-4 border border-white/5 space-y-6">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 block">
            Select Available Days
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(day => {
              const isActive = activeDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "px-4 py-2 rounded-xl border text-xs font-medium transition-all",
                    isActive 
                      ? "bg-brand/20 border-brand text-brand ring-1 ring-brand/50" 
                      : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">
              Start Time
            </label>
            <div className="relative group">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-brand transition-colors" size={14} />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 block">
              End Time
            </label>
            <div className="relative group">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-brand transition-colors" size={14} />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-2 bg-brand/5 border border-brand/10 p-3 rounded-lg">
        <div className="mt-1 text-brand">
          <Clock size={12} />
        </div>
        <p className="text-[10px] text-white/60 leading-relaxed">
          Your availability is set for {activeDays.length > 0 ? activeDays.map(d => d.slice(0, 3)).join(', ') : 'no days'} from {startTime} to {endTime}. Our AI will use this to suggest meeting times.
        </p>
      </div>
    </div>
  );
}
