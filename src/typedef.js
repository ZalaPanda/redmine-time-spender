/**
 * User settings stored in `chrome.storage.local`.
 * @typedef {{
 *  redmine?: { baseUrl: string, encodedKey: string },
 *  theme?: { isDark: boolean, lineHeight: number },
 *  numberOfDays: number,
 *  workHours: [start: number, end: number],
 *  skipAnimation: boolean
 * }} Settings
 */
/**
 * Color codes for **dark** and **light** theme.
 * @typedef {{
 *  bg: string
 * }} Theme
 */