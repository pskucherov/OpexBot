export const debugStart = (name: string) => {
    if (!process.env.DEBUG) {
        return;
    }

    console.log(name, 'START'); // eslint-disable-line no-console
    console.time(name); // eslint-disable-line no-console
};

export const debugEnd = (name: string) => {
    if (!process.env.DEBUG) {
        return;
    }

    console.timeEnd(name); // eslint-disable-line no-console
    console.log(); // eslint-disable-line no-console
};
