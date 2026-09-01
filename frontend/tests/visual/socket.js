export default function openSocket() {
  return {
    on() {
      return this;
    },
    emit() {
      return this;
    },
    disconnect() {}
  };
}
