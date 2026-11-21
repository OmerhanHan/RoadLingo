/**
 * Client-side record of which content-bank items this user has already seen,
 * so the server serves new ones first (kept in localStorage, newest last).
 */
const MAX_IDS = 400
const key = (task: string) => `roadlingo_seen_${task}`

function read(task: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(task)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Query-string fragment ("&seen=a,b,c") to append to a content request. */
export function seenParam(task: string): string {
  const ids = read(task)
  return ids.length ? `&seen=${ids.join(',')}` : ''
}

export function markSeen(task: string, id: string | undefined) {
  if (!id) return
  try {
    const ids = read(task).filter((x) => x !== id)
    ids.push(id)
    localStorage.setItem(key(task), JSON.stringify(ids.slice(-MAX_IDS)))
  } catch {
    /* storage unavailable: content may repeat, nothing else breaks */
  }
}
