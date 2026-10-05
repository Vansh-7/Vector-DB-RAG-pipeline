export type IllustrationMotif = "documents" | "ask" | "search" | "trace" | "inspect" | "loop";

/** Shared editorial geometry. Accent areas identify knowledge, matches and evidence. */
export function IllustrationDrawing({ motif }: { motif: IllustrationMotif }) {
  return <g stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
    {motif === "documents" && <>
      <path d="M30 25H65V76H30Z" fill="var(--capability-documents-soft)" />
      <path d="M43 15H74L86 27V69H43Z" fill="var(--canvas)" />
      <path d="M74 15V28H86M52 39H76M52 47H76M52 55H67" />
      <path d="M51 62H70" stroke="var(--capability-documents-mark)" />
    </>}
    {motif === "ask" && <>
      <path d="M15 19H70V49H43L33 57V49H15Z" fill="var(--canvas)" />
      <path d="M36 29C36 22 48 22 48 29C48 34 42 34 42 38M42 43V43.2" />
      <path d="M62 56H87L97 66V86H62Z" fill="var(--canvas)" />
      <path d="M87 56V67H97M69 73H88M69 79H83" />
      <path d="M53 48C53 64 59 67 66 67" className="illustration-connector" stroke="var(--capability-chat-mark)" pathLength="1" />
      <path d="M63 64L66 67L63 70" stroke="var(--capability-chat-mark)" />
      <path d="M68 71H89V76H68Z" fill="var(--capability-chat-soft)" stroke="none" />
    </>}
    {motif === "search" && <>
      <path d="M23 31L47 47L36 71M47 47L64 23M47 47L77 69" className="illustration-neighborhood" />
      <circle cx="23" cy="31" r="3.5" fill="var(--canvas)" /><circle cx="36" cy="71" r="3.5" fill="var(--canvas)" />
      <circle cx="64" cy="23" r="3.5" fill="var(--canvas)" /><circle cx="77" cy="69" r="3.5" fill="var(--canvas)" />
      <circle cx="47" cy="47" r="9" fill="var(--capability-search-soft)" stroke="none" />
      <circle className="illustration-selected-node" cx="47" cy="47" r="4.5" fill="var(--capability-search-mark)" stroke="none" />
      <circle cx="47" cy="47" r="21" /><path d="M62 62L80 80" />
    </>}
    {motif === "trace" && <>
      <path d="M13 19H70V49H13Z" fill="var(--canvas)" /><path d="M21 29H49M21 38H43" />
      <rect x="53" y="27" width="10" height="13" rx="2" fill="var(--capability-chat-soft)" stroke="var(--capability-chat-mark)" />
      <path d="M58 31V36" stroke="var(--capability-chat-ink)" />
      <path d="M59 49C59 66 82 51 82 64" className="illustration-connector" stroke="var(--capability-chat-mark)" pathLength="1" />
      <path d="M68 62H92L101 71V87H68Z" fill="var(--canvas)" /><path d="M92 62V72H101M75 77H94" />
      <path d="M75 83H89" stroke="var(--capability-documents-mark)" />
    </>}
    {motif === "inspect" && <>
      <path d="M17 74H104M26 16V81" className="illustration-neighborhood" />
      <path d="M32 32L63 24L89 40L84 69L52 76L32 54V32M32 32L61 53L89 40M32 54L61 53L84 69M63 24L61 53L52 76" className="illustration-neighborhood" />
      {[[32,32],[63,24],[89,40],[84,69],[52,76],[32,54]].map(([x,y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" fill="var(--canvas)" />)}
      <circle cx="61" cy="53" r="10" className="illustration-selection-ring" stroke="var(--capability-vectors-mark)" />
      <circle cx="61" cy="53" r="4.5" fill="var(--capability-vectors-mark)" stroke="none" />
    </>}
    {motif === "loop" && <>
      <path d="M7 32H27L35 40V65H7Z" fill="var(--canvas)" /><path d="M27 32V41H35M14 48H28M14 55H24" />
      <path d="M14 61H25" stroke="var(--capability-documents-mark)" />
      <path d="M47 7H73V25H63L58 30V25H47Z" fill="var(--canvas)" /><path d="M56 13H64M56 19H61" />
      <path d="M35 48H55M60 30V42M65 48H85" className="illustration-neighborhood" />
      <circle cx="60" cy="48" r="5" fill="var(--capability-chat-mark)" stroke="none" />
      <path d="M86 33H113V61H86Z" fill="var(--canvas)" /><path d="M92 41H106M92 48H108M92 55H101" />
      <path d="M100 62V75C100 88 22 88 22 67" stroke="var(--capability-chat-mark)" /><path d="M19 70L22 67L25 70" stroke="var(--capability-chat-mark)" />
      <path d="M55 54L43 71M65 54L77 70" className="illustration-neighborhood" />
      <circle cx="40" cy="72" r="3" fill="var(--capability-vectors-mark)" stroke="none" />
      <circle cx="34" cy="78" r="2" fill="var(--capability-vectors-mark)" stroke="none" />
      <path d="M76 71L80 75L86 67" stroke="var(--capability-chat-mark)" />
    </>}
  </g>;
}

// Discovery uses its own bolder mini-posters. Shared job/closing glyphs above stay unchanged.
function AskKnowledgeIllustration() {
  return <>
    <path d="M32 32C46 15 77 16 94 29C113 44 118 75 99 92C82 109 50 103 34 88C18 73 17 49 32 32Z" fill="var(--discovery-accent)" stroke="none" />
    <g className="discovery-document" transform="rotate(-7 50 70)">
      <path d="M29 40H61L74 53V99H29Z" fill="var(--discovery-paper)" />
      <path d="M61 40V53H74M39 62H63M39 71H58" />
      <path d="M38 80H62V88H38Z" fill="var(--discovery-accent)" stroke="none" />
    </g>
    <g className="discovery-bubble">
      <path d="M66 20H119Q126 20 126 27V51Q126 58 119 58H91L78 69V58H66Q59 58 59 51V27Q59 20 66 20Z" fill="var(--discovery-paper)" />
      <path d="M83 34C83 26 98 26 98 34C98 39 90 39 90 44" />
      <circle cx="90" cy="50" r="1.5" fill="currentColor" stroke="none" />
    </g>
    <path className="discovery-connector" d="M111 66V77C111 93 93 96 81 86" strokeWidth="2.5" pathLength="1" />
    <path d="M82 93L80 85L88 84" strokeWidth="2.5" />
  </>;
}

function SearchMeaningIllustration() {
  return <>
    <path d="M31 31C47 13 78 17 96 33C115 49 111 77 96 94C79 111 47 105 31 89C16 73 17 47 31 31Z" fill="var(--discovery-accent)" stroke="none" />
    <g className="discovery-lens">
      <circle cx="79" cy="55" r="29" fill="var(--discovery-paper)" />
      <path d="M100 76L123 101" strokeWidth="3" />
      <path d="M31 41L77 55L44 92" />
      <circle cx="77" cy="55" r="7.5" fill="var(--discovery-accent)" stroke="none" />
    </g>
    <circle cx="31" cy="41" r="6.5" fill="var(--discovery-paper)" />
    <circle cx="44" cy="92" r="5.5" fill="var(--discovery-paper)" />
  </>;
}

function TraceSourcesIllustration() {
  return <>
    <path d="M30 36C41 20 72 16 91 30C110 43 114 72 98 91C81 111 49 105 31 89C15 75 16 54 30 36Z" fill="var(--discovery-accent)" stroke="none" />
    <g className="discovery-answer">
      <rect x="55" y="21" width="70" height="43" rx="6" fill="var(--discovery-paper)" />
      <path d="M66 34H99M66 45H89" />
      <rect x="106" y="30" width="10" height="16" rx="2" fill="var(--discovery-accent)" stroke="none" />
      <path d="M111 35V41" stroke="var(--discovery-paper)" strokeWidth="2" />
    </g>
    <path className="discovery-connector" d="M112 65V82Q112 97 96 97H69" strokeWidth="2.5" pathLength="1" />
    <path d="M75 91L68 97L75 102" strokeWidth="2.5" />
    <g className="discovery-source" transform="rotate(-6 44 82)">
      <path d="M23 60H53L65 72V106H23Z" fill="var(--discovery-paper)" />
      <path d="M53 60V73H65M33 82H54" />
      <path d="M32 90H54V97H32Z" fill="var(--discovery-accent)" stroke="none" />
    </g>
  </>;
}

function VectorEngineIllustration() {
  return <>
    <circle cx="73" cy="57" r="40" fill="var(--discovery-accent)" stroke="none" />
    <path d="M28 20V98H120" />
    <path d="M23 27L28 20L33 27M113 93L120 98L113 103" />
    <path d="M46 68L70 34L101 48L90 79Z" />
    <path d="M70 34L74 61L46 68M74 61L101 48" />
    <circle cx="46" cy="68" r="5.5" fill="var(--discovery-paper)" />
    <circle cx="70" cy="34" r="5.5" fill="var(--discovery-paper)" />
    <circle cx="101" cy="48" r="5.5" fill="var(--discovery-paper)" />
    <circle cx="90" cy="79" r="5.5" fill="var(--discovery-paper)" />
    <circle cx="74" cy="61" r="8" fill="var(--discovery-paper)" />
    <circle className="discovery-vector-focus" cx="74" cy="61" r="3.5" fill="var(--discovery-accent)" stroke="none" />
  </>;
}

export function CapabilityIllustration({ motif }: { motif: "ask" | "search" | "trace" | "inspect" }) {
  return <svg className={`capability-illustration capability-illustration--${motif}`} viewBox="0 0 144 120" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {motif === "ask" && <AskKnowledgeIllustration />}
    {motif === "search" && <SearchMeaningIllustration />}
    {motif === "trace" && <TraceSourcesIllustration />}
    {motif === "inspect" && <VectorEngineIllustration />}
  </svg>;
}
