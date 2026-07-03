

interface AskAIPromptChipsProps {
  onSelect: (prompt: string) => void;
}

const CHIPS = [
  "Summarize the Finance cluster",
  "Retrieve document ref_782",
  "Analyze tech compliance regulations"
];

export function AskAIPromptChips({ onSelect }: AskAIPromptChipsProps) {
  // UX: Hick's Law — Fewer choices at the point of decision instead of an empty input
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
      {CHIPS.map((chip, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(chip)}
          className="px-4 py-1.5 border border-[--border-subtle] rounded-full text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] hover:bg-[#1a1a1a] transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
