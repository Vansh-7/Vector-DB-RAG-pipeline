import type { Algorithm } from './vector';

export interface AlgorithmBenchmark {
  name: Algorithm;
  displayName: string;
  latencyMs: number;
  throughputQps: number;
  isActive: boolean;
}

export interface BenchmarkResponse {
  algorithms: AlgorithmBenchmark[];
  timestamp: string;
}
