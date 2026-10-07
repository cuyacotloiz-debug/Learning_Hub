import crypto from 'crypto'

export function generateClassroomId(prefix = 'LH', length = 6) {
  // Generate a secure random token encoded in base36 and uppercase it
  // length is number of chars from the base36 string
  const buf = crypto.randomBytes(8).toString('hex')
  const token = parseInt(buf.slice(0, 12), 16).toString(36).slice(0, length).toUpperCase()
  return `${prefix}-${token}`
}
