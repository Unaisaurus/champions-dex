/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** The app version from package.json, filled in by Vite. */
declare const __APP_VERSION__: string;
/** `owner/name` of the project on GitHub, where problem reports go. */
declare const __REPOSITORY__: string;
/** The commit this build was made from (short), or '' outside GitHub's builds. */
declare const __APP_BUILD__: string;

declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
