/**
 * User settings stored in `chrome.storage.local`.
 * @typedef {{
 *  redmine?: { baseUrl: string, encodedKey: string },
 *  theme?: { isDark: boolean, lineHeight: number },
 *  numberOfDays: number,
 *  workHours: [start: number, end: number],
 *  autoRefresh: string,
 *  skipAnimation: boolean
 * }} Settings
 */

/**
 * Encription/decryption API
 * @typedef {{
 *  encrypt: (value: any) => Uint8Array
 *  decrypt: (nonceAndBox: Uint8Array) => any
 * }} CryptoAPI
 */

/**
 * Redmine API
 * @typedef {{
 *  getEntries: (fromDay: string) => Promise<any[]>,
 *  getProjects: () => Promise<any[]>,
 *  getIssues: (updatedAfter: string) => Promise<any[]>
 *  getActivities: () => Promise<any>,
 *  getUser: () => Promise<Response>,
 *  createEntry: (entry: any) => Promise<Response>,
 *  updateEntry: (entry: any) => Promise<Response>,
 *  deleteEntry: (entry: any) => Promise<Response>
 * }} RedmineAPI
 */

/**
 * Color codes for **dark** and **light** theme.
 * @typedef {{
 *  bg: string,
 *  text: string,
 *  border: string,
 *  danger: string,
 *  success: string,
 *  special: string,
 *  muted: string,
 *  shadow: string,
 *  mark: string,
 *  button: { hover: string, active: string },
 *  badge: { bg: string, text: string },
 *  card: { border: string },
 *  field: { text: string, focus: string },
 *  title: { bg: string, text: string },
 *  select: { bg: string, tape: string }
 * }} Theme
 */