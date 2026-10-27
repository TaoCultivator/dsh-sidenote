/**
 * The annotation store: per-session numbered selection annotations. Pure
 * (DOM-free, React-free) so the whole lifecycle is unit-testable. One instance
 * per plugin activation.
 *
 * Numbering（2026-10-14 用户裁定 · 按轮重置）: 展示号 = **本轮待发送批次内的
 * 序号**。一批 = 上一次发送完成到下一次发送之间的全部 active 注释；批内新增从
 * 1 递增、删除后重排为连续的 1..n，因此同一会话里第二轮批注重新从 1 开始，不再
 * 跨轮累加（旧行为 = per-session 单调计数器，永不重置）。
 * 发送时编号随该批冻结：sent 保留发送当时的号、永不重排，保证已发出消息的
 * 角标 / wire `<annotation id>` / 气泡留痕三者编号一致。
 *
 * State machine per annotation: 'active' (counts in the composer chip, rides
 * the next message via the send interceptor) → 'sent' (the message it was
 * attached to went out; badge turns gray/read-only, chip no longer counts it).
 *
 * 持久化（Delivery_02 起）：每次 mutation 后按会话写 localStorage
 * （`dsh-sidenote:annotations:v1:<sessionId>`），刷新/切会话后重建；
 * 会话清空时删键。storage 不可用（测试/隐私模式）时退化为纯内存。
 */
export interface Annotation {
  /** Store-unique identity (monotonic across sessions). */
  readonly id: number
  /** 本轮待发送批次内的展示号（1..n）；发送时随该批冻结，sent 后永不重排。 */
  readonly number: number
  readonly sessionId: string
  /** Source is independent of the send target. Missing fields revive legacy main quotes. */
  readonly sourceSessionId?: string
  readonly sourceSurface?: 'main' | 'side'
  /** `data-chat-anchor-key` of the owning message (re-anchor key). */
  readonly anchorKey: string | undefined
  /** Full human-selected quote; chip truncation is visual only. */
  readonly text: string
  /** Full selection text (re-anchor needle; untruncated). */
  readonly anchorText: string
  /** 0-based ordinal of the quote's occurrence inside the anchor element. */
  readonly occurrence: number
  /** User-written note; '' means 纯引用. */
  readonly note: string
  readonly state: 'active' | 'sent'
  readonly createdAt: number
}

export interface AnnotationDraft {
  readonly sessionId: string
  readonly sourceSessionId?: string
  readonly sourceSurface?: 'main' | 'side'
  readonly anchorKey: string | undefined
  readonly text: string
  readonly anchorText: string
  readonly occurrence: number
  readonly note: string
}

export interface AnnotationStore {
  /** Monotonic version, referentially stable between mutations (uSES-ready). */
  getSnapshot(): number
  /** Memory contents remain usable after storage access/quota failures. */
  getStorageStatus(sessionId?: string): 'persistent' | 'memory'
  getSubmission(sessionId: string): { readonly pending: boolean; readonly error?: string }
  setSubmission(sessionId: string, state: { pending: boolean; error?: string }): void
  subscribe(fn: () => void): () => void
  /** Create an active annotation; returns it (id/number assigned). */
  add(draft: AnnotationDraft): Annotation
  setNote(id: number, note: string): void
  remove(id: number): void
  /** 把指定 id 的 active 注释翻为 'sent'（发送拦截器只翻当时拼进消息的
   *  那批——窗口内新增的注释不得误标，C2 P1-3）。 */
  markSent(ids: readonly number[]): void
  get(id: number): Annotation | undefined
  /** All annotations of a session in creation order (active + sent). */
  list(sessionId: string): readonly Annotation[]
  listActive(sessionId: string): readonly Annotation[]
  countActive(sessionId: string): number
  /** Sessions currently holding any annotation (draft-sync fan-out). */
  sessions(): readonly string[]
}

/** localStorage 键前缀（按会话分键）。 */
export const STORAGE_PREFIX = 'dsh-sidenote:annotations:v1:'

