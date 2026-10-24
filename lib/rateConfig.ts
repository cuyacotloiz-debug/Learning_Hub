// Centralized rate limit configuration. Values can be tuned via env vars.
export const RATE_CONFIG = {
  loginIp: { limit: Number(process.env.RATE_LOGIN_IP_LIMIT ?? 20), windowMs: Number(process.env.RATE_LOGIN_IP_WINDOW_MS ?? 60 * 60 * 1000) },
  loginEmail: { limit: Number(process.env.RATE_LOGIN_EMAIL_LIMIT ?? 10), windowMs: Number(process.env.RATE_LOGIN_EMAIL_WINDOW_MS ?? 60 * 60 * 1000) },
  registerIp: { limit: Number(process.env.RATE_REGISTER_IP_LIMIT ?? 5), windowMs: Number(process.env.RATE_REGISTER_IP_WINDOW_MS ?? 60 * 60 * 1000) },
  registerEmail: { limit: Number(process.env.RATE_REGISTER_EMAIL_LIMIT ?? 5), windowMs: Number(process.env.RATE_REGISTER_EMAIL_WINDOW_MS ?? 60 * 60 * 1000) },
  refreshIp: { limit: Number(process.env.RATE_REFRESH_IP_LIMIT ?? 60), windowMs: Number(process.env.RATE_REFRESH_IP_WINDOW_MS ?? 60 * 60 * 1000) },
  refreshUser: { limit: Number(process.env.RATE_REFRESH_USER_LIMIT ?? 100), windowMs: Number(process.env.RATE_REFRESH_USER_WINDOW_MS ?? 60 * 60 * 1000) },
  logoutIp: { limit: Number(process.env.RATE_LOGOUT_IP_LIMIT ?? 30), windowMs: Number(process.env.RATE_LOGOUT_IP_WINDOW_MS ?? 60 * 60 * 1000) },
  logoutUser: { limit: Number(process.env.RATE_LOGOUT_USER_LIMIT ?? 30), windowMs: Number(process.env.RATE_LOGOUT_USER_WINDOW_MS ?? 60 * 60 * 1000) },
  createClassroomIp: { limit: Number(process.env.RATE_CREATE_CLASSROOM_IP_LIMIT ?? 10), windowMs: Number(process.env.RATE_CREATE_CLASSROOM_IP_WINDOW_MS ?? 60_000) },
  joinClassroomIp: { limit: Number(process.env.RATE_JOIN_CLASSROOM_IP_LIMIT ?? 30), windowMs: Number(process.env.RATE_JOIN_CLASSROOM_IP_WINDOW_MS ?? 60_000) },
  classroomMessageIp: { limit: Number(process.env.RATE_CLASSROOM_MESSAGE_IP_LIMIT ?? 30), windowMs: Number(process.env.RATE_CLASSROOM_MESSAGE_IP_WINDOW_MS ?? 60_000) },
}
