/** Console messages with a consistent look, plus a list of warnings for the report. */
const warnings: string[] = [];

export const log = {
  step(message: string) {
    console.log(`\n▸ ${message}`);
  },
  info(message: string) {
    console.log(`  ${message}`);
  },
  warn(message: string) {
    warnings.push(message);
    console.warn(`  ⚠ ${message}`);
  },
  warnings(): readonly string[] {
    return warnings;
  },
};
