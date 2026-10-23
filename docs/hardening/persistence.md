# Vector persistence in V1

Each new snapshot is one trusted local pickle envelope containing format
`neuebit.vector.snapshot`, version `1`, algorithm, metric, dimensions and engine
state. Engine state includes reserved deleted identities. HNSW retains its graph
and construction parameters; KD-tree rebuilds from its records. Never load a
user-uploaded or untrusted pickle as a database snapshot.

Startup validates the snapshot, constructs its engine and metric, restores it,
and replays the WAL before publishing the process-local singleton. Unsupported
versions, engines, metrics or corrupt snapshots abort startup. Preserve the
original snapshot and WAL when investigating recovery errors.
Snapshot dimensions must match the configured embedding model's dimensions;
incompatible data aborts startup before requests can mutate it.

Old snapshots contain no metric. Old exact and KD-tree item dictionaries also
contain no engine identifier. Before migrating, back up both files and set
`LEGACY_VECTOR_ALGORITHM=hnsw|kdtree|exact` and
`LEGACY_VECTOR_METRIC=cosine|euclidean|manhattan` to the settings that actually
produced the data. These hints are required only for legacy files and ignored
for versioned snapshots. Loading does not rewrite the old file; the next
successful explicit save or orderly shutdown writes the versioned format.
Do not guess the settings for an unknown legacy file.

An engine switch is atomic in memory under the existing shared lock. It becomes
durable with the next successful snapshot. A crash before that save restores
the last saved engine/metric and replays subsequent vector mutations from the
engine-independent WAL. With no snapshot, recovery uses HNSW/cosine. A failed
engine rebuild leaves the original singleton and configuration in place.

KD-tree axis pruning applies only to Euclidean and Manhattan distance. Cosine
search visits both branches because an axis difference is not a cosine bound.

## Commit and failure ordering

Snapshots serialize to a unique temporary file beside the destination, flush
and fsync that file, then atomically replace the destination. Directory metadata
is synced on platforms/filesystems supporting it; Python does not expose a
portable directory fsync on Windows. Serialization/write/sync/replace failures
before replacement leave the previous snapshot intact. A failure after
replacement leaves the WAL available for idempotent replay. Temporary files
left by abrupt process exit are ignored; never promote an incomplete file.

Existing callers hold the shared lock through snapshot commit and WAL clearing.
Each WAL append flushes and fsyncs before in-memory mutation or acknowledgment;
creation also syncs parent metadata where supported. Failed appends attempt to
roll back the partial record and block all subsequent writes and WAL clearing
until restart/recovery. Inspect the preserved files first if recovery fails.
Malformed, incomplete or unknown WAL records abort startup rather than silently
omitting changes. Keep original data for operator-assisted repair.

Tests inject serialization, disk-full, permission, sync and replacement failures,
check ordering, and abruptly exit child processes after insert/delete WAL writes
for all three engines. These are software failure/restart tests, not a hardware
power-loss or storage-controller durability certification.
