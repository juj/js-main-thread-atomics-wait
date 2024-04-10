# js-main-thread-atomics-wait

This repository implements a proof of concept polyfill that enables (emulates) `Atomics.wait()` to be used on the main thread, without `TypeError: Atomics.wait cannot be called in this context`.

# ... but why?

When SharedArrayBuffer was standardized, the "asynchronous programming manifesto" or "don't block the main thread" dogma was applied to the `Atomics.wait()` function, to ensure that JS developers would not write code that would result in unresponsive web sites in the wild.

However, as use of SharedArrayBuffer and multithreaded WebAssembly have grown, developers have come to the realization that there are use cases where the **best practices** code patterns do require synchronously blocking the main thread. A couple of examples follow.

## Case 1: Inefficient barrier synchronization

A simple example is a *parallel for() loop* code pattern. In this pattern, a developer typically creates a pool of background Workers that is sized to saturate the number of logical cores on the system. Then, both throughput and latency performance is maximized by synchronously slicing the work data set across all cores on the system (as opposed to running the loop single-threaded). Finally, [a thread barrier synchronization primitive](https://en.wikipedia.org/wiki/Barrier_(computer_science)) is used to join all the threads to form the results of the computation.

The main thread typically partakes in this parallel for() computation as one of the workers (since doing otherwise would waste energy due to not main thread needing to busy-spin for the result), but the problem here is that the main thread is not able to correctly pause on the sync barrier along with the rest of the threads. It must busy spin, which wastes energy.

If the work set size is homogeneous and predictable, the wasted CPU usage is generally minimal, since all threads are expected to finish about the same time. However, if the work set size is complex to predict or dynamic (such as for example in multithreaded scene traversal for rendering/culling, or [garbage collection](https://github.com/juj/emgc)) so it might become lopsided in the worst case, there may be a measurable amount of wasted CPU work caused by the busy spinning main thread.

Finally, application development is complicated by the fact that developers will need to implement heterogeneous synchronization code (for the worker vs the main thread cases) so it works across all threads.

Principled defenders of the "asynchronous computing only" paradigm might suggest that such parallel-for workloads should be run asynchronously with respect to the main thread. However this suggestion does not realize that not every problem domain makes sense to asynchronify. For example, when rendering 3D scenes in interactive applications, work dispatch is by definition synchronous, or otherwise the `requestAnimationFrame()` paradigm would fall apart. Also, e.g. in programming languages that implement support for [OpenMP parallel for](https://learn.microsoft.com/en-us/cpp/parallel/openmp/reference/openmp-directives?view=msvc-170#parallel) constructs, recasting every such for loop into asynchronous continuations would not be feasible.

## Case 2: Inefficient mutex synchronization

When implementing certain multithreaded programming algorithms, such as a multithreaded memory allocator (e.g. `malloc()` + `free()`), code from different threads (both main and workers) may need to enter to execute short critical sections of code to mutate a shared data structures.

No matter how short or quick these types of critical sections might execute, if the update operation on the structure has a form that does not admit a lock-free construct, a mutex will be needed.

However, since the main browser thread does not support atomic waiting, it is not possible to implement a mutex in the straightforward manner. Instead, the implementation of a mutex will need to contain a special spin-waiting path for the main thread, and the general sleep path will then only be available for the worker threads. This kind of dual futex wait implementation is prone to bugs, wastes CPU energy and prevents the browser developer/debugging tools from providing a great profiling and debugging experience in the form of the browser being aware that the main thread is waiting for a critical section.

In many cases, the program developer will (and should be trusted to) have a good understanding of the workload that they provide. For example in the case of a multithreaded memory allocator, the critical section may consist of a constant (fixed) length of code that is only a handful of instructions long in the common case, but then in a very rare case , a larger block of work inside the critical section might be needed. (For example when running out of WebAssembly memory, resulting in a [memory grow operation](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Memory/grow))

In such scenarios, it is clear to the developer that the desired multithreading pattern will not cause problems with the responsiveness of the site, and there is no way to use Atomics.waitAsync() in such use case (it is not possible to break every `malloc()` call in a C-like program code into an asynchronous continuation).

So the best remedy today is to make the main browser thread to spinwait for the lock.

# Introduction

This repository polyfills `Atomics.wait()` function to work on the main thread as well. This enables developers to write uniform synchronization code across all threads. This repository does not fix the CPU burn problem that the lack of true Atomic wait on the main thread has, but it does help with the heterogeneous synchronization problem. Simplifying codebases with a single uniform atomic wait construct on all threads has the possibility to reduce surface area for complex synchronization related bugs.

# Usage

1. In the main HTML, add an element `<script src='main-thread-atomics-wait.js'></script>` before performing launching any `Worker`s or performing any `Atomics.wait()`ing on the main thread to include the JS polyfill in the context of the main thread.

2. In each JS Worker, execute `importScripts('worker-atomics-wait.js');` at the start of the Worker scope to include the JS polyfill in the context of each Worker.

# TODOs

Extend this support also to Audio Worklets.