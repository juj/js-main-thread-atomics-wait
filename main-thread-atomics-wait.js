Atomics.__orig_wait = Atomics.wait;
let __waitBuffer = new Int32Array(new SharedArrayBuffer(4));

Atomics.wait = (typedArray, index, value, timeout) => {
  if (timeout <= 0) return 'timed-out';
  if (Atomics.load(typedArray, index) != value) return 'not-equal';
  Atomics.store(__waitBuffer, 0, index);
  let end = timeout < Infinity ? performance.now() + timeout : Infinity;
  while (__waitBuffer[0] == index) {
    if (performance.now() > end) {
      return Atomics.compareExchange(__waitBuffer, 0, index, -1) != index ? 'ok' : 'timed-out';
    }
  }
  return 'ok';
};

let __orig_Worker = Worker;
class __new_Worker extends __orig_Worker {
  constructor(url) {
    super(url);
    console.log('Worker ctor');
    this.postMessage({ __waitBuffer: __waitBuffer });
  }
}
Worker = __new_Worker;
window.sleep = function(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};
