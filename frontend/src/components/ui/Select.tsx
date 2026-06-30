import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ value, onValueChange, options, placeholder }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className="flex items-center justify-between w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] overflow-hidden z-50"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="flex items-center px-3 py-1.5 text-sm text-[#f4f4f4] rounded-[3px] cursor-pointer outline-none data-[highlighted]:bg-[#222222] transition-colors"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
