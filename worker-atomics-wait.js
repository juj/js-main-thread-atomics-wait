let __waitBuffer = null;

Atomics.__original_notify = Atomics.notify;
Atomics.notify = (typedArray, index, count) => {
  if (count <= 0) return 0;
  if (Atomics.compareExchange(__waitBuffer, 0, index, -1) == index) {
    if (count <= 1) return 1;
    return 1 + Atomics.__original_notify(typedArray, index, count-1);
  }
  return Atomics.__original_notify(typedArray, index, count);
};

addEventListener('message', e => {
  if (e.data?.__waitBuffer) __waitBuffer = e.data?.__waitBuffer;
});
