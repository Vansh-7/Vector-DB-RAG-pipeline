/** Feature drawings share the brand vocabulary without repeating discovery glyphs. */
export function KnowledgeIllustration({ motif }: { motif: "indexed-document" | "answer-source" }) {
  return <svg className="marketing-glyph knowledge-illustration" viewBox="0 0 120 96" fill="none" aria-hidden="true">
    {motif === "indexed-document" ? <>
      <path d="M37 22C49 10 73 12 87 25C101 39 96 61 83 73C69 85 46 79 34 66C23 53 25 34 37 22Z" fill="var(--capability-documents-soft)" />
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 31H66V79H32Z" fill="var(--surface)" />
        <path d="M42 19H72L84 31V71H42Z" fill="var(--surface)" />
        <path d="M72 19V31H84M52 41H73M52 61H65" />
        <path d="M52 51H73" stroke="var(--capability-documents-mark)" />
      </g>
    </> : <>
      <path d="M71 19C90 19 103 32 100 49C97 66 81 78 64 72C49 67 44 48 49 35C53 24 62 19 71 19Z" fill="var(--capability-chat-soft)" />
      <g stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 22H64V48H37L27 57V48H18V22Z" fill="var(--surface)" />
        <path d="M28 32H53M28 39H43" />
        <path d="M76 44H89L98 53V78H65V55" fill="var(--surface)" />
        <path d="M89 44V53H98M74 69H88" />
      </g>
      <path d="M46 43C47 59 56 62 77 61M72 57L77 61L72 65" stroke="var(--capability-chat-mark)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </svg>;
}