/** 持久化条目的宽松校验（字段缺失/类型漂移 → 丢弃该条，不抛错）。 */
function reviveStored(value: unknown): Annotation | null {
  if (typeof value !== 'object' || value === null) return null
  const a = value as Record<string, unknown>
  if (typeof a.id !== 'number' || typeof a.number !== 'number') return null
  if (typeof a.sessionId !== 'string' || a.sessionId === '') return null
  if (typeof a.text !== 'string' || typeof a.anchorText !== 'string') return null
  if (typeof a.occurrence !== 'number') return null
  if (a.state !== 'active' && a.state !== 'sent') return null
  return {
    id: a.id,
    number: a.number,
    sessionId: a.sessionId,
    sourceSessionId: typeof a.sourceSessionId === 'string' && a.sourceSessionId !== '' ? a.sourceSessionId : undefined,
    sourceSurface: a.sourceSurface === 'main' || a.sourceSurface === 'side' ? a.sourceSurface : undefined,
    anchorKey: typeof a.anchorKey === 'string' && a.anchorKey !== '' ? a.anchorKey : undefined,
    text: a.text,
    anchorText: a.anchorText,
    occurrence: a.occurrence,
    note: typeof a.note === 'string' ? a.note : '',
    state: a.state,
    createdAt: typeof a.createdAt === 'number' ? a.createdAt : 0,
  }
}

