# Parallel CLI conversion

Use `kordoc *.pdf --jobs 4 -d ./converted/` to convert documents with four reusable Node.js processes. The default remains `--jobs 1`. Work is scheduled one file at a time per worker; files and successful results are not loaded into the parent process. Each worker can reuse parser/OCR initialization across its files.

Multiple inputs in parallel mode require `--out-dir`. Input names must have distinct stems (case-insensitive), even across directories or extensions, because output files and image folders use those stems. Ambiguous names are rejected before conversion starts. Success output and image manifests use the existing conversion path. A file failure leaves other jobs running and makes the overall exit status nonzero. Failure JSON is written by the parent in completion order; a worker process crash aborts the batch and shuts down the remaining workers. SIGINT/SIGTERM also shuts down workers.

This is file-level parallelism. A single document follows the existing sequential path. The JavaScript `parse()` API, MCP tools, and `parse-worker` protocol are unchanged. `Promise.all()` on CPU-heavy parsing in one JavaScript runtime does not provide this process-level CPU parallelism.

Start with a small worker count and measure your files. Each worker has its own heap and native resources. Native OCR libraries already use threads, so more processes can oversubscribe the CPU or memory. Tiny files can take longer because worker startup dominates. Concurrent missing-model downloads use independent temporary files and only publish verified bytes; they may still download the same model more than once.

## Reproducible benchmark

```sh
npm run build
node bench/batch.mjs
# Or measure your own files, including HWP5:
node bench/batch.mjs /path/to/documents/*.hwp
# Optional: BATCH_JOBS=1,2,4 BATCH_REPS=3
```

The default benchmark creates 24 copies of one synthetic Korean HWPX document with 12,000 added paragraphs, and 24 copies of one synthetic 40-page PDF containing text and ruled lines. This is two distinct generated documents, not 48 distinct real-world documents. It runs each setting three times, reports median wall time including CLI/worker startup, and compares SHA-256 hashes of all outputs against the first run. Images are disabled; OCR is not enabled. On Linux it samples summed RSS of the parent and descendants every 25 ms. Shared pages are counted for each process, so this is not unique physical memory.

Measured 2026-09-29 on Linux/WSL, Node 22.23.2, Intel Core i7-10700 (8 cores / 16 logical CPUs):

| Workload | Jobs | Median seconds | Speedup | Peak summed RSS (MiB) |
| --- | ---: | ---: | ---: | ---: |
| HWPX | 1 | 11.778 | 1.00× | 381.5 |
| HWPX | 2 | 7.032 | 1.68× | 729.7 |
| HWPX | 4 | 4.191 | 2.81× | 1,396.6 |
| PDF | 1 | 5.864 | 1.00× | 228.0 |
| PDF | 2 | 3.208 | 1.83× | 431.9 |
| PDF | 4 | 2.430 | 2.41× | 682.7 |

A separate run with 24 copies of the tiny committed HWPX fixture took 0.222 s with one process, 0.378 s with two, and 0.375 s with four (three-run medians; identical outputs). Worker startup outweighed the small amount of parsing, supporting the sequential default.

All output hashes matched. These synthetic throughput results do not establish real-corpus PDF accuracy, OCR throughput, or HWP5 throughput. The external ODL 200-document and Korean government PDF corpora were unavailable in this checkout. No answer keys, scorers, or exclusion rules were changed.

## Validation

Type checking and ESM/CJS/declaration builds passed. The full test suite passed 2,584 tests, with 11 skipped and no failures. New integration coverage includes image bytes/manifests, Markdown/JSON/chunks parity, continued processing after failure, option validation, output collision rejection, worker crashes, and parent interruption. A separate HWP5 check used two local HWP5 fixtures (four copies each); all eight JSON outputs matched byte for byte with one versus four workers. Concurrent model downloads have a regression test using mocked downloads and real file/hash verification.

This checkout lacked Linux native packages for Rollup, sharp, and PDF canvas support. Validation used temporary external dependencies via `NODE_PATH`; the original checkout and its dependencies were left unchanged.

## Repeatability and eight-worker check

Repeated on 2026-09-29 using the same built CLI and synthetic documents. First, the full 1/2/4-worker benchmark was invoked three additional times. Then the full 1/4/8-worker comparison was invoked three times, each with fresh sequential and four-worker baselines. Every table cell below is the median of three fresh CLI executions. Benchmark invocations ran sequentially, not concurrently; ordinary host activity was not controlled.

Commands per round:

```sh
BATCH_REPS=3 BATCH_JOBS=1,2,4 node bench/batch.mjs
# Separate follow-up comparison:
BATCH_REPS=3 BATCH_JOBS=1,4,8 node bench/batch.mjs
```

All 108 CLI executions (2,592 document conversions) completed successfully and all output hashes matched their round’s baseline. No parser, evaluator, fixture-generation, or worker-pool code changed for these repeats.

### Three additional 1/2/4-worker rounds

| Workload | Round | 1 worker (s) | 2 workers (s) | 4 workers (s) | 4-worker speedup |
| --- | ---: | ---: | ---: | ---: | ---: |
| HWPX | 1 | 8.302 | 4.943 | 3.282 | 2.53× |
| HWPX | 2 | 8.677 | 4.871 | 3.606 | 2.41× |
| HWPX | 3 | 12.133 | 5.381 | 3.921 | 3.09× |
| PDF | 1 | 4.513 | 3.162 | 2.589 | 1.74× |
| PDF | 2 | 4.833 | 2.996 | 2.601 | 1.86× |
| PDF | 3 | 4.952 | 3.532 | 2.633 | 1.88× |

