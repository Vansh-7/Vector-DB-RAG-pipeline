import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { domAnimation, LazyMotion, m, useTransform, type MotionValue } from "framer-motion";
import { demoChunks, documentFor } from "./demo/demoContent";
import { useRetrievalStory } from "./useRetrievalStory";
import "../../styles/marketing-tour.css";

const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
const readMotionPreference = () => motionPreference.matches;
const subscribeMotionPreference = (notify: () => void) => {
  motionPreference.addEventListener("change", notify);
  return () => motionPreference.removeEventListener("change", notify);
};
const sourceName = documentFor(demoChunks.find(chunk => chunk.id === "sample-3")!).name;
const excerpt = "Retrieval filters candidates to the authenticated user and searchable documents.";
const ease = (value: number) => 1 - (1 - value) ** 3;

function DocumentMark() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 3H14L19 8V21H5Z M14 3V8H19 M9 12H15 M9 16H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

type SelectionRect = { x:number; y:number; width:number; height:number };

function SelectionLine({ progress, line, index, count }: { progress:MotionValue<number>; line:SelectionRect; index:number; count:number }) {
  const width=useTransform(progress,[index/count,(index+1)/count],[0,line.width],{ease});
  return <m.rect className="retrieval-selection-line" x={line.x} y={line.y} height={line.height} rx="1.5" style={{ width }} />;
}

