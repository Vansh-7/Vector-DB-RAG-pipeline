import * as SliderPrimitive from '@radix-ui/react-slider';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

export function Slider({ value, onValueChange, min, max, step = 1 }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className="relative flex items-center select-none touch-none w-full h-5"
      value={[value]}
      onValueChange={([v]) => onValueChange(v)}
      min={min}
      max={max}
      step={step}
    >
      <SliderPrimitive.Track className="relative grow rounded-full h-[3px] bg-[rgba(255,255,255,0.08)]">
        <SliderPrimitive.Range className="absolute rounded-full h-full bg-white" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0a0a0a] outline-none focus:ring-1 focus:ring-[rgba(255,255,255,0.3)] transition-colors cursor-pointer" />
    </SliderPrimitive.Root>
  );
}