### Three 1/4/8-worker rounds

| Workload | Round | 1 worker (s) | 4 workers (s) | 8 workers (s) | Change in time, 8 vs 4 |
| --- | ---: | ---: | ---: | ---: | ---: |
| HWPX | 1 | 9.881 | 3.685 | 3.184 | -13.6% |
| HWPX | 2 | 9.715 | 3.620 | 3.285 | -9.3% |
| HWPX | 3 | 9.880 | 4.413 | 3.605 | -18.3% |
| PDF | 1 | 5.109 | 2.518 | 2.368 | -6.0% |
| PDF | 2 | 5.205 | 2.612 | 3.941 | +50.9% |
| PDF | 3 | 5.151 | 2.863 | 2.604 | -9.0% |

Four workers consistently outperformed sequential conversion across all six rounds: 2.24–3.09× for HWPX and 1.74–2.03× for PDF. Eight workers reduced HWPX elapsed time by another 9.3–18.3%. For PDF, eight workers reduced time by 6.0% and 9.0% in two rounds but increased it by 50.9% in the other. The measurements do not establish why that round slowed down; eight workers are not a consistent improvement on this PDF workload.

Peak summed RSS across the 1/4/8-worker comparisons:

| Workload | 1 worker (MiB) | 4 workers (MiB) | 8 workers (MiB) |
| --- | ---: | ---: | ---: |
| HWPX | 381.5 | 1,382.9 | 1,755.0 |
| PDF | 234.6 | 683.4 | 1,194.2 |

Four workers offer a more consistent speed/memory tradeoff for these larger synthetic batches. Eight can help the HWPX workload, but should be measured on actual inputs. The CLI default remains one worker, and the earlier small-file regression still applies.

## PR validation against v4.17.1

After rebasing onto upstream `2065b45` (v4.17.1), the conversion helper was checked against the current sequential CLI loop, including `scriptTags` and `layoutTables` option forwarding. Build and type checking passed; the full suite passed 2,694 tests with 11 skipped and no failures. The original checkout was not modified.

A fresh benchmark on this rebased implementation used `BATCH_REPS=3 BATCH_JOBS=1,4,8 node bench/batch.mjs`, with no concurrent build or test run. Each row is a three-run median on the same two generated document contents (24 copies per format), with CLI/worker startup included. These results are separate from the historical v4.16.0 measurements above.

| Workload | Jobs | Median seconds | Speedup vs sequential | Peak summed RSS (MiB) |
| --- | ---: | ---: | ---: | ---: |
| HWPX | 1 | 8.734 | 1.00× | 384.8 |
| HWPX | 4 | 3.310 | 2.64× | 1,357.2 |
| HWPX | 8 | 2.706 | 3.23× | 1,735.3 |
| PDF | 1 | 4.412 | 1.00× | 217.3 |
| PDF | 4 | 2.266 | 1.95× | 695.8 |
| PDF | 8 | 2.227 | 1.98× | 1,199.9 |

All output hashes matched in this fresh measurement. Eight workers again add little PDF throughput over four while using more memory; the repeated PDF slowdown recorded above remains part of the evidence, rather than being discarded.

An independent review originally reproduced interrupted UUID partial-download accumulation. [Issue #109](https://github.com/chrisryugj/kordoc/issues/109) was resolved separately by #111 in v4.17.2; cleanup keeps active or unverified owners and reclaims files from terminated local owners. The historical measurements above predate that fix.

## Final integration validation, 2026-10-01

The unchanged PR #110 head was applied to v4.17.6 main `714cc88` in an isolated checkout. Type checking, ESM/CJS/declaration builds and bundled CLI jobs-2 smoke passed. With the original corpus linked for read-only tests, the full suite passed 2,899 tests with zero failures and five Linux-only tests skipped on Darwin (2,904 total; the five platform tests pass in Linux CI). This validation precedes the independent writer optimization in v4.18.0.

Actual HWP5, HWPX, PDF and DOCX inputs produced byte-identical Markdown, chunks, images and manifests for sequential and two-worker conversion. In a separate two-PDF raw JSON comparison, four `style.fontName` values differed by process-local PDF.js font IDs. These byte differences were retained; document content and assets matched. This is not a claim of raw JSON byte identity for every PDF.

In a two-worker batch with an actual forced-OCR native ONNX invocation confirmed active and verified offline model files, SIGINT, SIGTERM, parent SIGKILL and worker crash all left zero surviving workers. Output-directory listings remained unchanged over the following 100 ms check. The controller waited for two booted workers and at least one active native call; it did not require both calls to be active before sending the signal. Termination checks completed in 139–249 ms including the 100 ms settled-output check. Sampled active summed RSS was 1.21–1.29 GiB; this is a lifecycle test rather than a throughput benchmark. Windows lifecycle behavior was not measured.

Actual native lifecycle cases and sampled memory are recorded in [the lifecycle report](parallel-batch-native-lifecycle-2026-10-01.json). [v4.18.0](https://github.com/chrisryugj/kordoc/releases/tag/v4.18.0) was published through the normal full gates; the independent public CLI passed two-input JSON parity with jobs 1 and 2. The final suite includes the writer regression: 2,906 passed, zero failed, five Linux-only skips on Darwin.
