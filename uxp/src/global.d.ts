// UXP injects require() as a global even in ES module context.
// Used to access UXP-native modules like "premierepro" that are not ES modules.
declare function require<T = unknown>(module: string): T;
