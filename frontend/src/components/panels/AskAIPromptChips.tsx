import { useVectorSample } from '../../hooks/useVectorSample';

interface AskAIPromptChipsProps {
  onSelect: (prompt: string) => void;
}

const EXAMPLES = [
  { label: 'Summarize my documents', prompt: 'Summarize the key ideas in my documents.' },
  { label: 'Compare two sources', prompt: 'Compare two relevant sources in my documents. Where do they agree or differ?' },
  { label: 'Explain how HNSW works', prompt: 'Explain how HNSW works using my documents.' },
];

export function AskAIPromptChips({ onSelect }: AskAIPromptChipsProps) {
  const { data: sample } = useVectorSample();
  if (!sample?.count) return null;

  return (
    <div aria-label="Example questions" className="mt-4 flex flex-wrap items-center justify-center gap-2">
      {EXAMPLES.map(({ label, prompt }) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect(prompt)}
          className="rounded-md border border-[--border-subtle] bg-panel/50 px-3 py-1.5 text-xs text-[--text-secondary] transition-colors hover:border-[--border-default] hover:bg-hover hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
