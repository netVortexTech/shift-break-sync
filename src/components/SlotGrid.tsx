import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { generateSlots, formatSlotRange } from '@/lib/shifts';
import { MAX_PER_SLOT } from '@/types/lunch';
import { motion } from 'framer-motion';
import { Clock, Users, Check } from 'lucide-react';

interface SlotGridProps {
  onSelect: (slotRange: string) => void;
  disabled?: boolean;
}

export function SlotGrid({ onSelect, disabled }: SlotGridProps) {
  const { activeShift, getSlotCount } = useApp();
  const slots = generateSlots(activeShift);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  const handleSelect = (range: string) => {
    setSelectedRange(range);
    onSelect(range);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {slots.map((slot, i) => {
        const range = formatSlotRange(slot);
        const count = getSlotCount(range);
        const remaining = MAX_PER_SLOT - count;
        const isFull = remaining <= 0;
        const isWarning = remaining === 1;
        const isSelected = selectedRange === range;

        let statusClass = 'bg-slot-available-bg border-slot-available/30 hover:border-slot-available';
        let textClass = 'text-slot-available';
        if (isWarning) {
          statusClass = 'bg-slot-warning-bg border-slot-warning/30 hover:border-slot-warning';
          textClass = 'text-slot-warning';
        }
        if (isFull) {
          statusClass = 'bg-slot-full-bg border-slot-full/30';
          textClass = 'text-slot-full';
        }
        if (isSelected && !isFull) {
          statusClass = 'bg-primary/15 border-primary ring-2 ring-primary/30 shadow-lg';
          textClass = 'text-primary';
        }

        return (
          <motion.button
            key={slot.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileTap={!isFull && !disabled ? { scale: 0.93 } : undefined}
            disabled={isFull || disabled}
            onClick={() => handleSelect(range)}
            className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${statusClass} ${
              isFull || disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-md active:scale-[0.97]'
            }`}
          >
            {isSelected && !isFull && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className={`w-3.5 h-3.5 ${textClass}`} />
              <span className="font-heading font-semibold text-sm text-foreground">{range}</span>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${textClass}`}>
              <Users className="w-3 h-3" />
              {isFull ? 'Full' : `${remaining} spot${remaining !== 1 ? 's' : ''} left`}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
