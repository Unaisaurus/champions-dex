/// <reference types="vite/client" />

/** The app version from package.json, filled in by Vite. */
declare const __APP_VERSION__: string;

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
