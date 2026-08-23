export interface AlgorithmBenchmark {
  name: string;
  displayName: string;
  latencyMs: number;
  throughputQps: number;
  isActive: boolean;
}

export interface HnswLayerStats {
  level: number;
  nodes: number;
  edges: number;
}

export interface BenchmarkResponse {
  algorithms: AlgorithmBenchmark[];
  timestamp: string;
  topology?: HnswLayerStats[];
}