function PassageSelection({ progress }: { progress:MotionValue<number> }) {
  const quote=useRef<HTMLQuoteElement>(null),text=useRef<HTMLSpanElement>(null);
  const [lines,setLines]=useState<SelectionRect[]>([]);
  useLayoutEffect(()=>{
    let mounted=true;
    const measure=()=>{
      if (!mounted) return;
      const origin=quote.current!.getBoundingClientRect();
      const range=document.createRange();
      range.selectNodeContents(text.current!);
      // A font fallback can split punctuation into another rectangle on the same line.
      const next:SelectionRect[]=[];
      for (const rect of Array.from(range.getClientRects()).filter(rect=>rect.width>0)) {
        const x=rect.left-origin.left-2,y=rect.top-origin.top-1,width=rect.width+4,height=rect.height+2;
        const line=next.find(line=>Math.abs(line.y-y)<3);
        if (line) {
          const right=Math.max(line.x+line.width,x+width),bottom=Math.max(line.y+line.height,y+height);
          line.x=Math.min(line.x,x);line.y=Math.min(line.y,y);
          line.width=right-line.x;line.height=bottom-line.y;
        } else next.push({x,y,width,height});
      }
      setLines(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
    };
    const observer=new ResizeObserver(measure);
    observer.observe(quote.current!);
    measure();
    void document.fonts.ready.then(measure);
    return ()=>{ mounted=false;observer.disconnect(); };
  },[]);
  return <blockquote ref={quote} className="retrieval-original-passage">
    <svg className="retrieval-selection" aria-hidden="true">{lines.map((line,index)=><SelectionLine key={index} progress={progress} line={line} index={index} count={lines.length} />)}</svg>
    <span ref={text}>“{excerpt}”</span>
  </blockquote>;
}

function SemanticNode({ progress, x, y, index }: { progress: MotionValue<number>; x: number; y: number; index: number }) {
  const nearby=index===0||index===4||index===6;
  const opacity=useTransform(progress,[.34+index*.004,.43+index*.004,.56],[.16,nearby?.65:.45,nearby?.55:.27],{ease});
  const xShift=useTransform(progress,[.38,.46,.56],[0,index%2===0?3:-2,0],{ease});
  const yShift=useTransform(progress,[.38,.46,.56],[0,index%3===0?-2:2,0],{ease});
  return <m.circle data-semantic-node="neighbor" cx={x} cy={y} r="3.5" fill="var(--text-secondary)" style={{ opacity,x:xShift,y:yShift }} />;
}

function SemanticField({ progress, fieldRef }: { progress: MotionValue<number>; fieldRef: RefObject<SVGSVGElement | null> }) {
  const visible=useTransform(progress,[.30,.38],[.18,1],{ease});
  const query=useTransform(progress,[.30,.38],[0,1],{ease});
  const queryX=useTransform(query,[0,1],[-6,0]);
  const relationship=useTransform(progress,[.38,.48],[0,1],{ease});
  const selected=useTransform(progress,[.46,.56],[0,1],{ease});
  const context=useTransform(progress,[.54,.62],[0,1],{ease});
  return <m.svg ref={fieldRef} className="retrieval-semantic-field" viewBox="0 0 320 136" fill="none" aria-hidden="true" style={{ opacity: visible }}>
    <ellipse className="retrieval-semantic-region" cx="173" cy="60" rx="57" ry="35" fill="var(--capability-vectors-mark)" />
    <m.path className="retrieval-neighborhood" d="M125 29L180 64L207 103M113 62L180 64L217 31M180 64L165 17" stroke="var(--capability-vectors-ink)" strokeWidth=".75" style={{ pathLength:relationship,opacity:relationship }} />
    {[[125,29],[165,17],[217,31],[242,70],[207,103],[152,92],[113,62]].map(([x,y],index)=><SemanticNode key={x} progress={progress} x={x} y={y} index={index} />)}
    <m.circle data-semantic-node="query" cx="38" cy="50" r="4.5" fill="var(--capability-vectors-mark)" style={{ opacity: query, x: queryX }} />
    <m.path className="retrieval-query-connection" d="M43 50C91 50 123 64 173 64" stroke="var(--capability-vectors-ink)" strokeWidth="1.2" style={{ pathLength: relationship, opacity: relationship }} />
    <m.circle className="retrieval-candidate-ring" cx="180" cy="64" r="11" stroke="var(--capability-search-mark)" strokeWidth="1.2" style={{ pathLength: selected, opacity: selected }} />
    <m.circle data-semantic-node="selected" cx="180" cy="64" r="4.5" fill="var(--capability-search-mark)" style={{ opacity: selected }} />
    <m.path className="retrieval-context-connection" d="M180 77C180 101 160 108 160 129" stroke="var(--capability-search-ink)" strokeWidth="1" style={{ pathLength: context, opacity: context }} />
  </m.svg>;
}

type Anchors = {
  document: RefObject<HTMLDivElement | null>;
  original: RefObject<HTMLSpanElement | null>;
  field: RefObject<SVGSVGElement | null>;
  passage: RefObject<HTMLDivElement | null>;
  answer: RefObject<HTMLDivElement | null>;
  source: RefObject<HTMLSpanElement | null>;
};

function useStoryPaths(frame: RefObject<HTMLDivElement | null>, anchors: Anchors) {
  const [paths,setPaths] = useState({ incoming:"",outgoing:"",provenance:"" });
  const { document,original,field,passage,answer,source } = anchors;
  useLayoutEffect(()=>{
    const surface=frame.current!;
    const measure=()=>{
      if (![document,original,field,passage,answer,source].every(ref=>ref.current)) return;
      const origin=surface.getBoundingClientRect();
      const box=(element:Element)=>{
        const rect=element.getBoundingClientRect();
        let translationY=0,ancestor:Element|null=element;
        // Anchor paths to resting geometry, independently of the 8px reveals.
        while (ancestor && ancestor!==surface) {
          const transform=getComputedStyle(ancestor).transform;
          if (transform!=="none") translationY+=new DOMMatrixReadOnly(transform).m42;
          ancestor=ancestor.parentElement;
        }
        return { left:rect.left-origin.left,right:rect.right-origin.left,top:rect.top-origin.top-translationY,bottom:rect.bottom-origin.top-translationY,width:rect.width,height:rect.height };
      };
      const doc=box(document.current!),svg=box(field.current!),context=box(passage.current!),response=box(answer.current!);
      const citation=box(source.current!),supporting=box(original.current!);
      const scale=Math.min(svg.width/320,svg.height/136);
      const queryX=svg.left+(svg.width-320*scale)/2+38*scale;
      const queryY=svg.top+(svg.height-136*scale)/2+50*scale;
      const fromX=doc.right+4,fromY=doc.top+doc.height*.48,toX=queryX-9;
      const contextX=context.right+4,contextY=context.top+20,answerX=response.left-5,answerY=response.top+response.height*.5;
      const sourceX=citation.left+citation.width/2,sourceY=citation.bottom+7;
      const originalX=supporting.left+supporting.width/2,originalY=supporting.bottom+6;
      const baseline=surface.querySelector<HTMLElement>(".retrieval-zones")!.offsetHeight+20;
      const span=sourceX-originalX;
      const next={
        incoming:"M"+fromX+" "+fromY+"C"+(fromX+16)+" "+fromY+" "+(toX-24)+" "+queryY+" "+toX+" "+queryY,
        outgoing:"M"+contextX+" "+contextY+"C"+(contextX+14)+" "+contextY+" "+(answerX-14)+" "+answerY+" "+answerX+" "+answerY,
        provenance:"M"+sourceX+" "+sourceY+"C"+sourceX+" "+(baseline+4)+" "+(sourceX-span*.2)+" "+(baseline+26)+" "+(sourceX-span*.48)+" "+(baseline+20)+"S"+(originalX-8)+" "+(baseline+2)+" "+originalX+" "+originalY,
      };
      setPaths(previous=>Object.keys(next).every(key=>next[key as keyof typeof next]===previous[key as keyof typeof previous])?previous:next);
    };
    const observer=new ResizeObserver(measure);
    observer.observe(surface);
    for (const ref of [document,field,passage,answer]) observer.observe(ref.current!);
    measure();
    return ()=>observer.disconnect();
  },[frame,document,original,field,passage,answer,source]);
  return paths;
}

type Relationship = "document" | "retrieval" | "passage" | "citation" | "source";

function TrustStory({ progress,release,complete,reduced }: { progress:MotionValue<number>; release:MotionValue<number>; complete:boolean; reduced:boolean }) {
  const frame=useRef<HTMLDivElement>(null);
  const document=useRef<HTMLDivElement>(null),original=useRef<HTMLSpanElement>(null);
  const field=useRef<SVGSVGElement>(null),passage=useRef<HTMLDivElement>(null);
  const answer=useRef<HTMLDivElement>(null),source=useRef<HTMLSpanElement>(null);
  const connections=useRef<SVGSVGElement>(null),tracing=useRef(false);
  const [hovered,setHovered]=useState<Relationship|null>(null),[focused,setFocused]=useState<Relationship|null>(null);
  const [trace,setTrace]=useState<"idle"|"tracing"|"arrived">("idle"),[traceRun,setTraceRun]=useState(0);
  const [announcement,setAnnouncement]=useState("");
  const emphasis=complete?(focused??hovered):null;
  useEffect(()=>{
    if ((!complete||reduced)&&tracing.current) {
      tracing.current=false;
      setTrace(reduced?"arrived":"idle");
    }
  },[complete,reduced]);
  useEffect(()=>{
    const svg=connections.current!;
    // A resize or motion preference change may cancel the finite CSS tracer.
    const stop=()=>{ if (tracing.current) { tracing.current=false;setTrace("arrived"); } };
    svg.addEventListener("animationcancel",stop);
    return ()=>svg.removeEventListener("animationcancel",stop);
  },[]);
  const startTrace=()=>{
    if (!complete||tracing.current) return;
    if (reduced||getComputedStyle(connections.current!).display==="none") {
      setTrace("arrived");
      return;
    }
    tracing.current=true;
    setTraceRun(value=>value+1);
    setTrace("tracing");
  };
  const relationshipProps=(relationship:Relationship)=>({
    "data-relationship":relationship,
    onPointerEnter:()=>{ setHovered(relationship); if (relationship==="source"||relationship==="citation") startTrace(); },
    onPointerLeave:()=>setHovered(null),
    onFocus:()=>{ setFocused(relationship); if (relationship==="source"||relationship==="citation") startTrace(); },
    onBlur:()=>setFocused(null),
  });
  const traceCitation=()=>setAnnouncement("Citation 1 supports the highlighted original passage in "+sourceName+".");
  const paths=useStoryPaths(frame,{document,original,field,passage,answer,source});
  const documentOpacity=useTransform(progress,[0,.10],[.35,1],{ease});
  const documentY=useTransform(progress,[0,.10],[8,0],{ease});
  const sourceHighlight=useTransform(progress,[.03,.15],[0,1]);
  const originalMarker=useTransform(progress,[.14,.18],[0,1],{ease});
  const retrievalHeading=useTransform(progress,[.18,.30],[.28,1],{ease});
  const query=useTransform(progress,[.18,.30],[.15,1],{ease});
  const queryY=useTransform(query,[.15,1],[8,0]);
  const selectedContext=useTransform(progress,[.56,.70],[.12,1],{ease});
  const selectedY=useTransform(selectedContext,[.12,1],[8,0]);
  const passageMarker=useTransform(progress,[.56,.59],[0,1],{ease});
  const passageLabel=useTransform(progress,[.585,.635],[0,1],{ease});
  const passageText=useTransform(progress,[.61,.70],[0,1],{ease});
  const answerHeading=useTransform(progress,[.70,.78],[.28,1],{ease});
  const sentenceOne=useTransform(progress,[.70,.78],[.12,1],{ease});
  const sentenceTwo=useTransform(progress,[.77,.84],[.12,1],{ease});
  const sentenceOneY=useTransform(sentenceOne,[.12,1],[6,0]);
  const sentenceTwoY=useTransform(sentenceTwo,[.12,1],[6,0]);
  const citation=useTransform(progress,[.82,.86],[0,1],{ease});
  const sourceOpacity=useTransform(progress,[.86,.92],[.12,1],{ease});
  const sourceY=useTransform(sourceOpacity,[.12,1],[8,0]);
  const incoming=useTransform(progress,[.18,.38],[0,1],{ease});
  const outgoing=useTransform(progress,[.66,.78],[0,1],{ease});
  const provenance=useTransform(progress,[.90,.96],[0,1],{ease});
  const provenanceOpacity=useTransform(()=>provenance.get()*(1-.8*release.get()));
  return <div ref={frame} className="retrieval-proof-strip" data-complete={complete} data-emphasis={emphasis??"none"} data-trace={complete?trace:"idle"}>
    <div className="retrieval-zones">
      <article className="retrieval-zone" data-zone="document" aria-labelledby="retrieval-document-heading">
        <header className="retrieval-zone-heading"><span>01</span><h3 id="retrieval-document-heading">Your document</h3></header>
        <m.div ref={document} className="retrieval-document" {...relationshipProps("document")} style={{ opacity:documentOpacity,y:documentY }} tabIndex={complete?0:-1} aria-label="Document and original supporting passage">
          <h4><DocumentMark /><span>{sourceName}</span></h4>
          <PassageSelection progress={sourceHighlight} />
          <p className="retrieval-original-label"><m.span ref={original} className="retrieval-citation-number retrieval-origin-number" style={{ opacity:originalMarker }}>[1]</m.span>Original passage</p>
        </m.div>
      </article>
      <article className="retrieval-zone" data-zone="retrieval" aria-labelledby="retrieval-context-heading">
        <m.header className="retrieval-zone-heading" style={{ opacity:retrievalHeading }}><span>02</span><h3 id="retrieval-context-heading">Find the right context</h3></m.header>
        <div className="retrieval-context">
          <div className="retrieval-query-region" {...relationshipProps("retrieval")} tabIndex={complete?0:-1} aria-label="Question, semantic neighborhood, and selected candidate">
            <m.p className="retrieval-question" style={{ opacity:query,y:queryY }}>How does retrieval work?</m.p>
            <SemanticField progress={progress} fieldRef={field} />
          </div>
          <m.div ref={passage} className="retrieval-selected-passage" {...relationshipProps("passage")} style={{ opacity:selectedContext,y:selectedY }} tabIndex={complete?0:-1} aria-labelledby="retrieval-selected-heading">
            <h4 id="retrieval-selected-heading"><m.span className="retrieval-passage-marker" aria-hidden="true" style={{ opacity:passageMarker }} /><m.span style={{ opacity:passageLabel }}>Retrieved passage</m.span></h4>
            <m.p style={{ opacity:passageText }}>Retrieval stays within your knowledge.</m.p>
          </m.div>
        </div>
      </article>
      <article className="retrieval-zone" data-zone="answer" aria-labelledby="retrieval-answer-heading">
        <m.header className="retrieval-zone-heading" style={{ opacity:answerHeading }}><span>03</span><h3 id="retrieval-answer-heading">A grounded answer</h3></m.header>
        <div>
          <div ref={answer} className="retrieval-answer">
            <m.p style={{ opacity:sentenceOne,y:sentenceOneY }}>Neuebit embeds the question and finds related passages.</m.p>
            <m.p style={{ opacity:sentenceTwo,y:sentenceTwoY }}>It filters the <span className="retrieval-grounded-phrase">context to your knowledge</span> and reranks the matches.<m.button type="button" className="retrieval-answer-citation" {...relationshipProps("citation")} style={{ opacity:citation }} disabled={!complete} aria-label="Trace citation 1 to its supporting passage" aria-describedby="retrieval-provenance-description" onClick={traceCitation}>[1]</m.button></m.p>
          </div>
          <m.div className="retrieval-source" style={{ opacity:sourceOpacity,y:sourceY }}>
            <p className="retrieval-source-label">Source</p>
            <button type="button" className="retrieval-source-identity" {...relationshipProps("source")} disabled={!complete} aria-label={"Trace source 1: "+sourceName} aria-describedby="retrieval-provenance-description" onClick={traceCitation}><span ref={source} className="retrieval-citation-number">[1]</span><span>{sourceName}</span></button>
          </m.div>
        </div>
      </article>
    </div>
    <svg ref={connections} className="retrieval-connections" aria-hidden="true">
      <m.path className="retrieval-document-connection" d={paths.incoming} style={{ pathLength:incoming,opacity:incoming }} />
      <m.path className="retrieval-answer-connection" d={paths.outgoing} style={{ pathLength:outgoing,opacity:outgoing }} />
      <m.path className="retrieval-provenance" d={paths.provenance} style={{ pathLength:provenance,opacity:provenanceOpacity }} />
      {complete&&trace==="tracing"&&!reduced&&<path key={traceRun} className="retrieval-provenance-tracer" d={paths.provenance} pathLength="1" onAnimationEnd={event=>{
        if (event.animationName!=="retrieval-provenance-trace") return;
        tracing.current=false;
        setTrace("arrived");
      }} />}
    </svg>
    <span id="retrieval-provenance-description" className="retrieval-accessible-text">Trace citation 1 to its supporting passage.</span>
    <span className="retrieval-accessible-text" role="status">{announcement}</span>
  </div>;
}

export default function ProductTour() {
  const reduced=useSyncExternalStore(subscribeMotionPreference,readMotionPreference);
  const root=useRef<HTMLElement>(null);
  const {progress,release,complete,scrollDriven}=useRetrievalStory(root,reduced);
  const handoff=useTransform(release,[0,.6],[0,.3],{ease});
  useEffect(()=>{
    if (!["#product","#product-story"].includes(location.hash)||window.scrollY!==0) return;
    root.current?.scrollIntoView({block:"start",behavior:"instant"});
    if (document.activeElement===document.body) root.current?.focus({preventScroll:true});
  },[]);
  return <LazyMotion features={domAnimation} strict>
    <section ref={root} id="product" className="product-tour" data-reduced={reduced} data-scroll-story={scrollDriven} tabIndex={-1} aria-labelledby="product-heading">
      <span id="product-story" className="tour-legacy-anchor" aria-hidden="true" />
      <div className="retrieval-story-shell marketing-container">
        <div className="tour-heading"><h2 id="product-heading">Less looking.<br />More understanding.</h2><p>Your documents become context. That context becomes an answer you can trace.</p></div>
        <div className="retrieval-canvas" data-retrieval-stage={complete?"5":"0"} data-state={complete?"complete":"revealing"}>
          <TrustStory progress={progress} release={release} complete={complete} reduced={reduced} />
        </div>
      </div>
      <m.svg className="retrieval-handoff-grid marketing-container" aria-hidden="true" style={{ opacity:handoff }}>
        <defs><pattern id="retrieval-handoff-pattern" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth=".75" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#retrieval-handoff-pattern)" />
      </m.svg>
    </section>
  </LazyMotion>;
}
