importScripts('worker-atomics-wait.js');

onmessage = (e) => {
  console.log('Msg');
  console.dir(e);
  if (e.data instanceof Int32Array) {
    console.log('Got data');
    sab = e.data;
    console.log(`Worker: Atomic wait, value: ${sab[0]}`);
    Atomics.wait(sab, 0, 0);
    console.log(`Worker: Atomic wait finished, value: ${sab[0]}`);

    setTimeout(() => {
      console.log('Worker: Waking Main');
      Atomics.store(sab, 0, 2);
      Atomics.notify(sab, 0, 1);
      console.log('Worker: Main awoken');
    }, 1000);
  }
}
