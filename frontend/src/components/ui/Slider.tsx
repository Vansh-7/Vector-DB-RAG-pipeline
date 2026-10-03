import * as SliderPrimitive from '@radix-ui/react-slider';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel?: string;
}

export function Slider({ value, onValueChange, min, max, step = 1, ariaLabel }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className="relative flex items-center select-none touch-none w-full h-5"
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
    >
      <SliderPrimitive.Track className="relative grow rounded-full h-[3px] bg-[--surface-active]">
        <SliderPrimitive.Range className="absolute rounded-full h-full bg-[--primary-action]" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={ariaLabel} className="block w-3.5 h-3.5 rounded-full bg-[--primary-action] border-2 border-[--bg-panel] outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] transition-colors cursor-pointer" />
    </SliderPrimitive.Root>
  );
}
