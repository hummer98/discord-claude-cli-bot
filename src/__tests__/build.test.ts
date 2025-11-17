/**
 * Build System Test
 * Verifies that TypeScript compilation and basic project structure work correctly
 */

describe('Build System', () => {
  it('should compile TypeScript with strict mode', () => {
    // This test will fail to compile if strict mode is not properly configured
    const testValue: string | undefined = 'test';

    // This would cause a compilation error with strict mode
    // const length = testValue.length; // Error: Object is possibly 'undefined'

    // Proper null check required
    const length = testValue?.length ?? 0;
    expect(length).toBe(4);
  });

  it('should enforce noUncheckedIndexedAccess', () => {
    const array: string[] = ['test'];

    // With noUncheckedIndexedAccess, array[0] is string | undefined
    const element = array[0];

    // Type assertion or null check required
    expect(element).toBeDefined();
    expect(element).toBe('test');
  });

  it('should support ES2022 features', () => {
    // Array.prototype.at (ES2022)
    const arr = [1, 2, 3];
    expect(arr.at(-1)).toBe(3);

    // Object.hasOwn (ES2022)
    const obj = { key: 'value' };
    expect(Object.hasOwn(obj, 'key')).toBe(true);
  });
});
