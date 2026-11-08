export class DataError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'DataError';
    this.kind = kind; // missing | empty | invalid | shape | skipped | network
  }
}
