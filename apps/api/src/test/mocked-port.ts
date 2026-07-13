/**
 * Builds a fully-mocked shape of a port (or any interface) for unit tests.
 *
 * Deliberately not `jest.Mocked<T>`: mapped types turn the abstract class's
 * method signatures into plain function-typed properties, which keeps
 * `@typescript-eslint/unbound-method` from flagging `expect(mock.method)...`
 * assertions as an unsafe unbound method reference.
 */
export type MockedPort<T> = {
  [K in keyof T]: jest.Mock;
};
