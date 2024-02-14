/**
 * Generate a random integer >= min and < max.
 *
 * @param {number} min Lower bound, inclusive.
 * @param {number} max Upper bound, exclusive.
 * @return {number} The random integers.
 */
export function getRandomInteger(min, max) {
    // Note that we don't reuse the implementation in the more generic
    // `getRandomIntegers()` (plural) below, for performance optimization.
    return Math.floor((max - min) * Math.random()) + min;
}

/**
 * Generate a given number of random integers >= min and < max.
 *
 * @param {number} min Lower bound, inclusive.
 * @param {number} max Upper bound, exclusive.
 * @param {number} numIntegers Number of random integers to get.
 * @return {number[]} The random integers.
 */
export function getRandomIntegers(min, max, numIntegers) {
    const output = [];

    for (let i = 0; i < numIntegers; ++i) {
        output.push(Math.floor((max - min) * Math.random()) + min);
    }

    return output;
}

export function assertPositiveInteger(x, name) {
    if (!Number.isInteger(x)) {
        throw new Error(
        `Expected ${name} to be an integer, but received ${x}`);
    }
    if (!(x > 0)) {
        throw new Error(
        `Expected ${name} to be a positive number, but received ${x}`);
    }
}
