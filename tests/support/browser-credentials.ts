// Reserved identities and passwords used ONLY by the disposable browser test DB.
// These are never read by production code or by the real administrator bootstrap.
export const browserAdmin = {
  username: "browser.admin",
  email: "browser-admin@example.test",
  initial: "Isolated-Test-Initial-Password-123!",
  password: "Isolated-Test-Admin-Password-456!",
};
export const browserEmployee = {
  initial: "Isolated-Test-Employee-Initial-123!",
  password: "Isolated-Test-Employee-Changed-456!",
  reset: "Isolated-Test-Employee-Reset-789!",
  final: "Isolated-Test-Employee-Final-321!",
};

export const browserFinance = {
  username: "browser.finance",
  email: "browser-finance@example.test",
  initial: "Isolated-Finance-Initial-Password-123!",
  password: "Isolated-Finance-Changed-Password-456!",
};

export const browserHelp = {
  creator: { username: "browser.help.creator", email: "browser-help-creator@example.test" },
  resolver: { username: "browser.help.resolver", email: "browser-help-resolver@example.test" },
  password: "Isolated-Help-Password-456!",
};
