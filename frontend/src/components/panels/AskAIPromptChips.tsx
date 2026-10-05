import { useDocuments } from '../../hooks/useDocuments';
import { Button } from '../ui/Button';

interface AskAIPromptChipsProps {
  onSelect: (prompt: string) => void;
  onAddDocument: () => void;
}

export function AskAIPromptChips({ onSelect, onAddDocument }: AskAIPromptChipsProps) {
  const query = useDocuments();
  if (query.isPending) return <p role="status" className="mt-4 text-center text-xs text-[--text-secondary]">Loading your documents…</p>;
  if (query.isError && !query.data) return <p role="alert" className="mt-4 text-center text-xs text-[--text-secondary]">
    Could not load documents. <button type="button" onClick={() => void query.refetch()} className="rounded underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">Retry</button>
  </p>;

  // Keep the server's existing order; suggestions describe filenames, not document contents.
  const [first, second] = (query.data ?? []).filter((document) => document.status.toLowerCase() === 'ready' && document.chunk_count > 0);
  if (!first) return <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
    <p className="text-xs text-[--text-secondary]">Add a document to start asking questions.</p>
    <Button type="button" variant="ghost" onClick={onAddDocument} className="text-xs">Add document</Button>
  </div>;

  const prompts = second ? [
    `Summarize ${first.name}`,
    `What are the key ideas in ${second.name}?`,
    `Compare ${first.name} and ${second.name}`,
  ] : [
    `Summarize ${first.name}`,
    `What are the main ideas in ${first.name}?`,
    `What should I know from ${first.name}?`,
  ];

  return (
    <div aria-label="Example questions" className="mt-4 flex min-w-0 flex-wrap items-center justify-center gap-2">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          title={prompt}
          onClick={() => onSelect(prompt)}
          className="min-h-8 min-w-0 max-w-full rounded-md border border-[--border-subtle] bg-panel/50 px-3 py-1.5 text-xs text-[--text-secondary] transition-colors hover:border-[--border-default] hover:bg-hover hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] sm:max-w-[320px]"
        >
          <span className="block truncate">{prompt}</span>
        </button>
      ))}
    </div>
  );
}
