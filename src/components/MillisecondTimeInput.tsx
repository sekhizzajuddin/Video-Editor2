import React, { useState, useEffect } from 'react';

interface MillisecondTimeInputProps {
  value: number;
  onChange: (val: number) => void;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

export const MillisecondTimeInput: React.FC<MillisecondTimeInputProps> = ({
  value,
  onChange,
  className = '',
  min = 0,
  max,
  disabled = false
}) => {
  const [text, setText] = useState(value.toFixed(3));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(value.toFixed(3));
    }
  }, [value, isFocused]);

  const commitValue = (val: number) => {
    let rounded = Math.round(val * 1000) / 1000;
    if (min !== undefined && rounded < min) rounded = min;
    if (max !== undefined && rounded > max) rounded = max;
    setText(rounded.toFixed(3));
    onChange(rounded);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      // Step: 1ms (0.001s), Shift: 10ms (0.010s), Ctrl/Alt: 100ms (0.100s)
      let step = 0.001;
      if (e.shiftKey) step = 0.01;
      else if (e.ctrlKey || e.altKey) step = 0.1;

      const delta = e.key === 'ArrowUp' ? step : -step;
      commitValue(value + delta);
    } else if (e.key === 'Enter') {
      const parsed = parseFloat(text);
      if (!isNaN(parsed)) {
        commitValue(parsed);
      } else {
        setText(value.toFixed(3));
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) {
      commitValue(parsed);
    } else {
      setText(value.toFixed(3));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      disabled={disabled}
      value={text}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      title="Use Up/Down arrows to adjust by 1ms (Shift: 10ms, Ctrl: 100ms)"
      className={`font-mono text-center select-all bg-black/20 dark:bg-black/30 border border-white/10 hover:border-white/20 focus:border-blue-500 rounded px-1.5 py-0.5 outline-none transition-colors ${className}`}
    />
  );
};
