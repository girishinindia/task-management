// lucide-react@0.460 declares a "types" entry (dist/lucide-react.d.ts) that is
// not present in the published package as installed here, so TypeScript reports
// TS7016 ("implicitly has an 'any' type") for every icon import, which fails the
// build under `strict`. This shorthand ambient declaration resolves the module
// so any icon import works and the build stays clean. Adding new icons never
// breaks the build. (Remove this file if a future lucide-react ships its own
// declarations.)
declare module "lucide-react";
