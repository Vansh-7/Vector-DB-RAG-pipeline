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

function PassageSelection({ progress, textRef }: { progress:MotionValue<number>; textRef:RefObject<HTMLSpanElement | null> }) {
  const quote=useRef<HTMLQuoteElement>(null);
  const [lines,setLines]=useState<SelectionRect[]>([]);
  useLayoutEffect(()=>{
    let mounted=true;
    const measure=()=>{
      if (!mounted) return;
      const origin=quote.current!.getBoundingClientRect();
      const range=document.createRange();
      range.selectNodeContents(textRef.current!);
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
  },[textRef]);
  return <blockquote ref={quote} className="retrieval-original-passage">
    <svg className="retrieval-selection" aria-hidden="true">{lines.map((line,index)=><SelectionLine key={index} progress={progress} line={line} index={index} count={lines.length} />)}</svg>
    <span ref={textRef}>“{excerpt}”</span>
  </blockquote>;
}

function SemanticNode({ progress, x, y, index }: { progress: MotionValue<number>; x: number; y: number; index: number }) {
  const opacity=useTransform(progress,[.36+index*.008,.46+index*.008],[.25,.65],{ease});
  return <m.circle data-semantic-node="neighbor" cx={x} cy={y} r="4" fill="var(--text-secondary)" style={{ opacity }} />;
}

function SemanticField({ progress, fieldRef }: { progress: MotionValue<number>; fieldRef: RefObject<SVGSVGElement | null> }) {
  const visible=useTransform(progress,[.30,.38],[.55,1],{ease});
  const query=useTransform(progress,[.30,.38],[0,1],{ease});
  const queryX=useTransform(query,[0,1],[-6,0]);
  const relationship=useTransform(progress,[.38,.48],[0,1],{ease});
  const selected=useTransform(progress,[.46,.56],[0,1],{ease});
  const context=useTransform(progress,[.54,.62],[0,1],{ease});
  return <m.svg ref={fieldRef} className="retrieval-semantic-field" viewBox="0 0 320 110" fill="none" aria-hidden="true" style={{ opacity: visible }}>
    <m.ellipse className="retrieval-neighborhood" cx="214" cy="52" rx="72" ry="40" stroke="var(--border-default)" strokeWidth="1.1" style={{ pathLength:relationship,opacity:relationship }} />
    {[[167,30],[212,20],[254,32],[276,52],[253,73],[173,72],[153,51]].map(([x,y],index)=><SemanticNode key={x} progress={progress} x={x} y={y} index={index} />)}
    <m.circle data-semantic-node="query" cx="32" cy="51" r="6" fill="var(--capability-vectors-mark)" style={{ opacity: query, x: queryX }} />
    <StoryConnector className="retrieval-query-connection" d="M44 51H133" progress={relationship} />
    <m.circle className="retrieval-candidate-ring" cx="212" cy="52" r="12" fill="var(--capability-search-soft)" stroke="var(--capability-search-mark)" strokeWidth="1.2" style={{ pathLength: selected, opacity: selected }} />
    <m.circle data-semantic-node="selected" cx="212" cy="52" r="5" fill="var(--capability-search-mark)" style={{ opacity: selected }} />
    <StoryConnector className="retrieval-context-connection" d="M212 69V104" progress={context} />
  </m.svg>;
}

/** The arrow tip shares the path's scroll clock, including reverse scrolling. */
function StoryConnector({ d, progress, opacity=progress, className }: { d:string; progress:MotionValue<number>; opacity?:MotionValue<number>; className:string }) {
  const path=useRef<SVGPathElement>(null);
  const [length,setLength]=useState(0);
  useLayoutEffect(()=>{ setLength(d?path.current!.getTotalLength():0); },[d]);
  const tip=useTransform(()=>{
    if (!path.current || !length) return "translate(0px, 0px)";
    const distance=progress.get()*length;
    const point=path.current.getPointAtLength(distance);
    const before=path.current.getPointAtLength(Math.max(0,distance-1));
    const after=path.current.getPointAtLength(Math.min(length,distance+1));
    const angle=Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
    return `translate(${point.x}px, ${point.y}px) rotate(${angle}deg)`;
  });
  const tipOpacity=useTransform(()=>Math.min(1,progress.get()*25)*opacity.get());
  return <g className={className}>
    <m.path ref={path} d={d} fill="none" style={{ pathLength:progress,opacity }} />
    <m.g className="retrieval-flow-arrow" style={{ transform:tip,originX:0,originY:0,transformBox:"view-box",opacity:tipOpacity }}><path d="M-5 -3L0 0L-5 3" fill="none" /></m.g>
  </g>;
}

function MobileFlowArrow() {
  return <svg className="retrieval-mobile-arrow" viewBox="0 0 24 28" fill="none" aria-hidden="true"><path d="M12 2V24M7 19L12 24L17 19" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
      const citation=box(source.current!);
      const originMarker=box(document.current!.querySelector(".retrieval-origin-number")!);
      const scale=Math.min(svg.width/320,svg.height/110);
      const queryX=svg.left+(svg.width-320*scale)/2+32*scale;
      const queryY=svg.top+(svg.height-110*scale)/2+51*scale;
      const fromX=doc.right+3,fromY=queryY,toX=queryX-10;
      const contextX=context.right+3,contextY=context.top+context.height*.5;
      const grounding=answer.current!.querySelector<HTMLSpanElement>(".retrieval-grounded-phrase")!;
      const grounded=box(grounding);
      const answerX=response.left-3,answerY=grounded.top+(grounding.getClientRects()[0]?.height??grounded.height)*.5;
      const elbowX=(contextX+answerX)*.5,direction=answerY>=contextY?1:-1;
      const elbowRadius=Math.max(0,Math.min(6,(answerX-contextX)*.25,Math.abs(answerY-contextY)*.5));
      // Connect the matching citation markers from below, keeping the return clear of the forward flow.
      const sourceX=citation.left+citation.width*.5,sourceY=citation.bottom+4;
      const returnX=originMarker.left+originMarker.width*.5,returnY=originMarker.bottom+7;
      const baseline=surface.querySelector<HTMLElement>(".retrieval-zones")!.offsetHeight+24;
      const returnCorner=8;
      const next={
        incoming:"M"+fromX+" "+fromY+"C"+(fromX+16)+" "+fromY+" "+(toX-24)+" "+queryY+" "+toX+" "+queryY,
        outgoing:`M${contextX} ${contextY}H${elbowX-elbowRadius}Q${elbowX} ${contextY} ${elbowX} ${contextY+direction*elbowRadius}V${answerY-direction*elbowRadius}Q${elbowX} ${answerY} ${elbowX+elbowRadius} ${answerY}H${answerX}`,
        provenance:`M${sourceX} ${sourceY}V${baseline-returnCorner}Q${sourceX} ${baseline} ${sourceX-returnCorner} ${baseline}H${returnX+returnCorner}Q${returnX} ${baseline} ${returnX} ${baseline-returnCorner}V${returnY}`,
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
  const documentOpacity=useTransform(progress,[0,.10,.30,.84,.96],[.6,1,.72,.72,1],{ease});
  const documentY=useTransform(progress,[0,.10],[8,0],{ease});
  const sourceHighlight=useTransform(progress,[.03,.15],[0,1]);
  const originalMarker=useTransform(progress,[.14,.18],[0,1],{ease});
  const retrievalHeading=useTransform(progress,[.18,.30],[.6,1],{ease});
  const query=useTransform(progress,[.18,.30],[.6,1],{ease});
  const queryY=useTransform(query,[.6,1],[8,0]);
  const selectedContext=useTransform(progress,[.56,.70],[.55,1],{ease});
  const selectedY=useTransform(selectedContext,[.55,1],[8,0]);
  const passageMarker=useTransform(progress,[.56,.59],[0,1],{ease});
  const passageLabel=useTransform(progress,[.585,.635],[0,1],{ease});
  const passageText=useTransform(progress,[.61,.70],[0,1],{ease});
  const answerHeading=useTransform(progress,[.70,.78],[.6,1],{ease});
  const answerSurface=useTransform(progress,[.66,.78],[.55,1],{ease});
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
  const payoff=useTransform(progress,[.935,.965],[0,1],{ease});
  const payoffY=useTransform(payoff,[0,1],[4,0]);
  return <div ref={frame} className="retrieval-proof-strip" data-complete={complete} data-emphasis={emphasis??"none"} data-trace={complete?trace:"idle"}>
    <div className="retrieval-zones">
      <article className="retrieval-zone" data-zone="document" aria-labelledby="retrieval-document-heading">
        <header className="retrieval-zone-heading"><span>01</span><h3 id="retrieval-document-heading">Your document</h3></header>
        <m.div ref={document} className="retrieval-document" {...relationshipProps("document")} style={{ opacity:documentOpacity,y:documentY }} tabIndex={complete?0:-1} aria-label="Document and original supporting passage">
          <h4><DocumentMark /><span>{sourceName}</span></h4>
          <PassageSelection progress={sourceHighlight} textRef={original} />
          <p className="retrieval-original-label"><m.span className="retrieval-citation-number retrieval-origin-number" style={{ opacity:originalMarker }}>[1]</m.span>Original passage</p>
        </m.div>
        <MobileFlowArrow />
      </article>
      <article className="retrieval-zone" data-zone="retrieval" aria-labelledby="retrieval-context-heading">
        <m.header className="retrieval-zone-heading" style={{ opacity:retrievalHeading }}><span>02</span><h3 id="retrieval-context-heading">Find the right context</h3></m.header>
        <div className="retrieval-context">
          <div className="retrieval-query-region" {...relationshipProps("retrieval")} tabIndex={complete?0:-1} aria-label="Question searches candidate passages; one context passage is selected">
            <m.p className="retrieval-question" style={{ opacity:query,y:queryY }}>How does retrieval work?</m.p>
            <div className="retrieval-semantic-labels"><span>Query</span><span>Candidate passages</span></div>
            <SemanticField progress={progress} fieldRef={field} />
          </div>
          <m.div ref={passage} className="retrieval-selected-passage" {...relationshipProps("passage")} style={{ opacity:selectedContext,y:selectedY }} tabIndex={complete?0:-1} aria-labelledby="retrieval-selected-heading">
            <h4 id="retrieval-selected-heading"><m.span className="retrieval-passage-marker" aria-hidden="true" style={{ opacity:passageMarker }} /><m.span style={{ opacity:passageLabel }}>Retrieved passage</m.span></h4>
            <m.p style={{ opacity:passageText }}>“{excerpt}”</m.p>
          </m.div>
        </div>
        <MobileFlowArrow />
      </article>
      <article className="retrieval-zone" data-zone="answer" aria-labelledby="retrieval-answer-heading">
        <m.header className="retrieval-zone-heading" style={{ opacity:answerHeading }}><span>03</span><h3 id="retrieval-answer-heading">A grounded answer</h3></m.header>
        <m.div ref={answer} className="retrieval-answer-object" style={{ opacity:answerSurface }}>
          <div className="retrieval-answer">
            <m.p style={{ opacity:sentenceOne,y:sentenceOneY }}>NeueBit embeds the question and finds related passages.</m.p>
            <m.p style={{ opacity:sentenceTwo,y:sentenceTwoY }}>It filters the <span className="retrieval-grounded-phrase">context to your knowledge</span> and reranks the <span className="retrieval-cited-fragment">matches.<m.button type="button" className="retrieval-answer-citation" {...relationshipProps("citation")} style={{ opacity:citation }} disabled={!complete} aria-label="Trace citation 1 to its supporting passage" aria-describedby="retrieval-provenance-description" onClick={traceCitation}>[1]</m.button></span></m.p>
          </div>
          <m.div className="retrieval-source" style={{ opacity:sourceOpacity,y:sourceY }}>
            <p className="retrieval-source-label">Source</p>
            <button type="button" className="retrieval-source-identity" {...relationshipProps("source")} disabled={!complete} aria-label={"Trace source 1: "+sourceName} aria-describedby="retrieval-provenance-description" onClick={traceCitation}><span ref={source} className="retrieval-citation-number">[1]</span><span>{sourceName}</span></button>
          </m.div>
        </m.div>
      </article>
    </div>
    <svg ref={connections} className="retrieval-connections" aria-hidden="true">
      <StoryConnector className="retrieval-document-connection" d={paths.incoming} progress={incoming} />
      <StoryConnector className="retrieval-answer-connection" d={paths.outgoing} progress={outgoing} />
      <StoryConnector className="retrieval-provenance" d={paths.provenance} progress={provenance} opacity={provenanceOpacity} />
      {complete&&trace==="tracing"&&!reduced&&<path key={traceRun} className="retrieval-provenance-tracer" d={paths.provenance} pathLength="1" onAnimationEnd={event=>{
        if (event.animationName!=="retrieval-provenance-trace") return;
        tracing.current=false;
        setTrace("arrived");
      }} />}
    </svg>
    <m.p className="retrieval-payoff" style={{ opacity:payoff,y:payoffY }}>Every answer stays <span>traceable</span> to its source.</m.p>
    <span id="retrieval-provenance-description" className="retrieval-accessible-text">Trace citation 1 to its supporting passage.</span>
    <span className="retrieval-accessible-text retrieval-status" role="status">{announcement}</span>
  </div>;
}

export default function ProductTour() {
  const reduced=useSyncExternalStore(subscribeMotionPreference,readMotionPreference);
  const root=useRef<HTMLElement>(null);
  const {progress,release,complete,scrollDriven}=useRetrievalStory(root,reduced);
  const handoff=useTransform(release,[0,.6],[0,.3],{ease});
  const storyOpacity=useTransform(release,[0,.24,.92],[1,1,0]);
  const storyY=useTransform(release,[0,.24,.92],[0,0,-12],{ease});
  useEffect(()=>{
    if (!["#product","#product-story"].includes(location.hash)||window.scrollY!==0) return;
    root.current?.scrollIntoView({block:"start",behavior:"instant"});
    if (document.activeElement===document.body) root.current?.focus({preventScroll:true});
  },[]);
  return <LazyMotion features={domAnimation} strict>
    <section ref={root} id="product" className="product-tour" data-reduced={reduced} data-scroll-story={scrollDriven} tabIndex={-1} aria-labelledby="product-heading">
      <span id="product-story" className="tour-legacy-anchor" aria-hidden="true" />
      <m.div className="retrieval-story-shell marketing-container" style={{ opacity:storyOpacity,y:storyY }}>
        <div className="tour-heading"><h2 id="product-heading">Less looking.<br />More understanding.</h2><p>Your documents become context. That context becomes an answer you can trace.</p></div>
        <div className="retrieval-canvas" data-retrieval-stage={complete?"5":"0"} data-state={complete?"complete":"revealing"}>
          <TrustStory progress={progress} release={release} complete={complete} reduced={reduced} />
        </div>
      </m.div>
      <m.svg className="retrieval-handoff-grid marketing-container" aria-hidden="true" style={{ opacity:handoff }}>
        <defs><pattern id="retrieval-handoff-pattern" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="currentColor" strokeWidth=".75" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#retrieval-handoff-pattern)" />
      </m.svg>
    </section>
  </LazyMotion>;
}
