import { useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface AskAIPromptChipsProps {
  onSelect: (prompt: string) => void;
}

const FALLBACK_CHIPS = [
  "What kind of documents are stored in this database?",
  "Summarize the most recently ingested information.",
  "Give me an overview of the technical compliance regulations."
];

function extractTopic(text: string): string {
  // Take first sentence or clause
  let t = text.split('.')[0].split(',')[0].trim();
  
  // Remove common intro verbs/articles
  t = t.replace(/^(this is a|testing|adding a|making|what is|how to|a quick test of|a|the)\s+/i, '');
  
  // Cut off at the first common preposition or linking verb to isolate the subject noun phrase
  t = t.split(/\b(is|are|will|has|have|with|for|in|on|at|by|from)\b/i)[0].trim();
  
  // Clean up any trailing punctuation or extra spaces
  t = t.replace(/[.,:;!?]+$/, '').trim();
  
  return t.toLowerCase() || "this topic";
}

export function AskAIPromptChips({ onSelect }: AskAIPromptChipsProps) {
  const vectors = useCanvasStore((s) => s.vectors);

  const chips = useMemo(() => {
    if (!vectors || vectors.length === 0) return FALLBACK_CHIPS;

    const validVectors = vectors.filter(v => v.payload && v.payload.length > 5);
    
    if (validVectors.length === 0) return FALLBACK_CHIPS;

    const shuffled = [...validVectors].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    return selected.map(v => {
      const topic = extractTopic(v.payload!);
      
      if (v.category === 'FINANCE') {
        return `What are the financial implications of ${topic}?`;
      } else if (v.category === 'TECH') {
        return `Explain the technical details of ${topic}.`;
      } else if (v.category === 'FOOD') {
        return `What is the recipe for ${topic}?`;
      } else if (v.category === 'SPORTS & GAMES') {
        return `What are the rules for ${topic}?`;
      } else if (v.category === 'MATHEMATICS') {
        return `Explain the math behind ${topic}.`;
      } else {
        return `Summarize the document about ${topic}.`;
      }
    });
  }, [vectors]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
      {chips.map((chip, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(chip)}
          className="px-4 py-1.5 border border-[--border-subtle] rounded-full text-[11px] font-medium text-[--text-secondary] hover:text-[--text-primary] hover:bg-[#1a1a1a] transition-colors text-center max-w-[90%] truncate"
          title={chip}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