export function createAnnotationStore(
  now: () => number = () => Date.now(),
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'> | null,
): AnnotationStore {
  let annotations: Annotation[] = []
  let nextId = 1
  let version = 0
  /** 把某会话的 active 注释按创建顺序压成 1..n（sent 冻结不动）；返回是否改动。 */
  const renumberActive = (sessionId: string): boolean => {
    let changed = false
    let next = 0
    annotations = annotations.map(a => {
      if (a.sessionId !== sessionId || a.state !== 'active') return a
      next += 1
      if (a.number === next) return a
      changed = true
      return { ...a, number: next }
    })
    return changed
  }
  const listeners = new Set<() => void>()
  const submissions = new Map<string, { pending: boolean; error?: string }>()
  const idleSubmission = { pending: false }

  // localStorage 默认取全局（浏览器环境）；显式传 null = 纯内存（测试）。
  let store = storage ?? null
  if (storage === undefined) {
    try { store = globalThis.localStorage ?? null } catch { store = null }
  }
  let storageStatus: 'persistent' | 'memory' = store === null ? 'memory' : 'persistent'
  const failedStorageSessions = new Set<string>()
  let hydrationFailed = false

  // ── 启动水合：扫描前缀键，容错 revive（编号在收尾统一压成批内 1..n） ──
  if (store != null) {
    try {
      const keys: string[] = []
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i)
        if (typeof key === 'string' && key.startsWith(STORAGE_PREFIX)) keys.push(key)
      }
      for (const key of keys) {
        const raw = store.getItem(key)
        if (raw === null) continue
        let parsed: unknown
        try { parsed = JSON.parse(raw) } catch {
          console.warn('[dsh-sidenote] 跳过损坏的注释记录:', key)
          continue
        }
        if (!Array.isArray(parsed)) continue
        for (const item of parsed) {
          const revived = reviveStored(item)
          if (revived === null) continue
          annotations.push(revived)
          nextId = Math.max(nextId, revived.id + 1)
        }
      }
    } catch (error) {
      hydrationFailed = true
      storageStatus = 'memory'
      console.warn('[dsh-sidenote] 注释持久化读取失败（按空起步）:', error)
    }
  }

  /** 把一个会话的注释写回 localStorage（空则删键）。 */
  const persistSession = (sessionId: string): void => {
    if (store == null) return
    try {
      const items = annotations.filter(a => a.sessionId === sessionId)
      const key = STORAGE_PREFIX + sessionId
      if (items.length === 0) store.removeItem(key)
      else store.setItem(key, JSON.stringify(items))
      failedStorageSessions.delete(sessionId)
      storageStatus = hydrationFailed || failedStorageSessions.size > 0 ? 'memory' : 'persistent'
    } catch (error) {
      failedStorageSessions.add(sessionId)
      storageStatus = 'memory'
      console.warn('[dsh-sidenote] 注释持久化写入失败:', error)
    }
  }

  /** mutation 后落盘：受影响会话可能不止一个（markSessionSent 单会话）。 */
  const persistTouched = (touched: readonly string[]): void => {
    for (const sessionId of new Set(touched)) persistSession(sessionId)
  }

  // ── 水合收尾：旧版本按会话累加出来的 active 号，在此一次性迁移为批内 1..n ──
  if (annotations.length > 0) {
    const migrated: string[] = []
    for (const sessionId of new Set(annotations.map(a => a.sessionId))) {
      if (renumberActive(sessionId)) migrated.push(sessionId)
    }
    if (migrated.length > 0) persistTouched(migrated)
  }

  const notify = (): void => {
    version += 1
    for (const fn of [...listeners]) fn()
  }

  /** 该会话尚未发送（active）的注释数 = 当前批次的下一号 - 1。 */
  const countActiveIn = (sessionId: string): number =>
    annotations.reduce((n, a) => n + (a.sessionId === sessionId && a.state === 'active' ? 1 : 0), 0)

  const replace = (id: number, patch: Partial<Annotation>): void => {
    const target = annotations.find(a => a.id === id)
    annotations = annotations.map(a => (a.id === id ? { ...a, ...patch } : a))
    if (target !== undefined) persistTouched([target.sessionId])
    notify()
  }

  return {
    getSnapshot: () => version,
    getStorageStatus: sessionId => sessionId === undefined || hydrationFailed || store === null
      ? storageStatus : failedStorageSessions.has(sessionId) ? 'memory' : 'persistent',
    getSubmission: sessionId => submissions.get(sessionId) ?? idleSubmission,
    setSubmission(sessionId, state) { submissions.set(sessionId, state); notify() },
    subscribe(fn: () => void): () => void {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
    add(draft: AnnotationDraft): Annotation {
      // 批内序号 = 本轮还没发出去的注释数 + 1。发送后本批冻结，下一轮自然从 1 起。
      const number = countActiveIn(draft.sessionId) + 1
      const annotation: Annotation = {
        id: nextId,
        number,
        sessionId: draft.sessionId,
        sourceSessionId: draft.sourceSessionId,
        sourceSurface: draft.sourceSurface,
        anchorKey: draft.anchorKey,
        text: draft.text,
        anchorText: draft.anchorText,
        occurrence: draft.occurrence,
        note: draft.note,
        state: 'active',
        createdAt: now(),
      }
      nextId += 1
      annotations = [...annotations, annotation]
      renumberActive(draft.sessionId)
      persistTouched([draft.sessionId])
      notify()
      return annotation
    },
    setNote(id: number, note: string): void {
      if (!annotations.some(a => a.id === id)) return
      replace(id, { note })
    },
    remove(id: number): void {
      const target = annotations.find(a => a.id === id)
      if (target === undefined) return
      annotations = annotations.filter(a => a.id !== id)
      // 未发送的批次删除后重排（连续的 1..n）；已发送的号冻结、不参与重排。
      if (target.state === 'active') renumberActive(target.sessionId)
      persistTouched([target.sessionId])
      notify()
    },
    markSent(ids: readonly number[]): void {
      if (ids.length === 0) return
      const idSet = new Set(ids)
      if (!annotations.some(a => idSet.has(a.id) && a.state === 'active')) return
      const touched = new Set<string>()
      annotations = annotations.map(a => {
        if (!idSet.has(a.id) || a.state !== 'active') return a
        touched.add(a.sessionId)
        return { ...a, state: 'sent' }
      })
      // 本批已发出即结束：批内残留（发送窗口内新增、未拼进本次消息的 active）
      // 属于下一批，编号重新从 1 起排。
      for (const sessionId of touched) renumberActive(sessionId)
      persistTouched([...touched])
      notify()
    },
    get(id: number): Annotation | undefined {
      return annotations.find(a => a.id === id)
    },
    list(sessionId: string): readonly Annotation[] {
      return annotations.filter(a => a.sessionId === sessionId)
    },
    listActive(sessionId: string): readonly Annotation[] {
      return annotations.filter(a => a.sessionId === sessionId && a.state === 'active')
    },
    countActive(sessionId: string): number {
      return countActiveIn(sessionId)
    },
    sessions(): readonly string[] {
      return [...new Set(annotations.map(a => a.sessionId))]
    },
  }
}
