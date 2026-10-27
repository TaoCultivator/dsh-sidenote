window.__ModuleLoader__.load({
	id: "dsh-sidenote",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		_deepseek_ai_dsh_client_ui_primitives = __toESM(_deepseek_ai_dsh_client_ui_primitives, 1);
		let react_dom_client = require("react-dom/client");
		let react_dom = require("react-dom");
		//#region src/client/host/currentSession.ts
		/**
		* 当前（在屏）会话 id 的双版本探测：0.1.5 的 SessionListState 带 `current`
		* 字段；0.1.7 移除了它（列表只剩 ids/byId/phase），改为会话视图 DOM 的
		* `[data-conversation-session]` 属性携带。两源皆空 → ''（调用方按既有
		* 降级语义处理：守卫拒绝、工具条不弹、按钮不渲染）。
		*/
		function currentSessionIdOf(ctx) {
			try {
				const current = ctx.sessions.list.getSnapshot().current;
				if (typeof current === "string" && current !== "") return current;
			} catch {}
			if (typeof document === "undefined") return "";
			return document.querySelector("[data-conversation-session]")?.dataset.conversationSession ?? "";
		}
		//#endregion
		//#region src/client/host/input.ts
		/** One resolver for both composers; scope fixes the recipient before any async work. */
		function resolveInput(ctx, sessionId) {
			return probeInput(ctx, sessionId).input;
		}
		/** Shape and real state read share the exact resolver used by both composers. */
		function probeInput(ctx, sessionId) {
			const path = "sessions.scope → conversation.input.for";
			try {
				if (sessionId === "") return {
					state: "unready",
					reason: "waitSession",
					path
				};
				const scope = ctx.sessions.scope(sessionId);
				if (scope === void 0) return {
					state: "unready",
					reason: "waitSession",
					path
				};
				const service = ctx.get("conversation");
				if (service == null) return {
					state: "unready",
					reason: "waitService",
					path
				};
				if (typeof service.input?.for !== "function") return {
					state: "unavailable",
					reason: "unsupported",
					path
				};
				const input = service?.input.for(scope);
				if (input === void 0 || input === null) return {
					state: "unready",
					reason: "waitInput",
					path
				};
				if (typeof input?.setDraft !== "function" || typeof input.submit !== "function" || typeof input.state?.getSnapshot !== "function" || typeof input.state.subscribe !== "function") return {
					state: "unavailable",
					reason: "unsupported",
					path
				};
				if (typeof input.state.getSnapshot()?.draft !== "string") return {
					state: "unavailable",
					reason: "unsupported",
					path
				};
				return {
					state: "available",
					reason: "ready",
					path,
					input
				};
			} catch {
				return {
					state: "unknown",
					reason: "readFailed",
					path
				};
			}
		}
		function readInputDraft(input) {
			const draft = input.state.getSnapshot().draft;
			return typeof draft === "string" ? draft : "";
		}
		function inputAttachmentIds(input) {
			const state = input.state.getSnapshot();
			return state.attachmentIds ?? state.imageIds ?? [];
		}
		/** setDraft on Lexical hosts rebuilds plain paragraphs and loses reference nodes.
		* The scoped insertText application verb keeps those nodes and uses revision CAS. */
		function prependInputText(input, prefix) {
			if (prefix === "") return true;
			const state = input.state.getSnapshot();
			const draft = state.draft;
			if (state.phase !== "plain") return false;
			if (typeof input.insertText === "function" && typeof state.draftRev === "number") return input.insertText(prefix, {
				start: 0,
				end: 0,
				draftRev: state.draftRev
			}) && readInputDraft(input) === prefix + draft;
			if ((state.occurrences?.length ?? 0) > 0) return false;
			input.setDraft(prefix + draft);
			return readInputDraft(input) === prefix + draft;
		}
		/** Remove only this transaction's prefix; never overwrite subsequent user text. */
		function stripInputPrefix(input, prefix) {
			if (prefix === "") return true;
			const state = input.state.getSnapshot();
			if (!state.draft.startsWith(prefix) || state.phase !== "plain") return false;
			if (typeof input.insertText === "function" && typeof state.draftRev === "number") return input.insertText("", {
				start: 0,
				end: prefix.length,
				draftRev: state.draftRev
			});
			if ((state.occurrences?.length ?? 0) > 0) return false;
			input.setDraft(state.draft.slice(prefix.length));
			return true;
		}
		const pendingRollbacks = /* @__PURE__ */ new WeakMap();
		function cancelInputRollback(input) {
			pendingRollbacks.get(input)?.();
		}
		/** Detached native sends can restore their draft after promptError is published.
		* Watch that restoration once; a retry cancels this watch before adding its prefix. */
		function rollbackInputPrefix(input, prefix) {
			if (prefix === "") return;
			cancelInputRollback(input);
			let unsubscribe = () => {};
			let timer;
			const dispose = () => {
				unsubscribe();
				if (timer !== void 0) clearTimeout(timer);
				if (pendingRollbacks.get(input) === dispose) pendingRollbacks.delete(input);
			};
			const check = () => {
				if (stripInputPrefix(input, prefix)) dispose();
			};
			pendingRollbacks.set(input, dispose);
			unsubscribe = input.state.subscribe(check);
			timer = setTimeout(dispose, 15e3);
			check();
		}
		//#endregion
		//#region src/client/host/chat.ts
		/** Native root status includes approvals and questions, independently of running. */
		function sessionStatusSource(ctx) {
			return ctx.get("uiSession")?.sessionStatus;
		}
		function completedReplySeqsOf(state) {
			const result = [];
			for (const turn of state.timeline.turnOrder) {
				if (state.timeline.turns.get(turn)?.end?.data.reason.kind !== "completed") continue;
				for (const key of [...state.locations.getTurn(turn)].reverse()) {
					const node = state.nodes.get(key);
					if (node?.kind !== "assistant-step") continue;
					const data = node.data;
					if (data.status === "settled" && data.finalNode && data.blocks?.some((block) => block.kind === "text" && block.text?.trim()) && !data.blocks.some((block) => block.kind === "tool-call")) result.push(data.finalNode.seq);
					break;
				}
			}
			return result;
		}
		function chatSourceOf(ctx, binding) {
			const session = binding?.session;
			if (session === void 0) return void 0;
			try {
				const target = ctx.get("uiConversation")?.binding?.(binding)?.target?.("chat");
				if (typeof target?.getSnapshot === "function" && typeof target.subscribe === "function") return {
					subscribe: (fn) => target.subscribe(fn),
					getLegacy: () => target.getSnapshot()?.legacy ?? null,
					getCompletedReplySeqs: () => completedReplySeqsOf(target.getSnapshot()),
					getLastTurnEnd: () => {
						const timeline = target.getSnapshot().timeline;
						if (!timeline) return void 0;
						for (let index = timeline.turnOrder.length - 1; index >= 0; index--) {
							const end = timeline.turns.get(timeline.turnOrder[index])?.end;
							if (end) return {
								seq: end.seq,
								reason: end.data.reason.kind
							};
						}
					}
				};
			} catch {}
			const snap = session.getSnapshot();
			return Array.isArray(snap?.nodes) ? {
				subscribe: (fn) => session.subscribe(fn),
				getLegacy: () => session.getSnapshot()
			} : void 0;
		}
		/** Retain the exact target generation on hosts that expose session ownership. */
		function retainSession(ctx, sessionId, signal) {
			return ctx.sessions.retain?.(sessionId, {
				source: "dsh-sidenote",
				...signal === void 0 ? {} : { signal }
			});
		}
		//#endregion
		//#region src/client/host/dom.ts
		/** Internal conversation DOM seams, validated by the pinned host journeys.
		* Main message markers and composer seats have no public replacement API. */
		const MAIN_ASSISTANT = "[data-chat-flow-kind=\"assistant-step\"]";
		const NON_QUOTE = "button, [role=\"button\"], input, textarea, select, [contenteditable=\"true\"], [data-code-block-banner], [data-variant=\"think\"], [data-sidenote-no-quote]";
		function nativeAssistantBodies(root = document) {
			return [...root.querySelectorAll(MAIN_ASSISTANT)];
		}
		function elementOf(node) {
			return node instanceof Element ? node : node.parentElement;
		}
		function mainMessageOf(node, currentSessionId) {
			const body = elementOf(node)?.closest(MAIN_ASSISTANT);
			if (body === void 0 || body === null) return null;
			const conversation = body.closest("[data-conversation-session]");
			const sessionId = conversation?.dataset.conversationSession ?? currentSessionId;
			if (sessionId === "") return null;
			const anchor = body.closest("[data-chat-anchor-key]") ?? body;
			return {
				body,
				view: conversation ?? document.body,
				anchor,
				key: anchor.dataset.chatAnchorKey,
				sessionId,
				surface: "main",
				streaming: body.hasAttribute("data-streaming") || body.querySelector("[data-streaming]") !== null
			};
		}
		function mainAnchorBodies(sessionId, anchorKey, currentSessionId) {
			return [...document.querySelectorAll(MAIN_ASSISTANT)].filter((body) => {
				const source = mainMessageOf(body, currentSessionId);
				return source?.sessionId === sessionId && source.key === anchorKey && body.closest("[data-dsh-better-sidebar], [data-sidenote-chat-session]") === null;
			});
		}
		/** Intersect every clipping ancestor, then exclude this view's composer. */
		function quoteClipOf(body, view) {
			let clip = {
				left: 0,
				top: 0,
				right: window.innerWidth,
				bottom: window.innerHeight
			};
			for (let parent = body.parentElement; parent !== null; parent = parent.parentElement) {
				const style = getComputedStyle(parent);
				const rect = parent.getBoundingClientRect();
				if (parent === view || /auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) {
					if (rect.width > 0 && rect.height > 0) clip = {
						left: Math.max(clip.left, rect.left),
						top: Math.max(clip.top, rect.top),
						right: Math.min(clip.right, rect.right),
						bottom: Math.min(clip.bottom, rect.bottom)
					};
				}
			}
			const composer = view.querySelector("[data-composer-seat], [data-sidenote-composer]")?.getBoundingClientRect();
			if (composer !== void 0 && composer.width > 0 && composer.left < clip.right && composer.right > clip.left) clip.bottom = Math.min(clip.bottom, composer.top);
			return clip;
		}
		function focusMainComposer(view) {
			[...view.querySelectorAll("[data-composer-seat] [data-composer-input], [data-composer-seat] textarea")].find((input) => input.closest("[data-sidenote-chat-session]") === null)?.focus();
		}
		function focusSideComposer(view) {
			view.querySelector("[data-composer-input], textarea")?.focus();
		}
		/** 主 composer 的宿主容器（侧边面板 textarea 不在其中，天然不串）。 */
		function composerSeat() {
			return document.querySelector("[data-composer-seat]");
		}
		/** 发送按钮 = [data-composer-card] 内 DOM 序最后一个 button（仅 click 路径用，
		*  且只在非运行态作为识别面——运行态主按钮变身「停止」，整个 click 路径不拦）。 */
		function findSendButtonInCard(root = document) {
			const card = root.querySelector("[data-composer-card]");
			if (card === null) return null;
			const buttons = card.querySelectorAll("button:not([data-sidenote-submit])");
			const last = buttons[buttons.length - 1];
			return last instanceof HTMLButtonElement ? last : null;
		}
		/** Bound message hover details to their native conversation pane. */
		function conversationViewOf(node) {
			return node.closest("[data-conversation-session], [data-sidenote-chat-session]") ?? document.body;
		}
		/** Find the last rendered member of an explicit history range, not the side-chat tail. */
		function lastConversationEntry(root, keys) {
			return [...root.querySelectorAll("[data-chat-flow-key]")].reverse().find((row) => keys.has(row.dataset.chatFlowKey ?? "") && row.getBoundingClientRect().height > 0);
		}
		/** Land above the native composer, without scrolling another pane or moving focus. */
		function revealConversationEntryEnd(row) {
			const scroller = row.closest("[data-conversation-scroll]");
			if (!scroller) return;
			const clip = quoteClipOf(row, conversationViewOf(row));
			scroller.scrollTop += row.getBoundingClientRect().bottom - clip.bottom + 12;
		}
		function hasConversationMessages() {
			return document.querySelector("[data-chat-flow-kind]") !== null;
		}
		/** 0.2.0 has no UserText extension. Only add our own portal seat; never move
		* or replace host-owned children. The CSS-module suffix is checked by E2E. */
		function mountUserBubbleAddon(root, addon) {
			root.querySelector("[class$=\"_bubble\"]")?.prepend(addon);
			return () => {
				addon.remove();
			};
		}
		//#endregion
		//#region src/client/host/sidebar.ts
		/** better-sidebar version that moved the right column to DSH's native sidebar. */
		const NATIVE_SIDEBAR_MINOR = 19;
		let root;
		/** Remember the plugin root context at activation (see module docstring). */
		function setRootContext(ctx) {
			root = ctx;
		}
		/** Plugin root context; falls back to the caller's context (legacy behaviour). */
		function rootContext(fallback) {
			return root ?? fallback;
		}
		/**
		* betterSidebar 服务的唯一安全读取面（对抗性审查 B-1）：cordis 对「未
		* provide 且未 inject」的服务**属性访问抛错**（`cannot get property without
		* inject`），`?.` 也挡不住；`ctx.get` 返回 undefined 不抛。optional peer
		* 后 betterSidebar 不在 inject 清单——一切消费点必须走这里。
		*/
		function betterSidebarOf(ctx) {
			try {
				const viaGet = ctx.get("betterSidebar");
				if (viaGet !== void 0 && viaGet !== null) return viaGet;
			} catch {}
			try {
				return ctx.betterSidebar;
			} catch {
				return;
			}
		}
		/**
		* 直连腿判定（WI-05）：tab 直连注册进原生右栏的条件。
		* - betterSidebar ≥ 0.19 ⇒ 宿主必 ≥ 0.1.5（BS 0.19 只支持 0.1.5）⇒ 直连；
		* - betterSidebar 整体缺席（optional peer 后的合法形态）⇒ 只能直连；
		*   无 BS 且无原生面的非法环境（宿主 < 0.1.5）下注册静默不到、侧聊缺席，
		*   其余功能（注释/回流搭车）存活——静默缺席优于崩。
		*/
		function directNativeLeg(ctx) {
			const bs = betterSidebarOf(ctx);
			if (bs === void 0 || bs === null) return true;
			return nativeSidebarHost(ctx);
		}
		/**
		* True when the host keeps sidebar tabs outside the legacy layout store
		* (better-sidebar >= 0.19). Version parse is best-effort: an unparsable
		* version reports false, which keeps the pre-0.19 behaviour.
		*/
		function nativeSidebarHost(ctx) {
			try {
				const version = betterSidebarOf(ctx)?.version;
				if (version === void 0) return false;
				const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10));
				return major > 0 || minor >= NATIVE_SIDEBAR_MINOR;
			} catch {
				return false;
			}
		}
		function clearRootContext() {
			root = void 0;
		}
		/**
		* 聚焦一个 native tab：better-sidebar >= 0.19 的 `surface.activate` 是空操作
		* （只返回记录存在性——authority: dsh-better-sidebar src/client/native/surface.ts），
		* 真实聚焦面是 dsh 0.1.5 的 `ISidebarRight.focus`（authority:
		* dsh-client-ui-sidebar-right lib/types/client/service.d.ts `focus(tabId)`）。
		* focus 只标记活动 tab/pane，不展开折叠的栏——聚焦的语义包含「让用户看见」，
		* 故折叠时补 toggleExpanded（authority: 同文件 `isExpanded/toggleExpanded`）。
		* @returns true = 已通过 focus 聚焦；false = 面缺席（调用方回退 activateTab）。
		*/
		function focusNativeTab(ctx, tabId) {
			try {
				const face = ctx.get("sidebarRight");
				if (typeof face?.focus !== "function") return false;
				face.focus(tabId);
				if (face.isExpanded?.() === false) face.toggleExpanded?.();
				return true;
			} catch {
				return false;
			}
		}
		function sidebarRightOf(ctx) {
			try {
				const face = ctx.get("sidebarRight");
				return typeof face?.openTab === "function" ? face : void 0;
			} catch {
				return;
			}
		}
		//#endregion
		//#region src/client/host/models.ts
		/**
		* Current model selection of a session, read from its `modelSelection`
		* projection (dsh >= 0.1.2): the durable selection is projected state, so no RPC
		* is needed and the read is safe for any session id. Snapshot shape authority:
		* `@deepseek-ai/dsh-api-session-controller/lib/types/types.d.ts`
		* (`ModelSelectionProjection = { lastUsed, next }`，两者均可为 null——
		* `next` 缺省时按投影文档回落 `lastUsed`）。
		*/
		function projectedModelSelection(ctx, sessionId) {
			try {
				const snapshot = (ctx.sessions.binding(sessionId)?.session)?.projections?.faceOf?.("modelSelection")?.getSnapshot?.();
				return snapshot?.next ?? snapshot?.lastUsed ?? void 0;
			} catch {
				return;
			}
		}
		/**
		* Remote session face carrying `selectModel`/`modelCatalog`（dsh 0.1.5 删除
		* `connection.api.sessions.*` client 面后的模型 RPC 面；事实上 0.1.2-rc.1
		* 起存在——authority: dsh-api-session-controller lib/typert.remote-client.d.ts）。
		* 探测走 `ctx.get`（cordis 的 get 不受 inject 门禁限制，本插件为兼容旧宿主
		* 不声明 inject 'remote.session'；机制见 contracts.ts RemoteSessionModelFace）。
		* `ctx.get('remote')` 返回命名空间容器时下钻其 `.session` 成员。
		*/
		function remoteSessionFace(ctx) {
			for (const name of ["remote.session", "remote"]) {
				let candidate;
				try {
					candidate = ctx.get(name);
				} catch {
					continue;
				}
				const face = candidate;
				if (typeof face?.selectModel === "function") return face;
				if (typeof face?.session?.selectModel === "function") return face.session;
			}
		}
		/**
		* 读会话当前模型选择：投影面（0.1.2+，同步无 RPC）优先；旧
		* `connection.api.sessions.models` RPC（<= 0.1.2 的 client 面，0.1.5 已删）
		* 回退（双版本链，同 chatSourceOf 先例）。永不抛错。
		*/
		async function readModelSelection(ctx, sessionId) {
			const projected = projectedModelSelection(ctx, sessionId);
			if (projected !== void 0) return projected;
			try {
				const res = await ctx.connection.api.sessions.models({ sessionId });
				if (res.result.ok) return res.result.value.current;
			} catch {}
		}
		/**
		* 写会话模型选择：`remote.session.selectModel`（新面）优先，旧
		* `connection.api.sessions.selectModel` 回退。面在而调用失败（模型不可路由等）
		* 属真实失败，不再落旧面重试。
		*/
		async function writeModelSelection(ctx, sessionId, selection) {
			const request = {
				sessionId,
				provider: selection.provider,
				model: selection.model,
				...selection.reasoningEffort !== void 0 ? { reasoningEffort: selection.reasoningEffort } : {}
			};
			const face = remoteSessionFace(ctx);
			if (face !== void 0) try {
				return (await face.selectModel(request)).ok;
			} catch {
				return false;
			}
			try {
				return (await ctx.connection.api.sessions.selectModel(request)).result.ok;
			} catch {
				return false;
			}
		}
		//#endregion
		//#region src/client/host/submission.ts
		const confirmedSessions = /* @__PURE__ */ new WeakSet();
		/** Only an actual observed admission confirms this session generation. */
		function hasConfirmedAcceptance(binding) {
			return binding !== void 0 && confirmedSessions.has(binding.session);
		}
		function inboxFaceOf(binding) {
			return binding.session.projections?.faceOf("inbox");
		}
		/** Old hosts publish authoritative queue rows on Session, newer ones publish Inbox. */
		function queuedMessages(binding, inbox) {
			const queue = binding.session.getSnapshot().queue;
			if (Array.isArray(queue)) return queue;
			if (inbox !== void 0) {
				const state = inbox.getSnapshot();
				return [...state?.["next-turn"] ?? [], ...state?.["next-step"] ?? []];
			}
			return [];
		}
		/** Observe real target admission, never an empty draft or pendingSubmissions echo.
		* The baseline excludes earlier identical quotes and fork-inherited history. */
		async function prepareSubmission(ctx, sessionId, input, needle) {
			const retained = retainSession(ctx, sessionId);
			let binding;
			try {
				binding = retained === void 0 ? ctx.sessions.binding(sessionId) : await retained.ready;
				if (binding === void 0) throw new Error("目标会话尚未就绪");
				if (retained === void 0) {
					const session = binding.session;
					if (typeof session.open === "function") await session.open();
				}
				const chat = chatSourceOf(ctx, binding);
				if (chat === void 0 || chat.getLegacy() === null) throw new Error("宿主消息确认能力尚未就绪；注释已保留");
				const inbox = inboxFaceOf(binding);
				const nodes = () => chat.getLegacy()?.nodes ?? [];
				const maxSeq = Math.max(-1, ...nodes().map((node) => node.seq ?? -1));
				const queueIds = new Set(queuedMessages(binding, inbox).map((message) => message.messageId ?? message.id));
				const previousError = binding.session.getSnapshot().promptError;
				const previousNoticeSeq = input.notices?.getSnapshot()?.seq ?? -1;
				const off = [];
				let timer;
				let submitted = false;
				let settled = false;
				let disposed = false;
				let resolve;
				let reject;
				const outcome = new Promise((yes, no) => {
					resolve = yes;
					reject = no;
				});
				const dispose = () => {
					if (disposed) return;
					disposed = true;
					if (timer !== void 0) clearTimeout(timer);
					for (const unsubscribe of off.splice(0)) unsubscribe();
					retained?.release();
				};
				const finish = (error) => {
					if (settled) return;
					settled = true;
					dispose();
					if (error === void 0) {
						confirmedSessions.add(binding.session);
						resolve();
					} else reject(error);
				};
				const matches = (message) => {
					const content = message.content;
					return (Array.isArray(content) ? content.filter((block) => block?.type === "text" && typeof block.text === "string").map((block) => block.text).join("\n") : "").trimStart().startsWith(needle.trimStart());
				};
				const check = () => {
					if (!submitted || settled) return;
					if (nodes().some((node) => (node.kind === "user" || node.kind === "steering") && (node.seq ?? -1) > maxSeq && matches(node)) || queuedMessages(binding, inbox).some((message) => {
						const id = message.messageId ?? message.id;
						return id !== void 0 && !queueIds.has(id) && matches(message);
					})) {
						finish();
						return;
					}
					const state = binding.session.getSnapshot();
					const error = state.promptError;
					if (error !== previousError && error?.op === "send") {
						finish(new Error(error.error?.message ?? "消息提交失败；注释已保留"));
						return;
					}
					const notice = input.notices?.getSnapshot();
					if (notice?.level === "error" && notice.seq > previousNoticeSeq) {
						finish(new Error(notice.text));
						return;
					}
					if (state.removed === true || state.openState === "error") finish(/* @__PURE__ */ new Error("目标会话已不可用；注释已保留"));
				};
				off.push(chat.subscribe(check), binding.session.subscribe(check));
				if (inbox !== void 0) off.push(inbox.subscribe(check));
				if (input.notices !== void 0) off.push(input.notices.subscribe(check));
				return {
					outcome,
					dispose,
					submit(mode) {
						if (submitted) return;
						submitted = true;
						timer = setTimeout(() => finish(/* @__PURE__ */ new Error("尚未确认消息被宿主接受；请先核对目标会话，注释已保留")), 15e3);
						try {
							input.submit(mode);
							check();
						} catch (error) {
							finish(error instanceof Error ? error : new Error(String(error)));
						}
					}
				};
			} catch (error) {
				retained?.release();
				throw error;
			}
		}
		//#endregion
		//#region src/client/host/probes.ts
		const stores$1 = /* @__PURE__ */ new WeakMap();
		/** A report contains software facts only: no session IDs, prompts, URLs or paths. */
		function hostDiagnostics(ctx) {
			const owner = rootContext(ctx);
			const existing = stores$1.get(ctx) ?? stores$1.get(owner);
			if (existing !== void 0) return existing;
			const listeners = /* @__PURE__ */ new Set();
			let dockRegistered = false;
			let report = {
				versions: {
					sidenote: "0.7.6-fork.1",
					dsh: "unknown",
					betterSidebar: null
				},
				capabilities: []
			};
			const recheck = () => {
				const capabilities = [];
				const add = (name, state, reason, path, id = name) => {
					const entry = {
						id,
						name,
						state,
						reason,
						path
					};
					const at = capabilities.findIndex((capability) => capability.id === id);
					if (at === -1) capabilities.push(entry);
					else capabilities[at] = entry;
				};
				try {
					const id = currentSessionIdOf(ctx);
					const binding = id === "" ? void 0 : ctx.sessions.binding(id);
					const legacy = chatSourceOf(ctx, binding)?.getLegacy();
					const hasSource = typeof document !== "undefined" && document.querySelector("[data-chat-flow-kind=\"assistant-step\"]") !== null;
					const hasAssistant = legacy?.nodes.some((node) => node.kind === "assistant") === true;
					add("selection", hasSource ? "available" : hasAssistant && hasConversationMessages() ? "unknown" : "unready", hasSource ? "ready" : hasAssistant ? "markersMissing" : "waitView", "main assistant DOM");
					const dockReady = dockRegistered && composerSeat() !== null;
					add("dock", dockReady ? "available" : "unready", dockReady ? "ready" : dockRegistered ? "waitView" : "waitDock", "conversation.input.dock");
					const input = probeInput(ctx, id);
					add("input", input.state, input.reason, input.path);
					add("chat", legacy === void 0 || legacy === null ? "unready" : "available", legacy ? "ready" : "waitSession", "chatSourceOf");
					add("acceptance", hasConfirmedAcceptance(binding) ? "available" : "unknown", hasConfirmedAcceptance(binding) ? "ready" : "unknownAcceptance", "durable user/steering or native Queue/Inbox");
					const bs = betterSidebarOf(ctx);
					const native = directNativeLeg(ctx);
					const sidebar = native ? ctx.get("sidebarRight") : bs;
					const sideReady = typeof sidebar?.openTab === "function";
					add("sideOpen", sideReady ? "available" : sidebar == null ? "unready" : "unavailable", sideReady ? "ready" : sidebar == null ? "waitService" : "unsupported", native ? "sidebarRight.openTab" : "betterSidebar.openTab");
					const sides = typeof document === "undefined" ? [] : [...document.querySelectorAll("[data-sidenote-chat-session]")].filter((element) => element.getClientRects().length > 0);
					const sideQuoteReady = sides.some((side) => side.querySelector("[data-sidenote-quote-body][data-sidenote-streaming=\"false\"]"));
					add("sideQuote", sideQuoteReady ? "available" : "unready", sideQuoteReady ? "ready" : sides.length > 0 ? "waitView" : "waitSide", "owned side assistant body");
					for (const [index, side] of sides.entries()) {
						const sideInput = probeInput(ctx, side.dataset.sidenoteChatSession ?? "");
						add("sideInput", sideInput.state, sideInput.reason, sideInput.path, `side-input-${index + 1}`);
						const sideBinding = ctx.sessions.binding(side.dataset.sidenoteChatSession ?? "");
						add("sideAcceptance", hasConfirmedAcceptance(sideBinding) ? "available" : "unknown", hasConfirmedAcceptance(sideBinding) ? "ready" : "unknownAcceptance", "durable user/steering or native Queue/Inbox", `side-acceptance-${index + 1}`);
					}
					const remote = remoteSessionFace(ctx);
					const legacyModels = ctx.connection?.api?.sessions;
					const modelReady = typeof remote?.selectModel === "function" && typeof remote.modelCatalog === "function" || typeof legacyModels?.models === "function" && typeof legacyModels.selectModel === "function";
					const providedRemote = ctx.get("remote.session") ?? ctx.get("remote")?.session;
					const modelProvided = providedRemote != null || typeof legacyModels?.models === "function" || typeof legacyModels?.selectModel === "function";
					add("model", modelReady ? "available" : modelProvided ? "unavailable" : "unready", modelReady ? "ready" : modelProvided ? "unsupported" : "waitService", providedRemote ? "remote.session" : "connection.api.sessions");
					const next = {
						versions: {
							...report.versions,
							betterSidebar: typeof bs?.version === "string" ? bs.version : null
						},
						capabilities
					};
					if (JSON.stringify(next) !== JSON.stringify(report)) {
						report = next;
						for (const fn of [...listeners]) fn();
					}
				} catch {
					add("chat", "unknown", "readFailed", "host state read");
					const next = {
						...report,
						capabilities
					};
					if (JSON.stringify(next) !== JSON.stringify(report)) {
						report = next;
						for (const fn of [...listeners]) fn();
					}
				}
			};
			const store = {
				getSnapshot: () => report,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				recheck,
				dockRegistered() {
					dockRegistered = true;
					recheck();
				}
			};
			stores$1.set(ctx, store);
			recheck();
			return store;
		}
		/** Recheck at service readiness and view changes; absence at boot is waiting. */
		function watchHostDiagnostics(ctx) {
			const store = hostDiagnostics(ctx);
			let timer;
			const schedule = () => {
				if (timer !== void 0) clearTimeout(timer);
				timer = setTimeout(store.recheck, 100);
			};
			const offList = ctx.sessions.list.subscribe(schedule);
			const observer = new MutationObserver((records) => {
				if (records.every((record) => (record.target instanceof Element ? record.target : record.target.parentElement)?.closest("[data-sidenote-compatibility]"))) return;
				schedule();
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: [
					"hidden",
					"aria-expanded",
					"data-sidenote-chat-session",
					"data-conversation-session",
					"data-sidenote-streaming"
				]
			});
			for (const service of [
				"conversation",
				"uiConversation",
				"sidebarRight",
				"betterSidebar",
				"remote"
			]) ctx.inject([service], () => {
				schedule();
			});
			return () => {
				observer.disconnect();
				offList();
				if (timer !== void 0) clearTimeout(timer);
			};
		}
		//#endregion
		//#region src/client/locales.ts
		/** 英文词典（key 的权威清单）。 */
		const en = {
			diagTitle: "Compatibility diagnostics",
			diagClose: "Close compatibility diagnostics",
			diagMode: "dsh-sidenote diagnostic mode",
			diagModeDescription: "Enable while debugging or reporting a problem to inspect integration status.",
			diagModeUnsaved: "This choice only applies to the current page because it could not be saved locally.",
			diagUnknownVersion: "version unknown",
			diagDescription: "Current integration status. This does not claim that a message was accepted or a model answered. Unreadable versions stay unknown.",
			diagNotDetected: "not detected",
			diagPath: "Integration details",
			diagRecheck: "Recheck",
			diagExport: "Export report",
			diagAvailable: "Available",
			diagUnready: "Waiting",
			diagUnknown: "Unknown",
			diagUnavailable: "Unavailable",
			diagReady: "The current integration path can be read.",
			diagWaitSession: "Waiting for the target session.",
			diagWaitService: "Waiting for the host service.",
			diagWaitInput: "Waiting for the target input.",
			diagUnsupported: "The supplied interface lacks a required operation.",
			diagReadFailed: "The host state could not be confirmed. Recheck after it is ready.",
			diagWaitView: "Waiting for a loaded conversation view.",
			diagWaitDock: "Waiting for the annotation dock.",
			diagWaitSide: "Open a side chat to check its view.",
			diagUnknownAcceptance: "No reliable message observation path has been confirmed.",
			diagMarkersMissing: "The loaded view has no recognized assistant markers.",
			diagSelection: "Main reply selection",
			diagDock: "Main annotation chip",
			diagSideOpen: "Side chat opening",
			diagSideQuote: "Side reply selection",
			diagInput: "Main input",
			diagSideInput: "Side input",
			diagAcceptance: "Message acceptance observation",
			diagChat: "Conversation content",
			diagModel: "Model controls",
			diagSideAcceptance: "Side message acceptance",
			inputUnavailable: "Cannot send right now. Body, attachments and quotes have been retained.",
			snapshotContext: "Main conversation progress at first send",
			mainContext: "Main conversation context",
			contextAtSend: "Updates on first send",
			contextAsOf: "As of {time}",
			contextInherited: "Inherited history",
			contextrequest: "Request",
			contextreply: "Reply",
			contextthinking: "Reasoning",
			contextstreaming: "In progress",
			inputWaiting: "The input is not ready. Body, attachments and quotes have been retained. Please try again shortly.",
			draftRecoveryConflict: "The host has another draft. Your local body is retained; review this session in the main view before retrying.",
			quoteWorkflowWaiting: "Annotations are not ready yet. Please try again shortly.",
			menuTitle: "Side chat",
			showSideSessions: "Show side chats in the session list",
			showSideSessionsDescription: "Side chats stay hidden by default. Enable this to find older side chats.",
			sideSessionsUnsaved: "This choice only applies to the current page because it could not be saved locally.",
			tabBaseTitle: "Side",
			codeCopy: "Copy",
			codeCopied: "Copied",
			jsonCopyValue: "Copy value",
			jsonCopyJson: "Copy JSON",
			jsonCopyPath: "Copy path",
			jsonCopyPretty: "Copy pretty JSON",
			jsonCopyCompact: "Copy compact JSON",
			jsonCopyFailed: "Copy failed",
			jsonCollapse: "Collapse node",
			jsonExpand: "Expand node",
			jsonTreeLabel: "JSON payload",
			sideChatCrashed: "Side chat panel crashed: ",
			forkErrorTitle: "Couldn't create the side chat",
			forkErrorHint: "The main session needs at least one completed turn to fork from. Close this tab with the × on the tab.",
			missingTitle: "Session no longer exists",
			missingDetail: "This side chat's session was removed and can't be restored.",
			missingHint: "Close this tab with the × on the tab.",
			preparing: "Preparing the side chat…",
			annotationStorageMemory: "Saved only for this page. Reloading may lose changes.",
			historyFailed: "Failed to load the session history. Close and reopen this tab.",
			emptyTitle: "Side chat",
			emptyText: "Forked from the current session and evolves independently. Closing the tab removes it.",
			thinking: "Thinking",
			writing: "Writing…",
			stopped: "Stopped",
			toolLabel: "Tool",
			failed: "failed",
			todoTitle: "Tasks",
			todoDone: "{n} done",
			todoDoing: "{n} in progress",
			todoPending: "{n} pending",
			running: "running…",
			inputPlaceholder: "Message… (Enter to send, Shift+Enter for a newline)",
			modelLabel: "Model: {name}",
			modelSwitchTitle: "Switch the side chat model",
			permChipTitle: "Permission mode",
			permFullAccess: "Full access",
			pendingNotice: "⚠ The side session has a pending approval/question — click to handle it in the main view",
			writeNotice: "The side session shares the main session's permissions and can modify files (current mode: chip next to the input)",
			pendingApprovalTitle: "Waiting for approval",
			pendingApprovalDesc: "Tool {name} requests elevated execution",
			pendingReject: "Reject",
			pendingAllowOnce: "Allow once",
			pendingQuestionTitle: "Question",
			pendingPlanReview: "Plan review",
			pendingQuestionSubmit: "Submit",
			pendingQuestionCancel: "Cancel",
			pendingCustomPlaceholder: "Custom answer…",
			modelFollowsMain: "follows main session",
			stopReply: "Stop",
			sideChatDone: "「{title}」finished replying",
			stopReplyTitle: "Stop the current reply",
			send: "Send",
			attachTitle: "Attach images",
			attachRemove: "Remove",
			imagePlaceholder: "[Image]",
			toolFallback: "Tool",
			unknownError: "Unknown error",
			modelRetryStarted: "Model request failed, retrying…",
			modelRetryWaiting: "Model request failed, waiting to retry…",
			maxTokens: "Output hit the length limit; this turn was truncated.",
			runCommand: "Run command {cmd}",
			commandNameFallback: "command",
			compacted: "Earlier conversation context was compacted.",
			cmdDesc: "Open a side chat (forked from the current session)",
			cmdNew: "New side chat",
			cmdNewDetail: "Forked from the current session; evolves independently",
			cmdFocus: "Focus \"{title}\"",
			cmdFocusDetail: "Existing side chat",
			cmdReopen: "Reopen \"{title}\"",
			closedJustNow: "Closed just now",
			closedMinutesAgo: "Closed {n} min ago",
			closedHoursAgo: "Closed {n}h ago",
			closedYesterday: "Closed yesterday",
			closedOnDate: "Closed {month}/{day}",
			closedOnDateYear: "Closed {year}/{month}/{day}",
			addToConversation: "Add to conversation",
			askInSideChat: "Ask in side chat",
			toolbarAria: "Selection annotations",
			notePlaceholder: "Add a note (optional)…",
			confirmTitle: "Confirm",
			saveNoteAria: "Save note",
			editNoteAria: "Edit note",
			selectedText: "Selected text",
			userComment: "Your comment",
			sideNotePlaceholder: "Add a note for the side chat (optional)…",
			sideNoteAria: "Side chat note",
			confirmAskAria: "Confirm and ask",
			openSideFailed: "Couldn't open the side chat. Try again.",
			sideTargetWaiting: "Waiting for the target side chat… Esc cancels.",
			sendToTarget: "Send to: {title}",
			deleteNote: "Delete annotation",
			cancel: "Cancel",
			save: "Save",
			chipOne: "1 annotation",
			chipMany: "{n} annotations",
			removeTitle: "Remove annotation",
			removeAria: "Remove annotation {n}",
			noteLine: "Note: {note}",
			noNote: "(no note)",
			protocolHeader: "I annotated {n} passage(s) of the conversation above:",
			sentChipLabel: "{n} annotated",
			sentBadgeTitle: "Sent annotation {n} (view only)",
			sentCardTitle: "Annotation {n} (sent)",
			clearAll: "Clear all",
			clearAnnotations: "Clear annotations",
			clearReflows: "Clear side-chat reflows",
			chipNote: " ({note})",
			headerSide: "Side",
			headerSideTitle: "Open a side chat (forked from the current session)",
			hintText: "Tip: select any text in a reply to annotate it or ask in a side chat",
			hintClose: "Got it",
			reflowToMain: "Bring back to main conversation",
			sendAnnotations: "Send annotations",
			reflowFrom: "From side chat ({title}):",
			reflowDone: "Added to main conversation, not sent yet",
			reflowFailed: "Couldn't reach the main session",
			reflowChipOne: "1 side-chat reflow",
			reflowChipMany: "{n} side-chat reflows",
			reflowReason: "brought back from a side chat by the user",
			reflowBubbleLabel: "Side-chat context",
			reflowRemoveTitle: "Remove reflow",
			termCommandLine: "Command line {n}",
			termSignal: "Terminated ({signal})",
			termExitCode: "Exit code {code}",
			termDone: "done",
			termNoOutput: "(no output)",
			termCollapse: "Collapse",
			termCollapseAria: "Collapse the output",
			termExpand: "Show all ({n} hidden lines)",
			termExpandAria: "Show all ({n} hidden lines)",
			inheritedLabel: "Inherited from main session · up to the fork point · {n}",
			snapshotLabel: "Mainline progress snapshot",
			snapshotLabelAt: "Mainline progress snapshot · taken {at}",
			collapseAll: "Collapse all",
			expandAll: "Expand all",
			jumpToLatest: "↓ Jump to latest",
			reflowAll: "Reflow all",
			reflowAllTitle: "Bring all Q&A pairs back to the main session",
			reflowAllDone: "Reflowed ✓",
			promote: "Save as session",
			promoteTitle: "Fork this side chat into a standalone session in the main list",
			promoteBusy: "Wait for the reply and queued messages to finish before saving",
			promoteDraftBusy: "Send or clear the draft, attachments and annotations before saving",
			promoteDone: "Saved as a regular session — it's open in the main view now",
			readWindow: "{shown} of {total} lines",
			searchPathsSummary: "{shown} of {total} paths",
			searchMatchesSummary: "{shown} of {total} matches in {files} files",
			searchNoResults: "No results",
			diffFiles: "{n} files",
			webNoResults: "No results",
			webSourcesTruncated: "Source list truncated",
			webContentTruncated: "Content truncated",
			parentStripTitle: "Main session status — click to jump back",
			parentRunning: "Main: running",
			parentPending: "Main: awaiting your input",
			parentIdle: "Main: idle"
		};
		/** 中文词典（与 en 同 key）。 */
		const zh = {
			diagTitle: "兼容诊断",
			diagClose: "关闭兼容诊断",
			diagMode: "dsh-sidenote 诊断模式",
			diagModeDescription: "开发者调试或报告问题时开启，显示功能接入状态。",
			diagModeUnsaved: "无法保存到本地，本次选择仅在当前页面生效。",
			diagUnknownVersion: "版本未知",
			diagDescription: "显示当前接入状态，不代表消息已被接受或模型已回答。无法可靠读取的版本显示未知。",
			diagNotDetected: "未检测到",
			diagPath: "接入详情",
			diagRecheck: "重新检查",
			diagExport: "导出报告",
			diagAvailable: "可用",
			diagUnready: "等待就绪",
			diagUnknown: "尚未确认",
			diagUnavailable: "不可用",
			diagReady: "当前接入路径可读取。",
			diagWaitSession: "等待目标会话就绪。",
			diagWaitService: "等待宿主服务就绪。",
			diagWaitInput: "等待目标输入框就绪。",
			diagUnsupported: "已提供的接口缺少必要操作。",
			diagReadFailed: "暂时无法确认宿主状态，就绪后可重新检查。",
			diagWaitView: "等待会话视图加载。",
			diagWaitDock: "等待注释输入区就绪。",
			diagWaitSide: "打开侧聊后检查其视图。",
			diagUnknownAcceptance: "尚未确认可靠的消息观察路径。",
			diagMarkersMissing: "已加载视图没有可识别的 assistant 标记。",
			diagSelection: "主回复划选",
			diagDock: "主注释 chip",
			diagSideOpen: "侧聊开窗",
			diagSideQuote: "侧回复划选",
			diagInput: "主输入框",
			diagSideInput: "侧输入框",
			diagAcceptance: "消息接受观察",
			diagChat: "会话内容读取",
			diagModel: "模型控件",
			diagSideAcceptance: "侧聊消息接受",
			inputUnavailable: "暂时无法发送，正文、附件和注释已保留。",
			snapshotContext: "首次发送时的主线进展",
			mainContext: "主线上下文",
			contextAtSend: "发送时更新",
			contextAsOf: "截至 {time}",
			contextInherited: "已继承主线历史",
			contextrequest: "请求",
			contextreply: "回答",
			contextthinking: "思考",
			contextstreaming: "正在输出",
			inputWaiting: "输入尚未就绪，正文、附件和注释已保留，请稍后重试。",
			draftRecoveryConflict: "宿主另有草稿，本地正文已保留；请在主视图核对该会话草稿后再试。",
			quoteWorkflowWaiting: "注释功能暂未就绪，请稍后重试。",
			menuTitle: "侧边聊天",
			showSideSessions: "在会话列表中显示侧边聊天",
			showSideSessionsDescription: "侧聊默认隐藏；开启后可找回较早的侧聊。",
			sideSessionsUnsaved: "无法保存到本地，本次选择仅在当前页面生效。",
			tabBaseTitle: "侧边",
			codeCopy: "复制",
			codeCopied: "已复制",
			jsonCopyValue: "复制值",
			jsonCopyJson: "复制 JSON",
			jsonCopyPath: "复制路径",
			jsonCopyPretty: "复制格式化 JSON",
			jsonCopyCompact: "复制紧凑 JSON",
			jsonCopyFailed: "复制失败",
			jsonCollapse: "折叠节点",
			jsonExpand: "展开节点",
			jsonTreeLabel: "JSON 数据",
			sideChatCrashed: "侧边聊天面板崩溃了：",
			forkErrorTitle: "无法创建侧边聊天",
			forkErrorHint: "主会话需要至少一轮已完成的对话才能 fork。点击标签上的 × 可关闭此标签页。",
			missingTitle: "会话已不存在",
			missingDetail: "此侧边聊天的会话已被移除，无法恢复。",
			missingHint: "点击标签上的 × 关闭此标签页。",
			preparing: "正在准备侧边聊天…",
			annotationStorageMemory: "当前仅保存在本页，刷新可能丢失修改。",
			historyFailed: "会话历史加载失败，可关闭后重新打开此标签页。",
			emptyTitle: "侧边聊天",
			emptyText: "侧边聊天从当前会话 fork，独立演进；关闭标签页后消失。",
			thinking: "思考过程",
			writing: "正在输出…",
			stopped: "已停止",
			toolLabel: "工具",
			failed: "失败",
			todoTitle: "任务",
			todoDone: "{n} 已完成",
			todoDoing: "{n} 进行中",
			todoPending: "{n} 待处理",
			running: "执行中…",
			inputPlaceholder: "输入消息…（Enter 发送，Shift+Enter 换行）",
			modelLabel: "模型：{name}",
			modelSwitchTitle: "切换侧边聊天模型",
			permChipTitle: "权限模式",
			permFullAccess: "Full access",
			pendingNotice: "⚠ 侧边会话有审批/提问待处理——点击跳到主视图处理",
			writeNotice: "侧边会话与主会话同权限，可以修改文件（当前模式见输入框旁 chip）",
			pendingApprovalTitle: "等待审批",
			pendingApprovalDesc: "工具 {name} 请求越权执行",
			pendingReject: "拒绝",
			pendingAllowOnce: "允许一次",
			pendingQuestionTitle: "提问",
			pendingPlanReview: "计划审批",
			pendingQuestionSubmit: "提交回答",
			pendingQuestionCancel: "取消",
			pendingCustomPlaceholder: "自定义回答…",
			modelFollowsMain: "跟随主会话",
			stopReply: "停止",
			sideChatDone: "「{title}」回复完成",
			stopReplyTitle: "停止当前回复",
			send: "发送",
			attachTitle: "添加图片附件",
			attachRemove: "移除",
			imagePlaceholder: "[图片]",
			toolFallback: "工具",
			unknownError: "未知错误",
			modelRetryStarted: "模型请求失败，正在自动重试…",
			modelRetryWaiting: "模型请求失败，等待自动重试…",
			maxTokens: "输出达到长度上限，本轮回复已截断。",
			runCommand: "执行命令 {cmd}",
			commandNameFallback: "命令",
			compacted: "已压缩更早的对话上下文。",
			cmdDesc: "打开侧边聊天（从当前会话 fork）",
			cmdNew: "新建侧边聊天",
			cmdNewDetail: "从当前会话 fork，独立演进",
			cmdFocus: "聚焦「{title}」",
			cmdFocusDetail: "已存在的侧边聊天",
			cmdReopen: "重开「{title}」",
			closedJustNow: "刚刚关闭",
			closedMinutesAgo: "{n} 分钟前关闭",
			closedHoursAgo: "{n} 小时前关闭",
			closedYesterday: "昨天关闭",
			closedOnDate: "{month}月{day}日关闭",
			closedOnDateYear: "{year}年{month}月{day}日关闭",
			addToConversation: "添加到对话",
			askInSideChat: "在侧边聊天中提问",
			toolbarAria: "划选注释",
			notePlaceholder: "这里可以写自己的注解…",
			confirmTitle: "确认",
			saveNoteAria: "确认注解",
			editNoteAria: "编辑批注",
			selectedText: "所选文本",
			userComment: "用户评论",
			sideNotePlaceholder: "给侧边聊天写个注解（可空）…",
			sideNoteAria: "侧边聊天注解",
			confirmAskAria: "确认并提问",
			openSideFailed: "打开侧边聊天失败，请重试",
			sideTargetWaiting: "正在等待目标侧边会话，Esc 可取消",
			sendToTarget: "发送至：{title}",
			deleteNote: "删除注释",
			cancel: "取消",
			save: "保存",
			chipOne: "1 条注释",
			chipMany: "{n} 条注释",
			removeTitle: "移除注释",
			removeAria: "移除注释 {n}",
			noteLine: "注解：{note}",
			noNote: "（无注解）",
			protocolHeader: "我批注了以下 {n} 处内容：",
			sentChipLabel: "批注 ×{n}",
			sentBadgeTitle: "已发送的注释 {n}（只读回看）",
			sentCardTitle: "注释 {n}（已发送）",
			clearAll: "清空全部",
			clearAnnotations: "清空注释",
			clearReflows: "清空侧边回流",
			chipNote: "（{note}）",
			headerSide: "侧边",
			headerSideTitle: "打开侧边聊天（从当前会话 fork）",
			hintText: "小技巧：划选回复里的文字，可以加注解或在侧边提问",
			hintClose: "知道了",
			reflowToMain: "带回主对话",
			sendAnnotations: "发送注释",
			reflowFrom: "来自侧边聊天（{title}）：",
			reflowDone: "已加入主对话，尚未发送",
			reflowFailed: "主会话不可达",
			reflowChipOne: "1 条侧边回流",
			reflowChipMany: "{n} 条侧边回流",
			reflowReason: "用户选择从侧边聊天带回主线",
			reflowBubbleLabel: "含侧边回流上下文",
			reflowRemoveTitle: "移除回流",
			termCommandLine: "命令第 {n} 行",
			termSignal: "已终止（{signal}）",
			termExitCode: "退出码 {code}",
			termDone: "完成",
			termNoOutput: "（无输出）",
			termCollapse: "收起",
			termCollapseAria: "收起输出",
			termExpand: "展开全部（隐藏 {n} 行）",
			termExpandAria: "展开全部（隐藏 {n} 行）",
			inheritedLabel: "继承自主会话 · 截至 fork 点 · {n} 条",
			snapshotLabel: "主线进展快照",
			snapshotLabelAt: "主线进展快照 · 截于 {at}",
			collapseAll: "全部折叠",
			expandAll: "全部展开",
			jumpToLatest: "↓ 跳到最新",
			reflowAll: "整段回流",
			reflowAllTitle: "把该侧聊全部问答对带回主会话（chip 可预览/逐条撤）",
			reflowAllDone: "已回流 ✓",
			promote: "保存为正式会话",
			promoteTitle: "把侧边聊天转为会话列表里的正式会话",
			promoteBusy: "请等待回复及待发消息处理完成后再保存",
			promoteDraftBusy: "发送或清除草稿、附件和注释后再保存",
			promoteDone: "已保存为正式会话——已在主视图打开",
			readWindow: "{shown}/{total} 行",
			searchPathsSummary: "{shown}/{total} 个路径",
			searchMatchesSummary: "{shown}/{total} 处匹配 · {files} 个文件",
			searchNoResults: "无结果",
			diffFiles: "{n} 个文件",
			webNoResults: "无结果",
			webSourcesTruncated: "来源列表已截断",
			webContentTruncated: "内容已截断",
			parentStripTitle: "主线会话状态——点击回到主对话",
			parentRunning: "主线：运行中",
			parentPending: "主线：等待处理",
			parentIdle: "主线：空闲"
		};
		let localeService;
		/** Attach the DSH locale service (call once from the client apply). */
		function attachLocale(service) {
			localeService = service;
		}
		/** Subscribe to locale switches (component re-render driver). */
		function subscribeLocale(fn) {
			return localeService?.subscribe(fn) ?? (() => {});
		}
		/** The active locale id：DSH 语言设置优先，缺失时回退浏览器语言。 */
		function activeLocale() {
			return localeService?.getSnapshot().active ?? (typeof navigator !== "undefined" ? navigator.language : "") ?? "en";
		}
		/** uSES 快照源（locale-tick.ts 专用出口）：语言字符串本身即快照。 */
		function localeSnapshot() {
			return localeService?.getSnapshot().active ?? "en";
		}
		/** Translate a copy key; `{name}` placeholders interpolate from `params`. */
		function t(key, params) {
			let text = (activeLocale().toLowerCase().startsWith("zh") ? zh : en)[key];
			if (params !== void 0) for (const [name, value] of Object.entries(params)) text = text.replaceAll(`{${name}}`, String(value));
			return text;
		}
		//#endregion
		//#region src/client/locale-tick.ts
		/**
		* React 绑定点（从 locales.ts 拆出）：字典/t() 是纯逻辑层（L0 可测），
		* 本 hook 是唯一的 react 依赖——拆开让 L0 不再经 locales 传递性引入 react
		* （WI-00 分层纪律，arch-audit §1.3）。
		*/
		/** 语言切换时驱动组件重渲（useSyncExternalStore 标准接法）。 */
		function useLocaleTick() {
			(0, react.useSyncExternalStore)(subscribeLocale, localeSnapshot);
		}
		//#endregion
		//#region src/client/diagnostics/mode.ts
		/** Browser-local opt-in shared by the settings row and diagnostic entry. */
		const KEY$1 = "dsh-sidenote:diagnostics-enabled";
		function createDiagnosticMode() {
			let enabled = false;
			let saved = true;
			try {
				enabled = window.localStorage.getItem(KEY$1) === "true";
			} catch {
				saved = false;
			}
			let snapshot = {
				enabled,
				saved
			};
			const listeners = /* @__PURE__ */ new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				setEnabled(value) {
					let saved = true;
					try {
						window.localStorage.setItem(KEY$1, String(value));
					} catch {
						saved = false;
					}
					snapshot = {
						enabled: value,
						saved
					};
					for (const fn of [...listeners]) fn();
				}
			};
		}
		//#endregion
		//#region \0dsh-css:E:\AI图书馆\DSH-学习库\01-插件与技能调研\原始素材\2026-10-27-sidenote-github发布\dsh-sidenote\src\client\diagnostics\diagnostics.module.css.mjs
		const css$3 = ".ckSrbG_trigger{color:var(--dsw-alias-label-secondary,#555);border:1px solid var(--dsw-alias-border-l1,#ddd);cursor:pointer;background:0 0;border-radius:8px;padding:4px 8px;font-size:12px}.ckSrbG_setting{border-bottom:1px solid var(--dsw-alias-border-l1,#ddd);color:var(--dsw-alias-label-primary,#222);justify-content:space-between;align-items:center;gap:24px;padding:16px 0;display:flex}.ckSrbG_settingTitle{font-size:14px;font-weight:500}.ckSrbG_setting p{margin:4px 0 0}.ckSrbG_setting input{appearance:none;background:var(--dsw-alias-label-tertiary,#aaa);cursor:pointer;border-radius:10px;flex-shrink:0;width:36px;height:20px;margin:0;position:relative}.ckSrbG_setting input:before{content:\"\";background:#fff;border-radius:50%;width:14px;height:14px;position:absolute;top:3px;left:3px}.ckSrbG_setting input:checked{background:var(--dsw-alias-label-primary,#222)}.ckSrbG_setting input:checked:before{left:19px}.ckSrbG_setting input:focus-visible{outline:2px solid var(--dsw-alias-label-primary,#222);outline-offset:3px}.ckSrbG_panel{z-index:100;box-sizing:border-box;background:var(--dsw-alias-bg-layer-1,#fff);width:min(400px,100vw - 32px);max-height:calc(100vh - 80px);color:var(--dsw-alias-label-primary,#222);border:1px solid var(--dsw-alias-border-l1,#ddd);border-radius:12px;padding:14px;font-size:13px;position:fixed;top:60px;right:16px;overflow:auto;box-shadow:0 12px 36px #0002}.ckSrbG_header,.ckSrbG_actions,.ckSrbG_list li>div{justify-content:space-between;align-items:center;gap:12px;display:flex}.ckSrbG_header button,.ckSrbG_actions button{color:inherit;border:1px solid var(--dsw-alias-border-l1,#ddd);cursor:pointer;background:0 0;border-radius:6px;padding:4px 8px}.ckSrbG_description,.ckSrbG_versions,.ckSrbG_list p{color:var(--dsw-alias-label-secondary,#666);font-size:12px;line-height:1.5}.ckSrbG_list{margin:12px 0;padding:0;list-style:none}.ckSrbG_list li{border-top:1px solid var(--dsw-alias-border-l1,#ddd);padding:10px 0}.ckSrbG_list li p{margin:4px 0}.ckSrbG_list strong{font-size:12px;font-weight:500}.ckSrbG_list [data-state=unavailable]{color:var(--dsw-alias-state-error-primary,#c33)}.ckSrbG_list details{color:var(--dsw-alias-label-tertiary,#888);font-size:11px}.ckSrbG_list summary{cursor:pointer}.ckSrbG_list code{overflow-wrap:anywhere}";
		const tagId$3 = "dsh-sidenote/diagnostics.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidenote";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var diagnostics_module_css_default = {
			"list": "ckSrbG_list",
			"setting": "ckSrbG_setting",
			"settingTitle": "ckSrbG_settingTitle",
			"actions": "ckSrbG_actions",
			"description": "ckSrbG_description",
			"versions": "ckSrbG_versions",
			"trigger": "ckSrbG_trigger",
			"panel": "ckSrbG_panel",
			"header": "ckSrbG_header"
		};
		//#endregion
		//#region src/client/diagnostics/index.tsx
		const names = {
			selection: "diagSelection",
			dock: "diagDock",
			sideOpen: "diagSideOpen",
			sideQuote: "diagSideQuote",
			input: "diagInput",
			sideInput: "diagSideInput",
			acceptance: "diagAcceptance",
			sideAcceptance: "diagSideAcceptance",
			chat: "diagChat",
			model: "diagModel"
		};
		const states = {
			available: "diagAvailable",
			unready: "diagUnready",
			unknown: "diagUnknown",
			unavailable: "diagUnavailable"
		};
		const reasons = {
			ready: "diagReady",
			waitSession: "diagWaitSession",
			waitService: "diagWaitService",
			waitInput: "diagWaitInput",
			unsupported: "diagUnsupported",
			readFailed: "diagReadFailed",
			waitView: "diagWaitView",
			waitDock: "diagWaitDock",
			waitSide: "diagWaitSide",
			unknownAcceptance: "diagUnknownAcceptance",
			markersMissing: "diagMarkersMissing"
		};
		function CompatibilityButton({ ctx }) {
			useLocaleTick();
			const store = hostDiagnostics(ctx);
			const report = (0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const trigger = (0, react.useRef)(null);
			const panel = (0, react.useRef)(null);
			const panelId = (0, react.useId)();
			const close = () => {
				setOpen(false);
				trigger.current?.focus();
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				panel.current?.focus();
				const onKey = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						setOpen(false);
						trigger.current?.focus();
					}
				};
				document.addEventListener("keydown", onKey, true);
				return () => {
					document.removeEventListener("keydown", onKey, true);
				};
			}, [open]);
			const exportReport = () => {
				const url = URL.createObjectURL(new Blob([JSON.stringify(store.getSnapshot(), null, 2) + "\n"], { type: "application/json" }));
				const link = document.createElement("a");
				link.href = url;
				link.download = "dsh-sidenote-compatibility.json";
				link.click();
				setTimeout(() => {
					URL.revokeObjectURL(url);
				}, 0);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-sidenote-compatibility": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					ref: trigger,
					type: "button",
					className: diagnostics_module_css_default.trigger,
					"aria-expanded": open,
					"aria-controls": open ? panelId : void 0,
					onClick: () => {
						store.recheck();
						setOpen(!open);
					},
					children: t("diagTitle")
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					ref: panel,
					id: panelId,
					tabIndex: -1,
					className: diagnostics_module_css_default.panel,
					role: "dialog",
					"aria-label": t("diagTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: diagnostics_module_css_default.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("diagTitle") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: close,
								"aria-label": t("diagClose"),
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: diagnostics_module_css_default.description,
							children: t("diagDescription")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: diagnostics_module_css_default.versions,
							children: [
								"sidenote ",
								report.versions.sidenote,
								" · DSH ",
								report.versions.dsh === "unknown" ? t("diagUnknownVersion") : report.versions.dsh,
								" · BS ",
								report.versions.betterSidebar ?? t("diagNotDetected")
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: diagnostics_module_css_default.list,
							children: report.capabilities.map((capability) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t(names[capability.name]) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									"data-state": capability.state,
									children: t(states[capability.state])
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t(reasons[capability.reason]) }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("diagPath") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: capability.path })] })
							] }, capability.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: diagnostics_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: store.recheck,
								children: t("diagRecheck")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: exportReport,
								children: t("diagExport")
							})]
						})
					]
				})]
			});
		}
		function DiagnosticSettings({ mode }) {
			useLocaleTick();
			const { enabled, saved } = (0, react.useSyncExternalStore)(mode.subscribe, mode.getSnapshot);
			const descriptionId = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: diagnostics_module_css_default.setting,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: diagnostics_module_css_default.settingTitle,
						children: t("diagMode")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						id: descriptionId,
						className: diagnostics_module_css_default.description,
						children: t("diagModeDescription")
					}),
					!saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: diagnostics_module_css_default.description,
						role: "status",
						children: t("diagModeUnsaved")
					})
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					role: "switch",
					"aria-label": t("diagMode"),
					"aria-describedby": descriptionId,
					checked: enabled,
					onChange: (event) => {
						mode.setEnabled(event.currentTarget.checked);
						event.currentTarget.focus();
					}
				})]
			});
		}
		function DiagnosticEntry({ ctx, mode }) {
			const { enabled } = (0, react.useSyncExternalStore)(mode.subscribe, mode.getSnapshot);
			return enabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CompatibilityButton, { ctx }) : null;
		}
		function registerCompatibilityStatus(ctx) {
			const mode = createDiagnosticMode();
			ctx.effect(() => watchHostDiagnostics(ctx), "dsh-sidenote: host status");
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "dsh-sidenote-diagnostics-setting",
				order: 120,
				registrant: "dsh-sidenote"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiagnosticSettings, { mode })));
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "dsh-sidenote-compatibility",
				order: 11,
				registrant: "dsh-sidenote"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DiagnosticEntry, {
				ctx,
				mode
			})));
		}
		//#endregion
		//#region src/client/protocol.ts
		/**
		* 模型-facing 协议块的 XML 属性位转义（L0 共享层）。
		*
		* 何时需要：把用户可推导的字符串（如侧边聊天的 topic 化标题，Delivery_05
		* 起标题来自首条消息）拼进 `<tag attribute="...">` 的属性位前必须转义，
		* 否则引号撑破属性、尖括号污染块结构。内容位（<问>/<答> 之间）保持原文，
		* 不转义——模型读取友好且不改写用户数据。
		*/
		function xmlAttr(value) {
			return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
		}
		//#endregion
		//#region src/client/reflow.ts
		/**
		* 回流通道的受控对象层（Delivery_02 Workitem_04 v2）：侧边聊天的结论以
		* 「待回流对象」进入主会话——主 composer 上方的 chip（可预览/可移除），
		* 发送瞬间由 annotations/NativeComposer.tsx 原生提交入口与注释协议块一起序列化进消息。
		* 不经草稿文本流（用户裁定：直接进草稿「很脏」）。
		*
		* 气泡留痕：序列化形态是 XML 协议块（见 buildReflowBlock），随注释协议块
		* 一起作为消息连续前缀注入，bubble.ts 反解析后折叠为「含侧边回流上下文」标签。
		*
		* 持久化：localStorage 按会话键（dsh-sidenote:reflow:v1:<sessionId>），
		* 与注释 store 同款纪律（刷新不丢、容错 revive、空删键）。
		*/
		/**
		* reflow 注入通道（Workitem_06）：优先经宿主路由 /sidenote/reflow 以
		* agent.inject 落父会话日志（插件自有 source 独立事件，context row 折叠）；
		* 路由缺席/父会话无 live agent/超时 → 调用方回落搭车形态（发送拦截器
		* 序列化前缀）。逐个 item 投递；成功项由调用方从 store 移除（不等发送
		* 确认——注入已入 inbox，chip 消失表达「已注入」）。
		*
		* 有界等待：注入尝试绝不能拖住发送手势——300ms 超时即回落搭车。
		*/
		const REFLOW_ROUTE_TIMEOUT_MS = 300;
		/** 只消费宿主明确确认的项；未注入项由调用方搭车，发送拒绝时继续保留。 */
		async function tryInjectReflows(parentSessionId, items) {
			if (items.length === 0) return { injectedIds: /* @__PURE__ */ new Set() };
			const empty = { injectedIds: /* @__PURE__ */ new Set() };
			try {
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, REFLOW_ROUTE_TIMEOUT_MS);
				let res;
				try {
					res = await fetch("/sidenote/reflow", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							parentSessionId,
							items: items.map((item) => ({
								text: `以下是用户从侧边对话带回的结论（参考上下文）：\n\n${buildReflowBlock(item)}`,
								sideTitle: item.sideTitle
							}))
						}),
						signal: controller.signal
					});
				} finally {
					clearTimeout(timer);
				}
				if (!res.ok) return empty;
				const data = await res.json();
				if (Array.isArray(data.injectedIndexes)) {
					const indexes = data.injectedIndexes.filter((index) => typeof index === "number" && Number.isInteger(index) && index >= 0 && index < items.length);
					return { injectedIds: new Set(indexes.map((index) => items[index].id)) };
				}
				if (data.ok !== true) return empty;
				return { injectedIds: new Set(items.map((item) => item.id)) };
			} catch {
				return empty;
			}
		}
		const STORAGE_PREFIX$1 = "dsh-sidenote:reflow:v1:";
		/**
		* 回流块序列化（XML 形态，与注释协议同族）：
		*
		*   <reflow source="侧边 2" reason="用户选择从侧边聊天带回主线">
		*   <问>用户在侧边聊天里的提问</问>
		*   <答>结论全文（不截断）</答>
		*   </reflow>
		*
		* 问答成对：只有答没有问，模型理解打折；question 缺省时只有 <答>。
		* 来源与意图放在属性里，内容行保持纯净；模型对 XML 包裹的上下文理解最好
		* （Claude 官方推荐形态 / Codex additionalContext 同款思路）。
		*/
		function buildReflowBlock(item) {
			const parts = [];
			if (item.question !== void 0 && item.question.trim() !== "") parts.push(`<问>${item.question}</问>`);
			parts.push(`<答>${item.text}</答>`);
			return `<reflow source="${xmlAttr(item.sideTitle)}" reason="${t("reflowReason")}">\n${parts.join("\n")}\n</reflow>`;
		}
		function revive$1(value) {
			if (typeof value !== "object" || value === null) return null;
			const r = value;
			if (typeof r.id !== "number" || typeof r.sessionId !== "string" || r.sessionId === "") return null;
			if (typeof r.sideTitle !== "string" || typeof r.text !== "string") return null;
			return {
				id: r.id,
				sessionId: r.sessionId,
				sideTitle: r.sideTitle,
				text: r.text,
				...typeof r.question === "string" && r.question.trim() !== "" ? { question: r.question } : {},
				...typeof r.sourceKey === "string" ? { sourceKey: r.sourceKey } : {},
				createdAt: typeof r.createdAt === "number" ? r.createdAt : 0
			};
		}
		function createReflowStore(now = () => Date.now(), storage) {
			let items = [];
			let nextId = 1;
			let version = 0;
			const listeners = /* @__PURE__ */ new Set();
			const store = storage === void 0 ? typeof localStorage !== "undefined" ? localStorage : null : storage;
			if (store != null) try {
				const keys = [];
				for (let i = 0; i < store.length; i += 1) {
					const key = store.key(i);
					if (typeof key === "string" && key.startsWith(STORAGE_PREFIX$1)) keys.push(key);
				}
				for (const key of keys) {
					const parsed = JSON.parse(store.getItem(key) ?? "null");
					if (!Array.isArray(parsed)) continue;
					for (const raw of parsed) {
						const item = revive$1(raw);
						if (item === null) continue;
						items.push(item);
						nextId = Math.max(nextId, item.id + 1);
					}
				}
			} catch (error) {
				console.warn("[dsh-sidenote] 回流持久化读取失败（按空起步）:", error);
			}
			const persist = (sessionId) => {
				if (store == null) return;
				try {
					const mine = items.filter((i) => i.sessionId === sessionId);
					const key = STORAGE_PREFIX$1 + sessionId;
					if (mine.length === 0) store.removeItem(key);
					else store.setItem(key, JSON.stringify(mine));
				} catch (error) {
					console.warn("[dsh-sidenote] 回流持久化写入失败:", error);
				}
			};
			const notify = () => {
				version += 1;
				for (const fn of [...listeners]) fn();
			};
			return {
				getSnapshot: () => version,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				add(sessionId, sideTitle, text, question, sourceKey) {
					const item = {
						id: nextId,
						sessionId,
						sideTitle,
						text,
						...typeof question === "string" && question.trim() !== "" ? { question } : {},
						...sourceKey !== void 0 ? { sourceKey } : {},
						createdAt: now()
					};
					nextId += 1;
					items = [...items, item];
					persist(sessionId);
					notify();
					return item;
				},
				remove(id) {
					const target = items.find((i) => i.id === id);
					if (target === void 0) return;
					items = items.filter((i) => i.id !== id);
					persist(target.sessionId);
					notify();
				},
				clearSession(sessionId) {
					if (!items.some((i) => i.sessionId === sessionId)) return;
					items = items.filter((i) => i.sessionId !== sessionId);
					persist(sessionId);
					notify();
				},
				list: (sessionId) => items.filter((i) => i.sessionId === sessionId)
			};
		}
		//#endregion
		//#region src/client/annotations/model.ts
		/** localStorage 键前缀（按会话分键）。 */
		const STORAGE_PREFIX = "dsh-sidenote:annotations:v1:";
		/** 持久化条目的宽松校验（字段缺失/类型漂移 → 丢弃该条，不抛错）。 */
		function reviveStored(value) {
			if (typeof value !== "object" || value === null) return null;
			const a = value;
			if (typeof a.id !== "number" || typeof a.number !== "number") return null;
			if (typeof a.sessionId !== "string" || a.sessionId === "") return null;
			if (typeof a.text !== "string" || typeof a.anchorText !== "string") return null;
			if (typeof a.occurrence !== "number") return null;
			if (a.state !== "active" && a.state !== "sent") return null;
			return {
				id: a.id,
				number: a.number,
				sessionId: a.sessionId,
				sourceSessionId: typeof a.sourceSessionId === "string" && a.sourceSessionId !== "" ? a.sourceSessionId : void 0,
				sourceSurface: a.sourceSurface === "main" || a.sourceSurface === "side" ? a.sourceSurface : void 0,
				anchorKey: typeof a.anchorKey === "string" && a.anchorKey !== "" ? a.anchorKey : void 0,
				text: a.text,
				anchorText: a.anchorText,
				occurrence: a.occurrence,
				note: typeof a.note === "string" ? a.note : "",
				state: a.state,
				createdAt: typeof a.createdAt === "number" ? a.createdAt : 0
			};
		}
		function createAnnotationStore(now = () => Date.now(), storage) {
			let annotations = [];
			let nextId = 1;
			let version = 0;
			/** 把某会话的 active 注释按创建顺序压成 1..n（sent 冻结不动）；返回是否改动。 */
			const renumberActive = (sessionId) => {
				let changed = false;
				let next = 0;
				annotations = annotations.map((a) => {
					if (a.sessionId !== sessionId || a.state !== "active") return a;
					next += 1;
					if (a.number === next) return a;
					changed = true;
					return {
						...a,
						number: next
					};
				});
				return changed;
			};
			const listeners = /* @__PURE__ */ new Set();
			const submissions = /* @__PURE__ */ new Map();
			const idleSubmission = { pending: false };
			let store = storage ?? null;
			if (storage === void 0) try {
				store = globalThis.localStorage ?? null;
			} catch {
				store = null;
			}
			let storageStatus = store === null ? "memory" : "persistent";
			const failedStorageSessions = /* @__PURE__ */ new Set();
			let hydrationFailed = false;
			if (store != null) try {
				const keys = [];
				for (let i = 0; i < store.length; i += 1) {
					const key = store.key(i);
					if (typeof key === "string" && key.startsWith("dsh-sidenote:annotations:v1:")) keys.push(key);
				}
				for (const key of keys) {
					const raw = store.getItem(key);
					if (raw === null) continue;
					let parsed;
					try {
						parsed = JSON.parse(raw);
					} catch {
						console.warn("[dsh-sidenote] 跳过损坏的注释记录:", key);
						continue;
					}
					if (!Array.isArray(parsed)) continue;
					for (const item of parsed) {
						const revived = reviveStored(item);
						if (revived === null) continue;
						annotations.push(revived);
						nextId = Math.max(nextId, revived.id + 1);
					}
				}
			} catch (error) {
				hydrationFailed = true;
				storageStatus = "memory";
				console.warn("[dsh-sidenote] 注释持久化读取失败（按空起步）:", error);
			}
			/** 把一个会话的注释写回 localStorage（空则删键）。 */
			const persistSession = (sessionId) => {
				if (store == null) return;
				try {
					const items = annotations.filter((a) => a.sessionId === sessionId);
					const key = STORAGE_PREFIX + sessionId;
					if (items.length === 0) store.removeItem(key);
					else store.setItem(key, JSON.stringify(items));
					failedStorageSessions.delete(sessionId);
					storageStatus = hydrationFailed || failedStorageSessions.size > 0 ? "memory" : "persistent";
				} catch (error) {
					failedStorageSessions.add(sessionId);
					storageStatus = "memory";
					console.warn("[dsh-sidenote] 注释持久化写入失败:", error);
				}
			};
			/** mutation 后落盘：受影响会话可能不止一个（markSessionSent 单会话）。 */
			const persistTouched = (touched) => {
				for (const sessionId of new Set(touched)) persistSession(sessionId);
			};
			if (annotations.length > 0) {
				const migrated = [];
				for (const sessionId of new Set(annotations.map((a) => a.sessionId))) if (renumberActive(sessionId)) migrated.push(sessionId);
				if (migrated.length > 0) persistTouched(migrated);
			}
			const notify = () => {
				version += 1;
				for (const fn of [...listeners]) fn();
			};
			/** 该会话尚未发送（active）的注释数 = 当前批次的下一号 - 1。 */
			const countActiveIn = (sessionId) => annotations.reduce((n, a) => n + (a.sessionId === sessionId && a.state === "active" ? 1 : 0), 0);
			const replace = (id, patch) => {
				const target = annotations.find((a) => a.id === id);
				annotations = annotations.map((a) => a.id === id ? {
					...a,
					...patch
				} : a);
				if (target !== void 0) persistTouched([target.sessionId]);
				notify();
			};
			return {
				getSnapshot: () => version,
				getStorageStatus: (sessionId) => sessionId === void 0 || hydrationFailed || store === null ? storageStatus : failedStorageSessions.has(sessionId) ? "memory" : "persistent",
				getSubmission: (sessionId) => submissions.get(sessionId) ?? idleSubmission,
				setSubmission(sessionId, state) {
					submissions.set(sessionId, state);
					notify();
				},
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				add(draft) {
					const number = countActiveIn(draft.sessionId) + 1;
					const annotation = {
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
						state: "active",
						createdAt: now()
					};
					nextId += 1;
					annotations = [...annotations, annotation];
					renumberActive(draft.sessionId);
					persistTouched([draft.sessionId]);
					notify();
					return annotation;
				},
				setNote(id, note) {
					if (!annotations.some((a) => a.id === id)) return;
					replace(id, { note });
				},
				remove(id) {
					const target = annotations.find((a) => a.id === id);
					if (target === void 0) return;
					annotations = annotations.filter((a) => a.id !== id);
					if (target.state === "active") renumberActive(target.sessionId);
					persistTouched([target.sessionId]);
					notify();
				},
				markSent(ids) {
					if (ids.length === 0) return;
					const idSet = new Set(ids);
					if (!annotations.some((a) => idSet.has(a.id) && a.state === "active")) return;
					const touched = /* @__PURE__ */ new Set();
					annotations = annotations.map((a) => {
						if (!idSet.has(a.id) || a.state !== "active") return a;
						touched.add(a.sessionId);
						return {
							...a,
							state: "sent"
						};
					});
					for (const sessionId of touched) renumberActive(sessionId);
					persistTouched([...touched]);
					notify();
				},
				get(id) {
					return annotations.find((a) => a.id === id);
				},
				list(sessionId) {
					return annotations.filter((a) => a.sessionId === sessionId);
				},
				listActive(sessionId) {
					return annotations.filter((a) => a.sessionId === sessionId && a.state === "active");
				},
				countActive(sessionId) {
					return countActiveIn(sessionId);
				},
				sessions() {
					return [...new Set(annotations.map((a) => a.sessionId))];
				}
			};
		}
		//#endregion
		//#region src/client/bridge.ts
		const sideChatBridge = { current: null };
		//#endregion
		//#region src/client/chat/transcript.ts
		/** Protocol readers need actual text, not attachment preview labels before it.
		* Native Conversation renders images; only an image-only message needs a label. */
		function contentTextOf(content) {
			if (!Array.isArray(content)) return "";
			const parts = [];
			let hasImage = false;
			for (const block of content) {
				if (typeof block !== "object" || block === null) continue;
				const b = block;
				if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
				else if (b.type === "image") hasImage = true;
			}
			return parts.join("\n") || (hasImage ? t("imagePlaceholder") : "");
		}
		function seqKey(prefix, node) {
			return `${prefix}:${typeof node.seq === "number" ? node.seq : "?"}`;
		}
		/** 节点 seq 随行（D1 折叠边界用；缺省不带）。 */
		function seqOf(node) {
			return typeof node.seq === "number" ? { seq: node.seq } : {};
		}
		function assistantParts(blocks) {
			const texts = [];
			const reasonings = [];
			let hasToolCall = false;
			if (Array.isArray(blocks)) for (const block of blocks) {
				if (typeof block !== "object" || block === null) continue;
				const b = block;
				if (b.kind === "text" && typeof b.text === "string") texts.push(b.text);
				else if (b.kind === "reasoning" && typeof b.text === "string") reasonings.push(b.text);
				else if (b.kind === "tool-call") hasToolCall = true;
			}
			return {
				text: texts.join("\n\n"),
				reasoning: reasonings.join("\n\n"),
				hasToolCall
			};
		}
		/**
		* 单个 ConversationNode → ChatMessage；返回 null = 面板不渲染
		* （context 注入、未知面事件、已取消的重试等对读者无信息的节点）。
		*/
		function nodeToMessage(node) {
			if (typeof node !== "object" || node === null) return null;
			const n = node;
			switch (n.kind) {
				case "user": return {
					key: seqKey("u", n),
					...seqOf(n),
					role: "user",
					text: contentTextOf(n.content)
				};
				case "steering": return {
					key: seqKey("s", n),
					...seqOf(n),
					role: "user",
					text: contentTextOf(n.content)
				};
				case "assistant": {
					const { text, reasoning, hasToolCall } = assistantParts(n.blocks);
					if (text === "" && reasoning === "" && hasToolCall) return null;
					return {
						key: seqKey("a", n),
						...seqOf(n),
						role: "assistant",
						text,
						...reasoning !== "" ? { reasoning } : {},
						...n.interrupted === true ? { interrupted: true } : {}
					};
				}
				case "tool-result": {
					const call = n.call;
					const toolName = typeof call?.name === "string" ? call.name : typeof n.callId === "string" ? n.callId : t("toolFallback");
					const text = contentTextOf(n.content);
					return {
						key: seqKey("t", n),
						...seqOf(n),
						role: "tool",
						toolName,
						text,
						...n.isError === true ? { isError: true } : {}
					};
				}
				case "turn-error": return {
					key: seqKey("e", n),
					...seqOf(n),
					role: "error",
					text: typeof n.message === "string" ? n.message : t("unknownError")
				};
				case "model-retry":
					if (n.retryState === "cancelled") return null;
					return {
						key: seqKey("r", n),
						...seqOf(n),
						role: "notice",
						text: t(n.retryState === "started" ? "modelRetryStarted" : "modelRetryWaiting")
					};
				case "turn-max-tokens": return {
					key: seqKey("m", n),
					...seqOf(n),
					role: "notice",
					text: t("maxTokens")
				};
				case "command": {
					const name = typeof n.name === "string" && n.name !== "" ? n.name : t("commandNameFallback");
					const args = typeof n.args === "string" ? n.args.trimStart() : "";
					return {
						key: seqKey("c", n),
						...seqOf(n),
						role: "notice",
						text: t("runCommand", { cmd: `/${name}${args === "" ? "" : ` ${args}`}` })
					};
				}
				case "compaction": return {
					key: seqKey("k", n),
					...seqOf(n),
					role: "notice",
					text: t("compacted")
				};
				default: return null;
			}
		}
		/**
		* ConversationSnapshot → 渲染消息列表：终态节点 + 在途项（按 turn/step 归并）。
		* 快照缺省（未绑定）时为空列表。
		*
		* 时序归并（WI-01）：在途项不再恒追加尾部——真实交错是「partial 文本 → 它
		* 自己 step 发出的工具卡」：partial 与同 step 的 runningCall 并存时必须文本
		* 在前（原文早于调用），不同 step 按 (turn, step) 升序；并行多 call 保持
		* 宿主 dispatch 序（同 turn/step 内稳定）。终态节点自带 seq 全序，不参与
		* 归并（在途项永远属于当前 turn 的前沿，尾部插入点天然正确）。
		*/
		function transcriptOf(snapshot) {
			if (snapshot === void 0 || snapshot === null) return [];
			const out = [];
			for (const node of snapshot.nodes ?? []) {
				const message = nodeToMessage(node);
				if (message !== null) out.push(message);
			}
			const inflight = [];
			const partial = snapshot.partial;
			if (partial !== void 0 && partial !== null) {
				const { text, reasoning, hasToolCall } = assistantParts(partial.blocks);
				if (text !== "" || reasoning !== "" || !hasToolCall) inflight.push({
					turn: typeof partial.turn === "number" ? partial.turn : Number.MAX_SAFE_INTEGER,
					step: typeof partial.step === "number" ? partial.step : Number.MAX_SAFE_INTEGER,
					order: 0,
					message: {
						key: "partial",
						role: "assistant",
						text,
						...reasoning !== "" ? { reasoning } : {},
						streaming: true
					}
				});
			}
			if (Array.isArray(snapshot.runningCalls)) for (const call of snapshot.runningCalls) {
				if (typeof call !== "object" || call === null) continue;
				const c = call;
				const toolName = typeof c.name === "string" ? c.name : t("toolFallback");
				inflight.push({
					turn: typeof c.turn === "number" ? c.turn : Number.MAX_SAFE_INTEGER,
					step: typeof c.step === "number" ? c.step : Number.MAX_SAFE_INTEGER,
					order: 1,
					message: {
						key: `rc:${typeof c.callId === "string" ? c.callId : "?"}`,
						role: "tool",
						toolName,
						text: "",
						streaming: true
					}
				});
			}
			inflight.sort((a, b) => a.turn - b.turn || a.step - b.step || a.order - b.order);
			for (const item of inflight) out.push(item.message);
			return out;
		}
		//#endregion
		//#region src/client/chat/viewState.ts
		function createFoldStore(storageKey) {
			const open = /* @__PURE__ */ new Map();
			let version = 0;
			const listeners = /* @__PURE__ */ new Set();
			if (storageKey !== void 0 && typeof localStorage !== "undefined") try {
				const raw = localStorage.getItem(storageKey);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed === "object" && parsed !== null) {
						for (const [k, v] of Object.entries(parsed)) if (v === true) open.set(k, true);
					}
				}
			} catch (error) {
				console.warn("[dsh-sidenote] 折叠态恢复失败（按空起步）:", error);
			}
			const persist = () => {
				if (storageKey === void 0 || typeof localStorage === "undefined") return;
				try {
					if (open.size === 0) localStorage.removeItem(storageKey);
					else localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(open)));
				} catch {}
			};
			const notify = () => {
				version += 1;
				for (const fn of [...listeners]) fn();
				persist();
			};
			return {
				getSnapshot: () => version,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				isOpen: (key) => open.get(key) === true,
				has: (key) => open.has(key),
				toggle(key) {
					open.set(key, open.get(key) !== true);
					notify();
				},
				setAll(keys, value) {
					for (const key of keys) open.set(key, value);
					notify();
				}
			};
		}
		//#endregion
		//#region src/client/host/icons.ts
		const EmptyIcon = () => null;
		const iconExports = _deepseek_ai_dsh_client_ui_primitives;
		/** Prefer the weight-named 0.1.7 export, then fall back to the legacy size-named export. */
		function resolveIcon(exports, modernName, legacyName) {
			return exports[modernName] ?? exports[legacyName] ?? EmptyIcon;
		}
		const icon = (modernName, legacyName) => resolveIcon(iconExports, modernName, legacyName);
		const IconNewChatOutline16 = icon("IconNewChatOutlineRegular", "IconNewChatOutline16");
		const IconCheckOutline16 = icon("IconCheckOutlineRegular", "IconCheckOutline16");
		const IconListPenOutline16 = icon("IconListPenOutlineRegular", "IconListPenOutline16");
		const IconEditOutline16 = icon("IconEditOutlineRegular", "IconEditOutline16");
		const IconTrashOutline16 = icon("IconTrashOutlineRegular", "IconTrashOutline16");
		icon("IconPlayOutlineRegular", "IconPlayOutline16");
		icon("IconCordisPluginOutlineRegular", "IconCordisPluginOutline14");
		icon("IconBranchOutlineRegular", "IconBranchOutline16");
		const IconShareOutline16 = icon("IconShareOutlineRegular", "IconShareOutline16");
		const IconChevronDownOutline14 = icon("IconChevronDownOutlineRegular", "IconChevronDownOutline14");
		const IconCloseOutline16 = icon("IconCloseOutlineRegular", "IconCloseOutline16");
		icon("IconRightUpOutlineRegular", "IconRightUpOutline16");
		icon("IconSearchOutlineRegular", "IconSearchOutline16");
		icon("IconGlobeOutlineRegular", "IconGlobeOutline14");
		icon("IconCodeOutlineRegular", "IconCodeOutline16");
		icon("IconChecklistOutlineRegular", "IconChecklistOutline14");
		icon("IconThinkOutlineRegular", "IconThinkOutline16");
		icon("IconInspectOutlineRegular", "IconInspectOutline12");
		icon("IconPaperclipOutlineRegular", "IconPaperclipOutline16");
		icon("IconStopFillRegular", "IconStopFill16");
		icon("IconSendOutlineRegular", "IconSendOutline16");
		icon("IconWarningOutlineRegular", "IconWarningOutline16");
		icon("IconQuestionOutlineRegular", "IconQuestionOutline14");
		//#endregion
		//#region src/client/annotations/format.ts
		/** 协议头（双语）：zh「我批注了以下 2 处内容：」/ en 见 locales。 */
		function protocolHeader(n) {
			return t("protocolHeader", { n });
		}
		/** One annotation's XML block（无注解时省略 <note>）。 */
		function formatAnnotationXml(index, item) {
			const id = item.number ?? index;
			const note = item.note.trim();
			return note === "" ? `<annotation id="${id}">\n<quote>${item.text}</quote>\n</annotation>` : `<annotation id="${id}">\n<quote>${item.text}</quote>\n<note>${note}</note>\n</annotation>`;
		}
		/** 注释协议块 = 头部句 + 每个注释一个 XML 块（行间无空行，与正文空一行）。 */
		function buildProtocolBlock(items) {
			return [protocolHeader(items.length), ...items.map((item, i) => formatAnnotationXml(i + 1, item))].join("\n");
		}
		/** 协议头识别（zh/en 都认）：整行匹配。 */
		const PROTOCOL_HEADER_RE = /^(?:我批注了以下 (\d+) 处内容：|I annotated (\d+) passage\(s\) of the conversation above:)$/;
		const ANNOTATION_RE = /<annotation id="(\d+)">\s*<quote>([\s\S]*?)<\/quote>\s*(?:<note>([\s\S]*?)<\/note>\s*)?<\/annotation>/y;
		const REFLOW_RE = /<reflow\s+source="([^"]*)"(?:\s+reason="([^"]*)")?\s*>([\s\S]*?)<\/reflow>/y;
		/**
		* 气泡 tooltip / 面板留痕 chip 的展示拍平：剥掉 <问>/<答> 协议标签只留内容行
		* （协议标签是 wire 形态，不出现在 UI）。仅用于 title 悬浮文案。
		*/
		function flattenReflowContent(content) {
			return content.replace(/<问>([\s\S]*?)<\/问>/g, "$1").replace(/<答>([\s\S]*?)<\/答>/g, "$1");
		}
		/** 跳过空白（含换行），返回新位置。 */
		function skipBlank(text, pos) {
			while (pos < text.length && /\s/.test(text[pos])) pos += 1;
			return pos;
		}
		/**
		* 从消息文本开头解析协议前缀（回流块* → 注释块）：任一命中即返回。
		* 全部不命中返回 null（普通用户消息，零开销）。
		* 注意：内容里恰好含字面 `</quote>` 会在该处截断解析（已知极限，聊天引用
		* 场景可忽略；Codex 的 <external_KEY> 同款取舍）。
		*/
		function splitProtocolPrefix(text) {
			let pos = 0;
			const reflows = [];
			const annotations = [];
			for (;;) {
				REFLOW_RE.lastIndex = pos;
				const m = REFLOW_RE.exec(text);
				if (m === null) break;
				reflows.push({
					source: m[1] ?? "",
					content: (m[3] ?? "").trim()
				});
				pos = skipBlank(text, REFLOW_RE.lastIndex);
			}
			const rest = text.slice(pos);
			const headerMatch = /^([^\n]*)\n/.exec(rest);
			if (headerMatch !== null && PROTOCOL_HEADER_RE.test(headerMatch[1] ?? "")) {
				let cursor = pos + headerMatch[0].length;
				for (;;) {
					ANNOTATION_RE.lastIndex = cursor;
					const m = ANNOTATION_RE.exec(text);
					if (m === null) break;
					annotations.push({
						id: Number(m[1]),
						quote: m[2] ?? "",
						note: (m[3] ?? "").trim()
					});
					cursor = skipBlank(text, ANNOTATION_RE.lastIndex);
				}
				if (annotations.length > 0) pos = cursor;
				else if (reflows.length === 0) return null;
			} else if (reflows.length === 0) return null;
			if (reflows.length === 0 && annotations.length === 0) return null;
			return {
				length: skipBlank(text, pos),
				annotations,
				reflows
			};
		}
		function splitSnapshotPrefix(text) {
			if (!text.startsWith("<mainline-progress-snapshot")) return null;
			const close = text.indexOf("</mainline-progress-snapshot>");
			if (close < 0) return null;
			const block = text.slice(0, close + 29);
			return {
				snapshot: block,
				takenAt: /taken-at="([^"]*)"/.exec(block)?.[1] ?? null,
				rest: text.slice(close + 29).trimStart()
			};
		}
		//#endregion
		//#region src/client/sidechat/model.ts
		/** Tab 类型 id（better-sidebar 注册表键；带包前缀防冲突）。 */
		const SIDE_TAB_TYPE = "dsh-sidenote:side";
		/**
		* 标题编号：首个「侧边」；并存时新 Tab「侧边 N」（N = 既有最大编号 + 1，
		* 从标题解析）——关掉「侧边」再新建不会重名复用「侧边 2」。
		* @param existingTitles - 创建时刻同会话侧边聊天 Tab 的标题集。
		*/
		function sideTabTitle(existingTitles) {
			const base = t("tabBaseTitle");
			let max = 0;
			for (const title of existingTitles) {
				const match = /^(?:Side|侧边)(?: (\d+))?$/.exec(title);
				if (match !== null) max = Math.max(max, match[1] === void 0 ? 1 : Number(match[1]));
			}
			return max <= 0 ? base : `${base} ${max + 1}`;
		}
		/**
		* 容错解析 tab.meta：布局持久化里的 meta 来自上一版本的自己，字段缺失或
		* 类型漂移一律降级为缺省，绝不抛错（刷新恢复路径不许崩）。
		*/
		function parseSideChatMeta(meta) {
			if (typeof meta !== "object" || meta === null) return {};
			const raw = meta;
			const out = {};
			if (typeof raw.childId === "string" && raw.childId !== "") out.childId = raw.childId;
			if (typeof raw.parentSessionId === "string" && raw.parentSessionId !== "") out.parentSessionId = raw.parentSessionId;
			if (typeof raw.pendingDraft === "string" && raw.pendingDraft !== "") out.pendingDraft = raw.pendingDraft;
			if (typeof raw.boundarySeq === "number" && Number.isFinite(raw.boundarySeq)) out.boundarySeq = raw.boundarySeq;
			if (raw.forkedMidTurn === true) out.forkedMidTurn = true;
			if (raw.snapshotOnly === true) out.snapshotOnly = true;
			if (typeof raw.leakedPromptPrefix === "string" && raw.leakedPromptPrefix !== "") out.leakedPromptPrefix = raw.leakedPromptPrefix;
			if (raw.inheritedPurged === true) out.inheritedPurged = true;
			if (typeof raw.topic === "string" && raw.topic !== "") out.topic = raw.topic;
			return out;
		}
		/** 清除 meta.pendingDraft（其余字段原样保留）。 */
		function clearPendingDraft(meta) {
			const { pendingDraft: _dropped, ...rest } = meta;
			return rest;
		}
		function isTab(value) {
			if (typeof value !== "object" || value === null) return false;
			const tab = value;
			return typeof tab.id === "string" && typeof tab.type === "string";
		}
		function walkTree(node, into) {
			if (typeof node !== "object" || node === null) return;
			const n = node;
			if (n.kind === "leaf") {
				if (Array.isArray(n.tabs)) {
					for (const tab of n.tabs) if (isTab(tab)) into.push(tab);
				}
				return;
			}
			if (Array.isArray(n.children)) for (const child of n.children) walkTree(child, into);
		}
		/**
		* 枚举侧栏状态里的全部 Tab：splits + bottomSplits 两棵树，外加 0.16 引入的
		* 浮动窗 floats（元素形态 { id, tab, … }，tab 为窗口持有的 SidebarTab）。
		* floats 缺失（0.16 之前）时数组检查天然跳过，前后版本通吃。
		*/
		function collectTabs(state) {
			if (typeof state !== "object" || state === null) return [];
			const s = state;
			const into = [];
			walkTree(s.splits, into);
			walkTree(s.bottomSplits, into);
			if (Array.isArray(s.floats)) for (const float of s.floats) {
				const tab = float?.tab;
				if (isTab(tab)) into.push(tab);
			}
			return into;
		}
		/** 枚举当前并存的侧边聊天 Tab（树顺序 = 打开顺序的近似）。 */
		function collectSideTabs(state) {
			return collectTabs(state).filter((tab) => tab.type === SIDE_TAB_TYPE);
		}
		/**
		* blank 着陆页会话没有已完成 turn，fork 必败（host 返回 fork-unavailable）
		* ——+ 菜单与 /side 命令的 available 用它禁用入口；面板内错误态兜底。
		* 摘要求知（列表未就绪）时放行，交给 fork 错误态。
		*/
		function canForkFrom(ctx, sessionId) {
			try {
				return (ctx.sessions.list.getSnapshot().byId?.[sessionId])?.blank !== true;
			} catch {
				return true;
			}
		}
		function phaseOf(input) {
			if (input.childId === void 0) return input.forkError === null ? "forking" : "fork-error";
			if (input.bound) return "chat";
			if (input.listPhase === "ready" && !input.listed) return "missing";
			return "loading";
		}
		/** 注入草稿的拼接规则：空草稿直接落文本，否则换行追加（引文+问题的自然形态）。 */
		function appendDraftText(draft, text) {
			return draft.trim() === "" ? text : `${draft}\n${text}`;
		}
		/**
		* 回流「问答成对」的数据源：为每条 assistant 消息配对它在回答的用户提问。
		* 顺序扫描消息流，记录最近一条用户消息的可见文本（剥掉注释/回流协议前缀——
		* fork 历史里的主会话消息可能携带），其后每条非流式 assistant 消息都配对到它；
		* 中间的 tool/notice 节点不打断配对。此前没有用户提问（如 fork 历史结尾
		* 恰是 assistant）则不配对，回流块退化为只有 <答>。
		* 返回 Map：assistant 消息 key → 提问全文。
		*/
		function pairQuestions(messages) {
			const pairs = /* @__PURE__ */ new Map();
			let pending;
			for (const message of messages) if (message.role === "user") {
				const body = splitSnapshotPrefix(message.text)?.rest ?? message.text;
				const proto = splitProtocolPrefix(body);
				const visible = (proto === null ? body : body.slice(proto.length)).trim();
				pending = visible === "" ? void 0 : visible;
			} else if (message.role === "assistant" && message.streaming !== true && pending !== void 0) pairs.set(message.key, pending);
			return pairs;
		}
		//#endregion
		//#region \0dsh-css:E:\AI图书馆\DSH-学习库\01-插件与技能调研\原始素材\2026-10-27-sidenote-github发布\dsh-sidenote\src\client\sidechat\sidechat.module.css.mjs
		const css$2 = ".FFMnBq_nativeHost,.FFMnBq_root,.FFMnBq_nativeConversation{flex-direction:column;min-height:0;display:flex}.FFMnBq_nativeHost,.FFMnBq_root{height:100%}.FFMnBq_root{color:var(--dsw-alias-label-primary)}.FFMnBq_nativeConversation{flex:1}.FFMnBq_chatView{flex-direction:column;flex:1 0 auto;min-width:0;display:flex}.FFMnBq_historyView{display:contents}.FFMnBq_mainContext{flex:none;padding:12px 24px 4px}.FFMnBq_historyToggle{align-items:center;gap:6px;display:flex}.FFMnBq_contextHint{color:var(--dsw-alias-label-tertiary);font-size:12px}.FFMnBq_contextChevron{transform:rotate(-90deg)}.FFMnBq_contextChevron,.FFMnBq_contextChevronOpen{flex:none}.FFMnBq_progressEntries{max-height:240px;margin:8px 6px;overflow:auto}.FFMnBq_progressEntry{white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0;font-size:13px;line-height:1.6}.FFMnBq_root [data-sidenote-progress-snapshot],.FFMnBq_root[data-sidenote-context-pending] [data-submission-echo]{display:none}.FFMnBq_reflowAction{width:32px;height:32px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:8px;flex:none;order:1;justify-content:center;align-items:center;margin-left:auto;padding:0;display:inline-flex}.FFMnBq_reflowAction:hover{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}.FFMnBq_reflowAction:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.FFMnBq_reflowAction:disabled{cursor:default;color:var(--dsw-alias-state-business-primary);background:0 0}.FFMnBq_nativeToolbar{border-bottom:1px solid var(--dsw-alias-border-l1);justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;display:flex}.FFMnBq_nativeToolbarActions{flex-wrap:wrap;align-items:center;gap:8px;display:flex}.FFMnBq_nativeAction,.FFMnBq_historyToggle{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:6px;padding:4px 6px;font-size:13px}.FFMnBq_nativeAction:hover,.FFMnBq_nativeAction:focus-visible,.FFMnBq_historyToggle:hover,.FFMnBq_historyToggle:focus-visible{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.FFMnBq_nativeAction:disabled{opacity:.5;cursor:default}.FFMnBq_historyToggle{text-align:left;margin:0}.FFMnBq_stateScreen{text-align:center;flex-direction:column;flex:1;justify-content:center;align-items:center;gap:8px;padding:24px 16px;display:flex}.FFMnBq_emptyIcon{color:var(--dsw-alias-label-tertiary)}.FFMnBq_emptyTitle{font-size:14px;font-weight:600}.FFMnBq_emptyText{color:var(--dsw-alias-label-secondary);max-width:280px;font-size:13px;line-height:1.6}.FFMnBq_stateDetail,.FFMnBq_errorRow{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;font-size:13px;line-height:1.6}.FFMnBq_errorRow{padding:8px 12px}.FFMnBq_headerSide{color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:6px;align-items:center;gap:4px;padding:4px 8px;display:inline-flex}.FFMnBq_headerSide:hover,.FFMnBq_headerSide:focus-visible{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.FFMnBq_headerSide:disabled{opacity:.4;cursor:default}.FFMnBq_visibilitySetting{justify-content:space-between;align-items:center;gap:16px;padding:8px 0;display:flex}.FFMnBq_visibilitySetting p{color:var(--dsw-alias-label-secondary);margin:4px 0 0;font-size:13px}";
		const tagId$2 = "dsh-sidenote/sidechat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidenote";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var sidechat_module_css_default = {
			"chatView": "FFMnBq_chatView",
			"stateDetail": "FFMnBq_stateDetail",
			"contextChevron": "FFMnBq_contextChevron",
			"emptyText": "FFMnBq_emptyText",
			"headerSide": "FFMnBq_headerSide",
			"historyToggle": "FFMnBq_historyToggle",
			"visibilitySetting": "FFMnBq_visibilitySetting",
			"reflowAction": "FFMnBq_reflowAction",
			"historyView": "FFMnBq_historyView",
			"nativeConversation": "FFMnBq_nativeConversation",
			"nativeToolbar": "FFMnBq_nativeToolbar",
			"nativeHost": "FFMnBq_nativeHost",
			"contextChevronOpen": "FFMnBq_contextChevronOpen",
			"nativeToolbarActions": "FFMnBq_nativeToolbarActions",
			"progressEntries": "FFMnBq_progressEntries",
			"root": "FFMnBq_root",
			"mainContext": "FFMnBq_mainContext",
			"nativeAction": "FFMnBq_nativeAction",
			"stateScreen": "FFMnBq_stateScreen",
			"progressEntry": "FFMnBq_progressEntry",
			"emptyIcon": "FFMnBq_emptyIcon",
			"contextHint": "FFMnBq_contextHint",
			"emptyTitle": "FFMnBq_emptyTitle",
			"errorRow": "FFMnBq_errorRow"
		};
		//#endregion
		//#region src/client/sidechat/NativeConversation.tsx
		const SideContext = (0, react.createContext)(null);
		function renderSideConversation(props, reference, side) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideContext.Provider, {
				value: side,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(props.SessionProvider, {
					session: reference,
					children: props.renderSlot("sidenote.conversation", {})
				})
			});
		}
		function ChatView(props) {
			const side = (0, react.useContext)(SideContext);
			const fold = (0, react.useMemo)(() => createFoldStore(`dsh-sidenote:fold:v1:${side.sessionId}`), [side.sessionId]);
			(0, react.useSyncExternalStore)(fold.subscribe, fold.getSnapshot);
			const expanded = fold.isOpen("inherited");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidechat_module_css_default.chatView,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: sidechat_module_css_default.mainContext,
					"data-sidenote-main-context": true,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: sidechat_module_css_default.historyToggle,
						"aria-expanded": expanded,
						onClick: () => {
							fold.toggle("inherited");
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDownOutline14, {
								size: 12,
								className: expanded ? sidechat_module_css_default.contextChevronOpen : sidechat_module_css_default.contextChevron
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("mainContext") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidechat_module_css_default.contextHint,
								children: side.contextPending ? t("contextAtSend") : side.progress?.takenAt ? t("contextAsOf", { time: side.progress.takenAt }) : t("contextInherited")
							})
						]
					}), expanded && side.progress && side.progress.entries.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.progressEntries,
						"data-sidenote-context-progress": true,
						children: side.progress.entries.map((entry, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: sidechat_module_css_default.progressEntry,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: sidechat_module_css_default.contextHint,
								children: entry.kind === "tool" ? entry.toolName : t(`context${entry.kind}`)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: entry.text })]
						}, index))
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideContext.Provider, {
					value: {
						...side,
						contextExpanded: expanded
					},
					children: props.renderSlot("conversation.session", { view: "chat" })
				})]
			});
		}
		function Content(props) {
			return props.renderFactorySlot("conversation.content", {
				variant: "embedded",
				phase: "active",
				hero: false
			}, { slots: { views: ChatView } });
		}
		/** Only completed, fork-local final answers are eligible for reflow. */
		function finalReplies(messages, boundarySeq = -1, completed) {
			const replies = [];
			let final;
			const finish = () => {
				if (final && !final.streaming && !final.interrupted && final.text.trim() !== "" && (completed === void 0 || final.seq !== void 0 && completed.has(final.seq))) replies.push(final);
			};
			for (const message of messages) {
				if ((message.seq ?? Infinity) <= boundarySeq) continue;
				if (message.role === "user") {
					finish();
					final = void 0;
				} else if (message.role === "assistant") final = message;
				else if (message.role === "error") final = void 0;
			}
			finish();
			return replies;
		}
		function isReplyAdded(side, message, question) {
			const key = `${side.sessionId}:${message.seq ?? message.key}`;
			return side.reflow.list(side.parentSessionId).some((item) => item.sourceKey === key || item.sourceKey === void 0 && item.sideTitle === side.title && item.text === message.text && item.question === question);
		}
		function addReply(side, message, question) {
			if (!isReplyAdded(side, message, question)) side.reflow.add(side.parentSessionId, side.title, message.text, question, `${side.sessionId}:${message.seq ?? message.key}`);
		}
		function ReflowAction(props) {
			const side = (0, react.useContext)(SideContext);
			const state = props.useChat((state) => state);
			const node = state.legacy?.nodes.find((node) => node.messageId === props.messageId);
			if (side === null || !node || !completedReplySeqsOf(state).includes(node.seq)) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReplyAction, {
				side,
				messages: transcriptOf(state.legacy ?? null),
				seq: node.seq
			});
		}
		function ReplyAction({ side, messages, seq }) {
			(0, react.useSyncExternalStore)(side.reflow.subscribe, side.reflow.getSnapshot);
			const reply = finalReplies(messages, side.boundarySeq).find((message) => message.seq === seq);
			if (!reply) return null;
			const question = pairQuestions(messages).get(reply.key);
			const added = isReplyAdded(side, reply, question);
			const label = t(added ? "reflowDone" : "reflowToMain");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				side: "top",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: sidechat_module_css_default.reflowAction,
					"aria-label": label,
					"aria-pressed": added,
					disabled: added,
					onClick: () => {
						addReply(side, reply, question);
					},
					children: added ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline16, { size: 18 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "18",
						height: "18",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.6",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 4v16M20 12H8m5-5-5 5 5 5" })
					})
				})
			});
		}
		function HistoryView({ Original, props, side }) {
			const root = (0, react.useRef)(null);
			const wasExpanded = (0, react.useRef)(side.contextExpanded);
			const nodes = props.useChat((state) => state.nodes);
			const snapshot = props.useConversation((state) => state);
			const groups = snapshot.views.grouped("chat");
			const entries = groups?.entries ?? [];
			const isInherited = (entry) => {
				if (entry.kind === "node") {
					const node = nodes.get(entry.key);
					const seq = node?.kind === "turn-tail" ? node.location?.turn?.start?.seq ?? node.anchorSeq : node?.anchorSeq;
					return seq !== void 0 && seq <= (side.boundarySeq ?? -1);
				}
				const members = groups?.groupSource(entry.key).getSnapshot()?.members ?? [];
				return members.length > 0 && members.every(isInherited);
			};
			const visible = side.contextExpanded ? entries : entries.filter((entry) => !isInherited(entry));
			const projected = {
				...snapshot,
				views: {
					...snapshot.views,
					grouped: (name) => name === "chat" && groups ? {
						...groups,
						entries: visible
					} : snapshot.views.grouped(name)
				}
			};
			const useProjected = (0, react.useCallback)((selector) => selector(projected), [projected]);
			(0, react.useLayoutEffect)(() => {
				const opening = side.contextExpanded && !wasExpanded.current;
				wasExpanded.current = side.contextExpanded;
				if (!opening) return;
				const keys = new Set(entries.filter(isInherited).map((entry) => entry.key));
				let frame = requestAnimationFrame(() => {
					frame = requestAnimationFrame(() => {
						if (!root.current) return;
						const progress = root.current.closest("[data-sidenote-transcript]")?.querySelector("[data-sidenote-context-progress]");
						if (progress) progress.scrollTop = progress.scrollHeight;
						const target = progress ?? lastConversationEntry(root.current, keys);
						if (target) revealConversationEntryEnd(target);
					});
				});
				return () => {
					cancelAnimationFrame(frame);
				};
			}, [side.contextExpanded]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: root,
				className: sidechat_module_css_default.historyView,
				children: (0, react.createElement)(Original, {
					...props,
					useConversation: useProjected
				})
			});
		}
		/** Both admitted hosts publish the native chat View; only 0.2.1 adds a Flow slot. */
		function registerInheritedHistory(ctx) {
			const slots = ctx.slots;
			ctx.slots.inject("conversation.view", () => {
				const patched = /* @__PURE__ */ new Map();
				const patch = () => {
					for (const entry of slots.entries("conversation.view")) {
						if (entry.options.id !== "chat" || entry.options.priority === 1e4 || patched.has(entry)) continue;
						const Original = entry.component;
						function ScopedView(props) {
							const side = (0, react.useContext)(SideContext);
							return side === null ? (0, react.createElement)(Original, props) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HistoryView, {
								Original,
								props,
								side
							});
						}
						entry.component = ScopedView;
						patched.set(entry, {
							original: Original,
							wrapped: ScopedView
						});
					}
				};
				patch();
				const off = slots.subscribe("conversation.view", patch);
				const refresh = () => {
					if (slots.entries("conversation.view").length > 0) ctx.slots.register({
						name: "conversation.view",
						id: "chat",
						priority: 1e4
					}, () => null)();
				};
				refresh();
				return () => {
					off();
					for (const [entry, value] of patched) if (entry.component === value.wrapped) entry.component = value.original;
					refresh();
				};
			});
		}
		/** Preserve existing annotation anchors while the host owns the complete message renderer. */
		function registerAssistantAnchors(ctx) {
			const slots = ctx.slots;
			ctx.slots.inject("conversation.chat.node", () => {
				const patched = /* @__PURE__ */ new Map();
				const patch = () => {
					for (const entry of slots.entries("conversation.chat.node")) {
						if (entry.options.key !== "assistant-step" || patched.has(entry)) continue;
						const Original = entry.component;
						function AnchoredAssistant(props) {
							const side = (0, react.useContext)(SideContext);
							const content = (0, react.createElement)(Original, props);
							if (!side) return content;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								"data-sidenote-quote-body": true,
								"data-sidenote-message-role": "assistant",
								"data-sidenote-message-key": `a:${props.node.data.finalNode?.seq ?? props.node.anchorSeq}`,
								"data-sidenote-streaming": props.node.data.status === "running" ? "true" : "false",
								children: content
							});
						}
						entry.component = AnchoredAssistant;
						patched.set(entry, {
							original: Original,
							wrapped: AnchoredAssistant
						});
					}
				};
				patch();
				const off = slots.subscribe("conversation.chat.node", patch);
				return () => {
					off();
					for (const [entry, value] of patched) if (entry.component === value.wrapped) entry.component = value.original;
				};
			});
		}
		function registerNativeConversation(ctx) {
			ctx.slots.inject("sidenote.conversation", () => ctx.slots.register({ name: "sidenote.conversation" }, Content));
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "dsh-sidenote-reflow",
				order: 100
			}, ReflowAction));
			registerInheritedHistory(ctx);
			registerAssistantAnchors(ctx);
		}
		//#endregion
		//#region src/client/sidechat/composer.ts
		/** Programmatic draft handoff only. The embedded native composer owns editing and submission. */
		function resolveSessionInput(ctx, sessionId) {
			return resolveInput(ctx, sessionId) ?? null;
		}
		function useComposer(ctx, session, sessionId) {
			const diagnostics = hostDiagnostics(ctx);
			const hostState = (0, react.useSyncExternalStore)(diagnostics.subscribe, diagnostics.getSnapshot);
			const input = (0, react.useMemo)(() => sessionId === void 0 ? null : resolveSessionInput(ctx, sessionId), [
				ctx,
				session,
				sessionId,
				hostState
			]);
			const subscribe = (0, react.useCallback)((notify) => input?.state.subscribe(notify) ?? (() => {}), [input]);
			const pending = (0, react.useSyncExternalStore)(subscribe, () => {
				const state = input?.state.getSnapshot();
				return state !== void 0 && (state.phase !== "plain" || (state.queue?.length ?? 0) > 0);
			});
			const hasDraft = (0, react.useSyncExternalStore)(subscribe, () => input !== null && (readInputDraft(input).trim() !== "" || inputAttachmentIds(input).length > 0));
			const appendDraft = (0, react.useCallback)((text) => {
				if (input !== null) input.setDraft(appendDraftText(readInputDraft(input), text));
			}, [input]);
			return {
				machine: input !== null,
				pending,
				hasDraft,
				appendDraft
			};
		}
		//#endregion
		//#region src/client/sidechat/rows.tsx
		function StateScreen(props) {
			useLocaleTick();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidechat_module_css_default.stateScreen,
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.emptyIcon,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconNewChatOutline16, { size: 32 })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.emptyTitle,
						children: props.title
					}),
					props.detail && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.stateDetail,
						role: "alert",
						children: props.detail
					}),
					props.hint && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.emptyText,
						children: props.hint
					})
				]
			});
		}
		//#endregion
		//#region src/client/sidechat/native.ts
		/** Native tab id → live panel. Native layouts are memory-only, so is this. */
		const liveSideChats = /* @__PURE__ */ new Map();
		const panelKey = (sessionId, tabId) => JSON.stringify([sessionId, tabId]);
		const liveListeners = /* @__PURE__ */ new Set();
		function notifyLiveSideChats() {
			for (const listener of [...liveListeners]) listener();
		}
		function subscribeLiveSideChats(listener) {
			liveListeners.add(listener);
			return () => {
				liveListeners.delete(listener);
			};
		}
		/**
		* tabId → 首次注册序号（打开序的近似）。tab.id 跨重挂载稳定，重注册不改写
		* ——遍历 Map 的插入序会随重挂漂移，「最近打开」只能锚在首次序号上。
		*/
		const birthOrder = /* @__PURE__ */ new Map();
		let birthSeq = 0;
		/**
		* Publish a mounted panel so programmatic entry points can focus it and seed
		* its draft. Returns the disposer for the panel's effect cleanup.
		*/
		function registerLiveSideChat(sessionId, tabId, seedDraft, readMeta, readTitle, readStatus = () => ({ phase: "loading" })) {
			const entry = {
				tabId,
				sessionId,
				seedDraft,
				readMeta,
				readTitle,
				readStatus
			};
			const key = panelKey(sessionId, tabId);
			liveSideChats.set(key, entry);
			if (!birthOrder.has(key)) birthOrder.set(key, ++birthSeq);
			const opening = openings.get(sessionId);
			if (opening !== void 0) {
				opening.target = entry;
				openings.delete(sessionId);
				for (const draft of opening.drafts) seedDraft(draft);
			}
			notifyLiveSideChats();
			return () => {
				if (liveSideChats.get(key) === entry) liveSideChats.delete(key);
				notifyLiveSideChats();
			};
		}
		/** 标记失效应力：openTab 被静默拒绝/面板未挂载时，超时后允许重试。 */
		const OPENING_TTL_MS = 1e4;
		const openings = /* @__PURE__ */ new Map();
		/** 标记一次已发起、面板尚未注册的 native 打开（create/reopen 铸造后调用）。 */
		function markSideChatOpening(sessionId) {
			openings.set(sessionId, {
				at: Date.now(),
				drafts: []
			});
		}
		/** 进行中的打开；TTL 外视为 openTab 被拒/面板未挂载，清除并返回 undefined。 */
		function sideChatOpening(sessionId) {
			const mark = openings.get(sessionId);
			if (mark === void 0) return void 0;
			if (Date.now() - mark.at > OPENING_TTL_MS) {
				openings.delete(sessionId);
				return;
			}
			return mark;
		}
		/** Live panel for a native tab id (undefined for legacy layout tabs). */
		function liveSideChat(tabId, sessionId) {
			if (sessionId !== void 0) return liveSideChats.get(panelKey(sessionId, tabId));
			const candidates = [...liveSideChats.values()].filter((panel) => panel.tabId === tabId);
			return candidates.length === 1 ? candidates[0] : void 0;
		}
		/** 一个会话的全部存活面板（按打开序升序；native 下枚举 side tab 的唯一数据源）。 */
		function liveSideChatsOf(sessionId) {
			return [...liveSideChats.values()].filter((entry) => entry.sessionId === sessionId).sort((a, b) => (birthOrder.get(panelKey(a.sessionId, a.tabId)) ?? 0) - (birthOrder.get(panelKey(b.sessionId, b.tabId)) ?? 0));
		}
		/**
		* Most recently OPENED live panel of a session — the open-or-focus target
		* when the legacy snapshot cannot see the tab (mirrors "last opened wins").
		* 排序锚在首次注册序号上：面板重挂载不翻序（见 birthOrder）。
		*/
		function lastLiveSideChat(sessionId) {
			const all = liveSideChatsOf(sessionId);
			return all[all.length - 1];
		}
		/** 插件卸载/重载时清场（apply 的 ctx.effect disposer 调用）。 */
		function clearNativeRuntime() {
			clearRootContext();
			liveSideChats.clear();
			openings.clear();
			birthOrder.clear();
			notifyLiveSideChats();
		}
		/** Native tab shell for reads that go through the layout snapshot (`readTab`). */
		function nativeTabShell(tabId, type, sessionId) {
			const entry = liveSideChat(tabId, sessionId);
			if (entry === void 0) return void 0;
			return {
				id: entry.tabId,
				type,
				title: "",
				meta: entry.readMeta()
			};
		}
		//#endregion
		//#region src/client/sidechat/metaStore.ts
		const KEY_PREFIX$1 = "dsh-sidenote:side-meta:v1:";
		const restorationCandidates = /* @__PURE__ */ new Map();
		function takeRestoredSideChatMeta(sessionId, tabId) {
			const key = keyOf(sessionId, tabId);
			const meta = restorationCandidates.get(key);
			restorationCandidates.delete(key);
			return meta;
		}
		/**
		* 本页面生命周期 id。**挂在 window 上**（审查 m3）：模块级铸造会在插件
		* HMR/重载时换模块实例 → 新 runId 触发孤键清扫误删本页活记录。window
		* 级持有跨模块重载稳定；页面刷新（真正的清扫时机）window 重建。
		*/
		const SIDENOTE_RUN_ID = (() => {
			if (typeof window !== "undefined") {
				const w = window;
				if (w.__dshSidenoteRunId === void 0) w.__dshSidenoteRunId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
				return w.__dshSidenoteRunId;
			}
			return `run-ssr-${Math.random().toString(36).slice(2)}`;
		})();
		function keyOf(sessionId, tabId) {
			return `${KEY_PREFIX$1}${sessionId}:${tabId}`;
		}
		function revive(value) {
			if (typeof value !== "object" || value === null) return null;
			const r = value;
			if (typeof r.sessionId !== "string" || r.sessionId === "") return null;
			if (typeof r.tabId !== "string" || r.tabId === "") return null;
			if (typeof r.number !== "number") return null;
			return {
				tabId: r.tabId,
				sessionId: r.sessionId,
				...typeof r.childId === "string" ? { childId: r.childId } : {},
				...typeof r.parentSessionId === "string" ? { parentSessionId: r.parentSessionId } : {},
				...typeof r.pendingDraft === "string" ? { pendingDraft: r.pendingDraft } : {},
				...typeof r.boundarySeq === "number" && Number.isFinite(r.boundarySeq) ? { boundarySeq: r.boundarySeq } : {},
				...r.forkedMidTurn === true ? { forkedMidTurn: true } : {},
				...r.snapshotOnly === true ? { snapshotOnly: true } : {},
				...typeof r.leakedPromptPrefix === "string" ? { leakedPromptPrefix: r.leakedPromptPrefix } : {},
				...r.inheritedPurged === true ? { inheritedPurged: true } : {},
				...typeof r.topic === "string" && r.topic !== "" ? { topic: r.topic } : {},
				number: r.number,
				createdAt: typeof r.createdAt === "number" ? r.createdAt : 0,
				...typeof r.runId === "string" ? { runId: r.runId } : {}
			};
		}
		function storage() {
			return typeof localStorage === "undefined" ? null : localStorage;
		}
		let version = 0;
		const listeners$1 = /* @__PURE__ */ new Set();
		function notify() {
			version += 1;
			for (const fn of [...listeners$1]) fn();
		}
		/** useSyncExternalStore 三件套。 */
		const sideChatMetaStore = {
			getSnapshot: () => version,
			subscribe(fn) {
				listeners$1.add(fn);
				return () => {
					listeners$1.delete(fn);
				};
			}
		};
		/** 渲染期静默写后的补通知（面板 reconcile 用——render 期写不能 notify）。 */
		function notifySideChatMetaListeners() {
			notify();
		}
		function readSideChatMeta(sessionId, tabId) {
			const store = storage();
			if (store === null) return void 0;
			try {
				const raw = store.getItem(keyOf(sessionId, tabId));
				if (raw === null) return void 0;
				return revive(JSON.parse(raw)) ?? void 0;
			} catch {
				return;
			}
		}
		/** 写/合并一个 tab 的 meta（整体替换语义由调用方组合：先读再写）。 */
		function writeSideChatMeta(record, options) {
			const store = storage();
			if (store === null) return;
			try {
				store.setItem(keyOf(record.sessionId, record.tabId), JSON.stringify(record));
				if (options?.silent !== true) notify();
			} catch {}
		}
		function dropSideChatMeta(sessionId, tabId) {
			const store = storage();
			if (store === null) return;
			try {
				store.removeItem(keyOf(sessionId, tabId));
				notify();
			} catch {}
		}
		/** 枚举一个主会话的全部 meta 记录（按创建序升序）。 */
		function sideChatMetasOf(sessionId) {
			return sideChatMetasAll().filter((r) => r.sessionId === sessionId).sort((a, b) => a.createdAt - b.createdAt);
		}
		/** 枚举全部存活记录（跨会话；完成通知等全局监听用）。 */
		function sideChatMetasAll() {
			const store = storage();
			if (store === null) return [];
			try {
				const out = [];
				for (let i = 0; i < store.length; i += 1) {
					const key = store.key(i);
					if (typeof key !== "string" || !key.startsWith(KEY_PREFIX$1)) continue;
					const record = revive(JSON.parse(store.getItem(key) ?? "null"));
					if (record !== null) out.push(record);
				}
				return out;
			} catch {
				return [];
			}
		}
		/**
		* 下一个实例编号：当前会话存活记录的最大编号 + 1。
		* 单实例期调用方保证同会话同时至多一条存活记录（held 规则），
		* 此函数为 Delivery_02 的多实例预留正确语义。
		*/
		function nextSideChatNumber(sessionId) {
			const existing = sideChatMetasOf(sessionId);
			return existing.length === 0 ? 1 : Math.max(...existing.map((r) => r.number)) + 1;
		}
		/**
		* 孤键清扫：删掉 runId 与本页面生命周期不匹配的记录（上一页面周期的
		* 残留）。插件 apply 时调用一次；撤掉活身份，等待实际恢复记录认领。
		* 返回清扫数。
		*/
		function sweepOrphanedSideChatMeta() {
			const store = storage();
			if (store === null) return 0;
			try {
				const staleKeys = [];
				for (let i = 0; i < store.length; i += 1) {
					const key = store.key(i);
					if (typeof key !== "string" || !key.startsWith(KEY_PREFIX$1)) continue;
					const record = revive(JSON.parse(store.getItem(key) ?? "null"));
					if (record === null || record.runId !== SIDENOTE_RUN_ID) {
						if (record !== null) restorationCandidates.set(key, record);
						staleKeys.push(key);
					}
				}
				for (const key of staleKeys) store.removeItem(key);
				if (staleKeys.length > 0) notify();
				return staleKeys.length;
			} catch {
				return 0;
			}
		}
		//#endregion
		//#region src/client/sidechat/identity.ts
		/**
		* 侧边聊天的内容身份（Delivery_05）：编号（「侧边 2」）是存活序——回答
		* 「现在打开着的是哪个」，聊天一关闭就失去指称；native 单实例下编号恒为
		* 1，身份随之整体塌方（关闭列表五行全叫「侧边」的实证）。
		*
		* 身份 = 首条用户消息摘要（topic），sticky——侧边聊天是单主题支线，
		* 首条消息即意图；只认首条，不随对话漂移。本模块是唯一计算源：
		* 芯片标题、通知、@引用、菜单聚焦/重开行、关闭列表全部从这里取。
		*
		* L0 纯函数，react-free。
		*/
		/** 标题里 topic 段的最大码点数（CJK 安全截断）。 */
		const TOPIC_MAX = 20;
		/**
		* 首条用户消息 → topic。折叠全部空白（含换行）为单空格，截 20 码点，
		* 超长加省略号；清洗后为空返回 undefined（调用方回退编号标题）。
		* 已落盘消息也会用于恢复主题；先剥离快照及批注/回流协议。
		* 划选提问的种子草稿是「> 引用行 + note 行」（buildSideChatQuote）：
		* 引用行剥除（用户自己的话才是主题），机械占位行（noNote）丢弃；
		* 剥完为空（未补充直接发送）时退回引用内容——引用即主题。
		*/
		function topicOf(text) {
			text = splitSnapshotPrefix(text)?.rest ?? text;
			const protocol = splitProtocolPrefix(text);
			if (protocol) text = text.slice(protocol.length).trim() || protocol.annotations.map((item) => item.note || item.quote).join(" ") || protocol.reflows.map((item) => item.source).join(" ");
			const lines = text.split("\n");
			const clean = lines.filter((l) => !l.startsWith(">")).filter((l) => l.trim() !== t("noNote")).join(" ").replaceAll(/\s+/gu, " ").trim();
			if (clean !== "") return truncate(clean);
			return truncate(lines.filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/u, "")).join(" "));
		}
		/** 空白折叠 + 20 码点截断；空 → undefined。 */
		function truncate(text) {
			const clean = text.replaceAll(/\s+/gu, " ").trim();
			if (clean === "") return void 0;
			const chars = Array.from(clean);
			return chars.length <= TOPIC_MAX ? clean : `${chars.slice(0, TOPIC_MAX).join("")}…`;
		}
		/**
		* 侧边聊天标题：topic 优先（「侧边 · {topic}」），缺席回退编号
		* （「侧边」/「侧边 N」——单实例期恒前者）。
		*/
		function sideChatTitleOf(meta) {
			if (meta?.topic !== void 0 && meta.topic !== "") return `${t("tabBaseTitle")} · ${meta.topic}`;
			if (meta === void 0 || meta.number <= 1) return t("tabBaseTitle");
			return `${t("tabBaseTitle")} ${meta.number}`;
		}
		/**
		* 关闭时刻的相对时间（重开行 detail）：刚刚 / N 分钟前 / N 小时前 /
		* 昨天 / M月d日（跨年带年）。小时档只用于当天（日历日）；跨过午夜即落
		* 「昨天」——日历语义比「15 小时前」更好认。手写五档，不引依赖。
		*/
		function formatClosedAt(closedAt, now = Date.now()) {
			const diff = now - closedAt;
			if (diff < 6e4) return t("closedJustNow");
			if (diff < 36e5) return t("closedMinutesAgo", { n: Math.floor(diff / 6e4) });
			const then = new Date(closedAt);
			const today = new Date(now);
			if (then.getFullYear() === today.getFullYear() && then.getMonth() === today.getMonth() && then.getDate() === today.getDate()) return t("closedHoursAgo", { n: Math.floor(diff / 36e5) });
			const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
			if (then.getFullYear() === yesterday.getFullYear() && then.getMonth() === yesterday.getMonth() && then.getDate() === yesterday.getDate()) return t("closedYesterday");
			if (then.getFullYear() === today.getFullYear()) return t("closedOnDate", {
				month: then.getMonth() + 1,
				day: then.getDate()
			});
			return t("closedOnDateYear", {
				year: then.getFullYear(),
				month: then.getMonth() + 1,
				day: then.getDate()
			});
		}
		//#endregion
		//#region src/client/sidechat/open.ts
		/** 直连腿判定：directNativeLeg（BS ≥0.19 或 BS 缺席）+ 原生面已就位。 */
		function directLeg(ctx) {
			return directNativeLeg(ctx) && sidebarRightOf(ctx) !== void 0;
		}
		/** 直连腿：向既存 tab 追加待投递草稿（面板 pendingDraft effect 消费）。 */
		function appendNativePendingDraft(sessionId, tabId, draftText) {
			const meta = readSideChatMeta(sessionId, tabId);
			if (meta === void 0) return;
			writeSideChatMeta({
				...meta,
				pendingDraft: appendDraftText(meta.pendingDraft ?? "", draftText)
			});
		}
		/**
		* 从最新快照读一个 Tab（meta 合并写入前的读取面；布局即注册表）。
		* 直连腿：metaStore 是 meta 权威（原生布局无 meta 面）。
		*/
		function readTab(ctx, sessionId, tabId) {
			const direct = readSideChatMeta(sessionId, tabId);
			if (direct !== void 0) {
				const live = liveSideChatsOf(sessionId).find((entry) => entry.tabId === tabId);
				return {
					id: tabId,
					type: SIDE_TAB_TYPE,
					title: live?.readTitle() ?? sideChatTitleOf(direct),
					meta: direct
				};
			}
			const legacySnap = betterSidebarOf(ctx)?.getSnapshot();
			return collectTabs(legacySnap?.state).find((candidate) => candidate.id === tabId) ?? nativeTabShell(tabId, "dsh-sidenote:side", sessionId);
		}
		/**
		* 为 sessionId 新建或聚焦一个侧边聊天 Tab；draftText 给出时写入其草稿。
		* @returns false = 未能打开（调用方保持自己的流程）。
		*/
		function openOrFocusSideChat(ctx, sessionId, draftText) {
			if (directLeg(ctx)) return openOrFocusDirect(ctx, sessionId, draftText);
			return openOrFocusLegacy(ctx, sessionId, draftText);
		}
		/** 直连腿：聚焦既有（三级数据源）或铸造新开。 */
		function openOrFocusDirect(ctx, sessionId, draftText) {
			try {
				if (currentSessionIdOf(ctx) !== sessionId) return false;
				const hasDraft = draftText !== void 0 && draftText !== "";
				const live = lastLiveSideChat(sessionId);
				if (live !== void 0) {
					if (hasDraft) live.seedDraft(draftText);
					if (!focusNativeTab(ctx, live.tabId)) sidebarRightOf(ctx)?.focus(live.tabId);
					return true;
				}
				const opening = sideChatOpening(sessionId);
				if (opening !== void 0) {
					if (hasDraft) opening.drafts.push(draftText);
					return true;
				}
				const metas = sideChatMetasOf(sessionId);
				const target = metas[metas.length - 1];
				if (target !== void 0 && hasDraft) appendNativePendingDraft(sessionId, target.tabId, draftText);
				sidebarRightOf(ctx).openTab(SIDE_TAB_TYPE, { params: {
					parentSessionId: sessionId,
					...hasDraft && target === void 0 ? { pendingDraft: draftText } : {}
				} });
				markSideChatOpening(sessionId);
				return true;
			} catch (error) {
				console.warn("[dsh-sidenote] 打开侧边聊天失败:", error);
				return false;
			}
		}
		/** legacy 腿：布局快照即注册表的原始路径（BS < 0.19）。 */
		function openOrFocusLegacy(ctx, sessionId, draftText) {
			const bs = betterSidebarOf(ctx);
			if (bs === void 0) return false;
			try {
				const snapshot = bs.getSnapshot();
				if (snapshot.sessionId !== sessionId || snapshot.state === void 0) return false;
				const existing = collectSideTabs(snapshot.state);
				const live = lastLiveSideChat(sessionId);
				if (live !== void 0) {
					if (draftText !== void 0 && draftText !== "") live.seedDraft(draftText);
					if (!focusNativeTab(ctx, live.tabId)) bs.activateTab(live.tabId, { sessionId });
					return true;
				}
				if (existing.length > 0) {
					const target = existing[existing.length - 1];
					if (draftText !== void 0 && draftText !== "") {
						const meta = parseSideChatMeta(target.meta);
						const input = meta.childId === void 0 ? null : resolveSessionInput(ctx, meta.childId);
						if (input !== null) input.setDraft(appendDraftText(readInputDraft(input), draftText));
						else bs.updateTab(target.id, { meta: {
							...meta,
							pendingDraft: appendDraftText(meta.pendingDraft ?? "", draftText)
						} });
					}
					bs.activateTab(target.id, { sessionId });
					return true;
				}
				const opening = sideChatOpening(sessionId);
				if (opening !== void 0) {
					if (draftText !== void 0 && draftText !== "") opening.drafts.push(draftText);
					return true;
				}
				return createSideChat(ctx, sessionId, draftText);
			} catch (error) {
				console.warn("[dsh-sidenote] 打开侧边聊天失败:", error);
				return false;
			}
		}
		/**
		* 无条件新建一个侧边聊天 Tab（/side「新建侧边聊天」选项的语义）。
		* 直连腿（单实例期）：折叠为「聚焦既有 + 草稿正确投递」（= openOrFocus；
		* 多实例随 Delivery_02 的 multiple 放开）。
		* @returns false = 未能创建（调用方保持自己的流程）。
		*/
		function createSideChat(ctx, sessionId, draftText) {
			if (directLeg(ctx)) return openOrFocusDirect(ctx, sessionId, draftText);
			return createSideChatLegacy(ctx, sessionId, draftText);
		}
		function createSideChatLegacy(ctx, sessionId, draftText) {
			const bs = betterSidebarOf(ctx);
			if (bs === void 0) return false;
			try {
				const snapshot = bs.getSnapshot();
				if (snapshot.sessionId !== sessionId || snapshot.state === void 0) return false;
				if (!bs.isTabEnabled("dsh-sidenote:side")) return false;
				const before = new Set(collectTabs(snapshot.state).map((tab) => tab.id));
				const seed = draftText !== void 0 && draftText !== "" ? {
					type: SIDE_TAB_TYPE,
					meta: { pendingDraft: draftText }
				} : { type: SIDE_TAB_TYPE };
				bs.openTab(seed, { sessionId });
				const created = collectSideTabs(bs.getSnapshot().state).find((tab) => !before.has(tab.id));
				if (created === void 0) {
					if (!nativeSidebarHost(ctx)) return false;
					markSideChatOpening(sessionId);
					return true;
				}
				if (draftText !== void 0 && draftText !== "") bs.updateTab(created.id, { meta: { pendingDraft: draftText } });
				return true;
			} catch (error) {
				console.warn("[dsh-sidenote] 新建侧边聊天失败:", error);
				return false;
			}
		}
		/**
		* 桥接/命令的目标预览：askInSideChat 此时若执行会落在哪个 Tab 的标题
		* （既有并存 = 最后一个；无 = 即将新建的首个标题）。用于编辑器上标明
		* 「发送至：侧边 N」。会话不在屏上/状态缺失时返回 undefined。
		*/
		function sideChatTargetTitle(ctx, sessionId) {
			try {
				if (directLeg(ctx)) {
					if (currentSessionIdOf(ctx) !== sessionId) return void 0;
					const live = lastLiveSideChat(sessionId);
					if (live !== void 0) return live.readTitle();
					const metas = sideChatMetasOf(sessionId);
					const last = metas[metas.length - 1];
					if (last !== void 0) return sideChatTitleOf(last);
					return t("tabBaseTitle");
				}
				const snapshot = betterSidebarOf(ctx)?.getSnapshot();
				if (snapshot === void 0 || snapshot.sessionId !== sessionId || snapshot.state === void 0) return void 0;
				const existing = collectSideTabs(snapshot.state);
				if (existing.length > 0) return existing[existing.length - 1].title;
				const live = lastLiveSideChat(sessionId);
				if (live !== void 0) return live.readTitle();
				return sideTabTitle([]);
			} catch {
				return;
			}
		}
		/**
		* 重开最近关闭的侧边聊天（D3 后悔药）：开 Tab + meta 预置 childId/
		* parentSessionId——面板挂载后走绑定恢复路径（不重新 fork）。
		* 会话本体必须仍 archived 在列（若被清理，面板落「会话已不存在」态——
		* 有现成错误态兜着）。
		* opts.topic（Delivery_05）：内容身份随恢复走——否则重开后 reconcile
		* 铸造的是无 topic 的新记录，身份丢一次关闭就回不来了。
		*/
		function reopenSideChat(ctx, sessionId, childId, opts) {
			if (directLeg(ctx)) try {
				if (currentSessionIdOf(ctx) !== sessionId) return false;
				if (sideChatMetasOf(sessionId).length > 0) return false;
				sidebarRightOf(ctx).openTab(SIDE_TAB_TYPE, { params: {
					parentSessionId: sessionId,
					childId,
					...opts?.savedMeta !== void 0 ? { savedMeta: opts.savedMeta } : {},
					...opts?.topic !== void 0 ? { topic: opts.topic } : {}
				} });
				markSideChatOpening(sessionId);
				return true;
			} catch (error) {
				console.warn("[dsh-sidenote] 重开侧边聊天失败:", error);
				return false;
			}
			const bs = betterSidebarOf(ctx);
			if (bs === void 0) return false;
			try {
				const snapshot = bs.getSnapshot();
				if (snapshot.sessionId !== sessionId || snapshot.state === void 0) return false;
				if (!bs.isTabEnabled("dsh-sidenote:side")) return false;
				if (nativeSidebarHost(ctx) && liveSideChatsOf(sessionId).length > 0) return false;
				const before = new Set(collectTabs(snapshot.state).map((tab) => tab.id));
				const meta = {
					...opts?.savedMeta,
					childId,
					parentSessionId: sessionId,
					...opts?.topic !== void 0 ? { topic: opts.topic } : {}
				};
				const title = opts?.title ?? (opts?.topic !== void 0 ? sideChatTitleOf({
					number: 1,
					topic: opts.topic
				}) : void 0);
				bs.openTab({
					type: SIDE_TAB_TYPE,
					...title !== void 0 ? { title } : {},
					meta
				}, { sessionId });
				const created = collectSideTabs(bs.getSnapshot().state).find((tab) => !before.has(tab.id));
				if (created === void 0) {
					if (!nativeSidebarHost(ctx)) return false;
					markSideChatOpening(sessionId);
					return true;
				}
				bs.updateTab(created.id, {
					...title !== void 0 ? { title } : {},
					meta
				});
				return true;
			} catch (error) {
				console.warn("[dsh-sidenote] 重开侧边聊天失败:", error);
				return false;
			}
		}
		//#endregion
		//#region src/client/sidechat/snapshot.ts
		/** Read the plugin's persisted progress block as plain, expandable content. */
		function snapshotEntriesFromText(text) {
			const kinds = {
				"user-request": "request",
				reply: "reply",
				thinking: "thinking",
				"tool-call": "tool",
				streaming: "streaming"
			};
			return [...text.matchAll(/<(user-request|reply|thinking|tool-call|streaming)(?: name="([^"]*)")?>([\s\S]*?)<\/\1>/g)].map((match) => ({
				kind: kinds[match[1]],
				text: match[3].trim(),
				...match[2] ? { toolName: match[2] } : {}
			}));
		}
		function blocksText(blocks, kinds) {
			if (!Array.isArray(blocks)) return "";
			const parts = [];
			for (const block of blocks) {
				if (typeof block !== "object" || block === null) continue;
				const b = block;
				const kind = b.kind ?? b.type;
				if (kind !== void 0 && kinds.includes(kind) && typeof b.text === "string") parts.push(b.text);
			}
			return parts.join("\n");
		}
		function contentText(content) {
			return blocksText(content, ["text"]);
		}
		/**
		* 投影 nodes → 当前 turn 的快照拍序列。纯函数（node 可测）。
		*
		* 当前 turn 起点 = 最后一个 user 节点（在飞 turn 的任务消息）。注意：压缩
		* 摘要在投影里也是 user 形态节点（<compacted-summary> 框定的替换消息）——
		* 若最后一个 user 节点是摘要，从它取起同样正确（摘要即主线模型此刻的上下文
		* 头部）。起点之后：assistant 拆思考/正文两拍，tool-result 成拍，其余节点
		* （context 注入、系统面）不入快照。
		*/
		function snapshotEntriesOf(nodes, partial) {
			let start = -1;
			for (let i = nodes.length - 1; i >= 0; i -= 1) {
				const n = nodes[i];
				if (n?.kind === "user" || n?.kind === "steering") {
					start = i;
					break;
				}
			}
			if (start < 0) return [];
			const entries = [];
			for (const node of nodes.slice(start)) {
				const n = node;
				switch (n.kind) {
					case "user":
					case "steering": {
						const text = contentText(n.content);
						if (text !== "") entries.push({
							kind: "request",
							text
						});
						break;
					}
					case "assistant": {
						const thinking = blocksText(n.blocks, ["reasoning"]);
						const reply = blocksText(n.blocks, ["text"]);
						if (thinking !== "") entries.push({
							kind: "thinking",
							text: thinking
						});
						if (reply !== "") entries.push({
							kind: "reply",
							text: reply
						});
						break;
					}
					case "tool-result": {
						const call = n.call;
						const name = typeof call?.name === "string" ? call.name : "tool";
						const args = typeof call?.argsRaw === "string" ? call.argsRaw : "";
						const result = contentText(n.content);
						entries.push({
							kind: "tool",
							toolName: name,
							text: args === "" ? result : `调用：${args}\n${result}`
						});
						break;
					}
				}
			}
			const streaming = typeof partial === "string" ? partial : contentText(partial?.blocks);
			if (streaming !== "") entries.push({
				kind: "streaming",
				text: streaming
			});
			return entries;
		}
		/** 拍序列 → 协议块文本（拼进首条侧边消息前缀的形态）。 */
		function serializeSnapshot(entries, takenAt) {
			const pad = (v) => String(v).padStart(2, "0");
			return `<mainline-progress-snapshot taken-at="${`${takenAt.getFullYear()}-${pad(takenAt.getMonth() + 1)}-${pad(takenAt.getDate())} ${pad(takenAt.getHours())}:${pad(takenAt.getMinutes())}`}">
你是从主线会话 fork 出的侧边会话。主线有一个任务正在执行中——它在你 fork 时正在进行，所以以「已中断」形态出现在上面的历史末尾（那只是快照切点，主线本体仍在正常运行）。以下是主线该任务截至此刻的实时进展（与主线模型当前可见的上下文一致）：

${entries.map((entry) => {
				switch (entry.kind) {
					case "request": return `<user-request>\n${entry.text}\n</user-request>`;
					case "reply": return `<reply>\n${entry.text}\n</reply>`;
					case "thinking": return `<thinking>\n${entry.text}\n</thinking>`;
					case "tool": return `<tool-call name="${entry.toolName ?? "tool"}">\n${entry.text}\n</tool-call>`;
					case "streaming": return `<streaming>\n${entry.text}\n（主线正在输出中）</streaming>`;
				}
			}).join("\n\n")}
</mainline-progress-snapshot>`;
		}
		/** 协议块标记（WI-03 呈现层据此把快照从气泡提升到继承卡）。 */
		const SNAPSHOT_BLOCK_MARK = "<mainline-progress-snapshot";
		/**
		* 现取主线当前 turn 的进展快照块。无任何在飞内容（主线恰在两轮之间等）
		* 返回 null（调用方跳过拼接）。
		*/
		function buildMainlineSnapshot(ctx, parentSessionId, now = /* @__PURE__ */ new Date()) {
			try {
				const snap = chatSourceOf(ctx, ctx.sessions.binding(parentSessionId))?.getLegacy();
				if (snap === void 0 || snap === null) return null;
				const entries = snapshotEntriesOf(snap.nodes ?? [], snap.partial);
				if (entries.length === 0) return null;
				return serializeSnapshot(entries, now);
			} catch {
				return null;
			}
		}
		//#endregion
		//#region src/client/host/sessionVisibility.ts
		const KEY = "dsh-sidenote:side-sessions:v1";
		function readSaved() {
			try {
				const record = JSON.parse(localStorage.getItem(KEY) ?? "{}");
				return {
					ids: Array.isArray(record?.ids) ? record.ids.filter((id) => typeof id === "string" && id !== "") : [],
					show: record?.show === true,
					saved: true
				};
			} catch {
				return {
					ids: [],
					show: false,
					saved: false
				};
			}
		}
		/** Browser-local identity outlives tabs and the capped recent-closed menu. */
		function createSessionVisibility() {
			const initial = readSaved();
			let snapshot = {
				hidden: new Set(initial.ids),
				pending: [],
				show: initial.show,
				saved: initial.saved
			};
			const listeners = /* @__PURE__ */ new Set();
			const notify = () => {
				for (const fn of [...listeners]) fn();
			};
			const persist = (hidden, show) => {
				let saved = true;
				try {
					localStorage.setItem(KEY, JSON.stringify({
						ids: [...hidden],
						show
					}));
				} catch {
					saved = false;
				}
				snapshot = {
					...snapshot,
					hidden,
					show,
					saved
				};
				notify();
			};
			return {
				getSnapshot: () => snapshot,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				hide(...ids) {
					const hidden = /* @__PURE__ */ new Set([
						...snapshot.hidden,
						...readSaved().ids,
						...ids
					]);
					if (hidden.size !== snapshot.hidden.size) persist(hidden, snapshot.show);
				},
				setShow(show) {
					persist(/* @__PURE__ */ new Set([...snapshot.hidden, ...readSaved().ids]), show);
				},
				watch() {
					const onStorage = (event) => {
						if (event.key !== KEY && event.key !== null) return;
						const next = readSaved();
						snapshot = {
							...snapshot,
							hidden: new Set(next.ids),
							show: next.show,
							saved: next.saved
						};
						notify();
					};
					window.addEventListener("storage", onStorage);
					return () => {
						window.removeEventListener("storage", onStorage);
					};
				},
				/** Start before fork/create: host list events may precede the RPC response. */
				begin(list) {
					const ids = Array.isArray(list.ids) ? list.ids : Object.keys(list.byId ?? {});
					const known = new Set(ids);
					snapshot = {
						...snapshot,
						pending: [...snapshot.pending, known]
					};
					notify();
					let finished = false;
					return () => {
						if (finished) return;
						finished = true;
						snapshot = {
							...snapshot,
							pending: snapshot.pending.filter((value) => value !== known)
						};
						notify();
					};
				}
			};
		}
		/** Filter only the WorkspaceBrowser's input; bindings and global stores stay intact. */
		function visibleSessionList(list, visibility) {
			if (visibility.show || list === null || typeof list !== "object") return list;
			const source = list;
			if (!Array.isArray(source.ids) || source.byId === null || typeof source.byId !== "object") return list;
			const hidden = (id) => visibility.hidden.has(id) || visibility.pending.some((known) => !known.has(id));
			const byId = source.byId;
			if (!Object.keys(byId).some(hidden) && !source.ids.some(hidden)) return list;
			return {
				...list,
				ids: source.ids.filter((id) => !hidden(id)),
				byId: Object.fromEntries(Object.entries(byId).filter(([id]) => !hidden(id)))
			};
		}
		const stores = /* @__PURE__ */ new WeakMap();
		function sessionVisibilityOf(ctx) {
			const owner = rootContext(ctx);
			let store = stores.get(owner);
			if (store === void 0) {
				store = createSessionVisibility();
				stores.set(owner, store);
			}
			return store;
		}
		//#endregion
		//#region src/client/host/navigation.ts
		/** uiWorkspace owns navigation on newer hosts; historical hosts use sessions.open. */
		function openSession(ctx, sessionId) {
			const owner = rootContext(ctx);
			const workspace = owner.get("uiWorkspace");
			if (typeof workspace?.openSession === "function") {
				workspace.openSession(sessionId);
				return;
			}
			if (typeof owner.sessions.open === "function") {
				owner.sessions.open(sessionId);
				return;
			}
			throw new Error("Host session navigation is unavailable");
		}
		//#endregion
		//#region src/client/sidechat/lifecycle.ts
		/**
		* 主线忙碌判定（busy-fork 路由）。2026-09-22 实证的宿主 fork 语义缺口：fork
		* 一个 turn 在飞的会话，会把在飞消息以「未认领的 inbox splice」形态遗传
		* 给子会话——子会话 boot 后把它当成自己的首个任务执行，用户真正发的侧边
		* 消息则排进不可见队列（用户视角 = 「发不了」+「主线最后一条消息被抄到
		* 侧边」）。busy 时改走 busy-fork 路径（fork 后监护中和遗传 turn，见
		* armInheritedTurnPurge）。
		*
		* busy = running（Session 快照顶层，0.1.1/0.1.2/0.1.5 同在）或 pending
		* 非空（审批/提问挂起：0.1.1 在 Session 快照顶层，0.1.2 起在
		* uiConversation.chat 的 legacy 切片——双面都读，同面板 R8 链）。
		* 探测失败一律按「空闲」放行（fork 错误面兜底），绝不因读不到状态而卡死。
		*/
		function sessionBusyOf(ctx, sessionId) {
			try {
				const binding = ctx.sessions.binding(sessionId);
				const snap = binding?.session?.getSnapshot?.();
				if (snap?.running === true) return true;
				if ((snap?.pending?.length ?? 0) > 0) return true;
				return ((chatSourceOf(ctx, binding)?.getLegacy())?.pending?.length ?? 0) > 0;
			} catch {
				return false;
			}
		}
		/**
		* 监护中的子会话登记处：完成通知模块（notify.ts）据此抑制误报——遗传 turn
		* 被 cancel 的 running 翻转不是「侧边回复完成」。
		*/
		const purgingChildren = /* @__PURE__ */ new Set();
		/** 该子会话当前是否处于遗传 turn 监护/清除窗口。 */
		function isPurgingInheritedTurn(childId) {
			return purgingChildren.has(childId);
		}
		/** 读父会话当前最大节点 seq（折叠边界；读不到不阻断）。 */
		function readMaxNodeSeq(ctx, sessionId, binding) {
			try {
				const snap = chatSourceOf(ctx, binding ?? ctx.sessions.binding(sessionId))?.getLegacy();
				let max = -1;
				for (const node of snap?.nodes ?? []) {
					const seq = node.seq;
					if (typeof seq === "number" && seq > max) max = seq;
				}
				return max >= 0 ? max : void 0;
			} catch {
				return;
			}
		}
		/**
		* 读 fork 折叠边界 = 父会话「在飞 turn 之前」的最大节点 seq。
		* busy 时在飞 turn 的节点（最后一条 user/steering 起）不随 fork 继承，必须
		* 排除——否则边界会越过遗传消息在子会话里的 seq，监护把泄漏误判成「继承
		* 内容」而漏 cancel（2026-09-23 真机实证：sleep 240 在子会话里跑起来了）。
		*/
		function readInheritedBoundary(ctx, sessionId, busy) {
			if (!busy) return readMaxNodeSeq(ctx, sessionId);
			try {
				const nodes = chatSourceOf(ctx, ctx.sessions.binding(sessionId))?.getLegacy()?.nodes ?? [];
				let endExclusive = nodes.length;
				for (let i = nodes.length - 1; i >= 0; i -= 1) {
					const kind = nodes[i]?.kind;
					if (kind === "user" || kind === "steering") {
						endExclusive = i;
						break;
					}
				}
				let max = -1;
				for (const node of nodes.slice(0, endExclusive)) {
					const seq = node.seq;
					if (typeof seq === "number" && seq > max) max = seq;
				}
				return max >= 0 ? max : void 0;
			} catch {
				return;
			}
		}
		/** fork-unavailable 判定（主线没有任何已完成 turn）。 */
		function isForkUnavailable(error) {
			const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
			return /fork-unavailable|no completed turn/.test(text);
		}
		/**
		* 读主线在飞 turn 的任务消息前缀（监护的判别依据）：父投影最后一个
		* user/steering 节点即它。截 200 字符入 meta（够判别即可，meta 走
		* localStorage，不扛全文）。读不到 = undefined（监护退化为纯时序判别）。
		*/
		function readInflightUserPrefix(ctx, parentSessionId) {
			try {
				const nodes = chatSourceOf(ctx, ctx.sessions.binding(parentSessionId))?.getLegacy()?.nodes ?? [];
				for (let i = nodes.length - 1; i >= 0; i -= 1) {
					const n = nodes[i];
					if (n?.kind === "user" || n?.kind === "steering") {
						const text = contentTextOf(n.content);
						if (text !== "") return text.slice(0, 200);
					}
				}
			} catch {}
		}
		/**
		* 零完成轮兜底：主线首轮在飞时 fork 不可用（fork-unavailable）——退化为
		* create 一个纯快照会话（无继承历史，全部上下文由 WI-02 的进展快照供给）。
		* sessions.create 是 off-face（client 契约面只有 fork/binding/scope/open），
		* 探测不到就抛错（面板转 fork-error 态）。
		*/
		async function createSideSession(ctx, parentSessionId) {
			const svc = ctx.sessions;
			if (typeof svc.create !== "function") throw new Error("宿主 sessions.create 面缺席，无法创建快照会话");
			let cwd;
			try {
				const summary = ctx.sessions.list.getSnapshot().byId?.[parentSessionId];
				cwd = typeof summary?.cwd === "string" ? summary.cwd : void 0;
			} catch {}
			return svc.create(cwd === void 0 ? {} : { cwd });
		}
		/**
		* 遗传 turn 监护（busy fork 的核心中和手段）：busy fork 的子会话日志带着
		* 主线在飞消息的未认领 inbox insert（宿主 fork cut 缺陷），boot 后会被认领
		* 执行。子会话 fork 后是休眠的（实测不 open 不 prompt 不跑）。
		*
		* 信号面（实证教训，勿回退）：Session 控制快照的 running 位由管理器的
		* 列表/活动通道驱动，**非在屏会话不实时翻牌**——watch 它永远等不到 true。
		* 可靠信号是 chat 投影（openSessionWindow 打开的事件窗驱动）：泄漏消息只在
		* 被认领（= 遗传 turn 开跑）后才落成 user 节点——**该节点在子会话投影中
		* 出现即 turn 已开跑**，此刻 cancel 恰落在首个 LLM 响应窗口内（≥1s），
		* 工具来不及执行。
		*
		* 判别（双门，防误伤）：先过 seq 门——继承节点的 seq 与父会话原值一致
		* （fork 前缀逐字拷贝），只有 seq > forkBoundarySeq 的用户节点才是 fork 后
		* 新增的（继承历史里的用户消息不参与判别）；再过文本门——expectedPrefix
		* 在场时节点的文本须命中 fork 时刻记下的在飞消息前缀，未命中（宿主已修好
		* cut 缺陷/用户自己的首个侧边消息）即解除，绝不误 cancel。前缀缺席
		* （读取失败）退化为纯 seq 门判别。
		*
		* 监护一次性：settle（cancel 完成/判别未命中/用户自己的首条消息带快照前缀）
		* 后解除并把 meta 标 inheritedPurged——面板重挂载（关 tab 重开）靠该标记
		* 跳过重复监护。cancel 后推进折叠边界覆盖 aborted turn（界面无感）。
		* **不设静置超时**：子会话休眠到用户首条消息才认领 inbox（真机实证），
		* 泄漏 turn 可能在任意晚的时刻开跑——超时撤防等于把洞留给慢用户。
		* 幂等：同一 childId 重复调用只监护一次（purgingChildren 守卫）。
		*/
		function armInheritedTurnPurge(ctx, childId, parentSessionId, tabId, expectedPrefix, forkBoundarySeq) {
			if (purgingChildren.has(childId)) return;
			purgingChildren.add(childId);
			let settled = false;
			let retained;
			const offs = [];
			const releaseRetained = () => {
				retained?.release();
				retained = void 0;
			};
			const markPurged = () => {
				updateTabMeta(ctx, parentSessionId, tabId, (cur) => ({
					...cur,
					inheritedPurged: true
				}));
			};
			const stop = () => {
				if (settled) return false;
				settled = true;
				for (const off of offs) off();
				purgingChildren.delete(childId);
				releaseRetained();
				return true;
			};
			const disarm = () => {
				if (stop()) markPurged();
			};
			/**
			* 子会话投影里「fork 后新增」的用户消息文本（无 = ''）：seq ≤ fork 边界的
			* 节点全是继承历史（seq 随 fork 前缀逐字拷贝），直接排除。
			*/
			const freshUserText = () => {
				try {
					const nodes = chatSourceOf(ctx, retained?.binding ?? ctx.sessions.binding(childId))?.getLegacy()?.nodes ?? [];
					for (let i = nodes.length - 1; i >= 0; i -= 1) {
						const n = nodes[i];
						if (n?.kind !== "user" && n?.kind !== "steering") continue;
						if (forkBoundarySeq !== void 0 && typeof n.seq === "number" && n.seq <= forkBoundarySeq) return "";
						return contentTextOf(n.content);
					}
				} catch {}
				return "";
			};
			try {
				retained = retainSession(ctx, childId);
				if (retained !== void 0) retained.ready.catch((error) => {
					if (!stop()) return;
					console.warn("[dsh-sidenote] 遗传 turn 监护打开子会话失败:", childId, error);
				});
				const binding = retained?.binding ?? ctx.sessions.binding(childId);
				const session = binding?.session;
				const cancelFace = session;
				const chat = binding === void 0 ? void 0 : chatSourceOf(ctx, binding);
				if (session === void 0 || typeof cancelFace?.cancel !== "function" || chat === void 0) {
					console.warn("[dsh-sidenote] 子会话 cancel/chat 面缺席，遗传 turn 监护未启用:", childId, "session:", session !== void 0, "chat:", chat !== void 0);
					stop();
					return;
				}
				const cancelChild = cancelFace.cancel;
				offs.push(chat.subscribe(() => {
					if (settled) return;
					const text = freshUserText();
					if (text === "") return;
					if (text.startsWith("<mainline-progress-snapshot")) {
						disarm();
						return;
					}
					if (expectedPrefix !== void 0 && !text.startsWith(expectedPrefix)) {
						disarm();
						return;
					}
					settled = true;
					for (const off of offs) off();
					let cancellation;
					try {
						cancellation = cancelChild.call(session);
					} catch (error) {
						cancellation = Promise.reject(error);
					}
					cancellation.catch((error) => console.warn("[dsh-sidenote] 遗传 turn 取消失败:", error)).finally(() => {
						purgingChildren.delete(childId);
						markPurged();
						advanceBoundaryPastTail(ctx, parentSessionId, tabId, childId);
						reconcileChildQueueAfterCancel(ctx, childId, expectedPrefix);
						releaseRetained();
					});
				}));
			} catch (error) {
				stop();
				console.warn("[dsh-sidenote] 遗传 turn 监护初始化失败:", error);
			}
		}
		/**
		* cancel 后队列和解（真机实证：宿主 cancel 保留 inbox 但不自动续跑，且
		* 休眠子会话的队列要等 agent 暖机才物化——认领前剔除对休眠子会话不可行）。
		* 等 turn 落定（running 翻 false）后读队列：
		* - 命中在飞前缀的项 = 没跑赢 claim 的泄漏/主线积压 → remove；
		* - 带快照前缀的项 = 用户的真实侧边消息 → remove + 原样重投（内容含快照
		*   前缀，remove 先行保证不重影），让它真正跑起来。
		* 两者皆无（主线积压、用户的快手第二条）→ 留在队列里不动（保守不删用户文字）。
		*/
		function reconcileChildQueueAfterCancel(ctx, childId, expectedPrefix) {
			let retained;
			try {
				retained = retainSession(ctx, childId);
			} catch {}
			let attempts = 0;
			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				retained?.release();
				retained = void 0;
			};
			const tick = () => {
				attempts += 1;
				try {
					const session = (retained?.binding ?? ctx.sessions.binding(childId))?.session;
					const snap = session?.getSnapshot?.();
					if (session === void 0 || snap === void 0 || snap === null || typeof session.updateQueue !== "function" || typeof session.prompt !== "function") {
						finish();
						return;
					}
					if (snap.running === true) {
						if (attempts < 8) setTimeout(tick, 400);
						else finish();
						return;
					}
					const updateQueue = session.updateQueue.bind(session);
					const prompt = session.prompt.bind(session);
					const tasks = [];
					for (const item of snap.queue ?? []) {
						if (typeof item?.id !== "string") continue;
						const text = typeof item.text === "string" ? item.text : contentTextOf(item.content);
						const isLeak = expectedPrefix !== void 0 && text.startsWith(expectedPrefix);
						const isUserReal = text.startsWith(SNAPSHOT_BLOCK_MARK);
						if (!isLeak && !isUserReal) continue;
						const itemId = item.id;
						const content = item.content;
						tasks.push(updateQueue(itemId, { kind: "remove" }).then(() => {
							if (!isUserReal) return void 0;
							return prompt(content, "queue");
						}).catch((error) => console.warn("[dsh-sidenote] 取消后队列和解失败:", error)));
					}
					if (tasks.length === 0) finish();
					else Promise.allSettled(tasks).then(finish);
				} catch {
					finish();
				}
			};
			setTimeout(tick, 300);
		}
		/**
		* cancel 后把折叠边界推进到子会话内容尾（覆盖 aborted turn）。中断 turn 的
		* 冻结节点带小数 seq（宿主 fork 文档实证），故 boundarySeq 允许非整数。
		* 等 running 翻 false 且节点落定再读；最多重试 ~3s，失败不阻断（aborted
		* turn 会短暂可见，属可接受降级）。
		*/
		function advanceBoundaryPastTail(ctx, parentSessionId, tabId, childId) {
			let retained;
			try {
				retained = retainSession(ctx, childId);
			} catch {}
			let attempts = 0;
			let finished = false;
			const finish = () => {
				if (finished) return;
				finished = true;
				retained?.release();
				retained = void 0;
			};
			const tick = () => {
				attempts += 1;
				try {
					const binding = retained?.binding ?? ctx.sessions.binding(childId);
					const max = (binding?.session.getSnapshot())?.running === true ? void 0 : readMaxNodeSeq(ctx, childId, binding);
					if (max !== void 0) {
						updateTabMeta(ctx, parentSessionId, tabId, (cur) => ({
							...cur,
							boundarySeq: Math.max(cur.boundarySeq ?? -1, max)
						}));
						finish();
						return;
					}
				} catch {}
				if (attempts < 8) setTimeout(tick, 400);
				else finish();
			};
			setTimeout(tick, 300);
		}
		/**
		* 首开编排：暂缓新增列表行 → fork → 登记隐藏身份/meta →
		* 旧宿主归档（best-effort）→ 模型跟随主会话（best-effort）。
		* fork 失败抛错（面板组件转错误态）；后两步失败只告警不阻断。
		*
		* 主线 turn 在飞（busy）时走 busy-fork（Delivery_04）：立即 fork + 遗传
		* turn 监护 + meta 打 forkedMidTurn 标记（首条侧边消息拼进展快照）；
		* 主线零完成轮（fork-unavailable）退化为 create 纯快照会话（snapshotOnly）。
		* @returns fork/创建出的子会话 id。
		*/
		async function forkAndRegister(ctx, parentSessionId, tabId, signal) {
			if (signal?.aborted === true) throw new DOMException("side chat fork aborted", "AbortError");
			const busy = sessionBusyOf(ctx, parentSessionId);
			const boundarySeq = readInheritedBoundary(ctx, parentSessionId, busy);
			const leakedPromptPrefix = busy ? readInflightUserPrefix(ctx, parentSessionId) : void 0;
			const owner = rootContext(ctx);
			let forked;
			let snapshotOnly = false;
			const visibility = sessionVisibilityOf(owner);
			const finishVisibility = visibility.begin(owner.sessions.list.getSnapshot());
			try {
				if (!busy) forked = await ctx.sessions.fork({ sessionId: parentSessionId });
				else {
					try {
						forked = await ctx.sessions.fork({ sessionId: parentSessionId });
					} catch (error) {
						if (!isForkUnavailable(error)) throw error;
						forked = await createSideSession(owner, parentSessionId);
						snapshotOnly = true;
					}
					if (!snapshotOnly) armInheritedTurnPurge(ctx, forked, parentSessionId, tabId, leakedPromptPrefix, boundarySeq);
				}
				visibility.hide(forked);
			} finally {
				finishVisibility();
			}
			updateTabMeta(ctx, parentSessionId, tabId, (current) => ({
				...current,
				childId: forked,
				parentSessionId,
				...boundarySeq !== void 0 ? { boundarySeq } : {},
				...busy ? { forkedMidTurn: true } : {},
				...snapshotOnly ? { snapshotOnly: true } : {},
				...leakedPromptPrefix !== void 0 ? { leakedPromptPrefix } : {}
			}));
			if (typeof owner.workspaces.unarchiveSession !== "function") try {
				await owner.workspaces.archiveSession(forked);
			} catch (error) {
				console.warn("[dsh-sidenote] 归档侧边会话失败:", error);
			}
			try {
				const selection = await readModelSelection(owner, parentSessionId);
				if (selection === void 0) console.warn("[dsh-sidenote] 同步主会话模型跳过：主机模型 API 不可用");
				else if (!await writeModelSelection(owner, forked, selection)) console.warn("[dsh-sidenote] 同步主会话模型失败（子会话用默认模型）");
			} catch (error) {
				console.warn("[dsh-sidenote] 同步主会话模型失败（子会话用默认模型）:", error);
			}
			return forked;
		}
		/**
		* Tab meta 读-改-写。双腿：直连原生腿的 meta 在自有 metaStore（原生无
		* updateTab 面，布局 memory-only）；legacy 腿在布局快照 + betterSidebar.updateTab。
		* 分腿判据统一为 directNativeLeg（对抗性审查 m1：判据单点化——metaStore
		* 有无记录不能再当判据，否则记录缺失时 childId 登记会静默落到 no-op 的
		* legacy 面）。直连腿记录缺失 = 异常态（reconcile 应先已建）：warn 并 no-op。
		*/
		function updateTabMeta(ctx, sessionId, tabId, mutate) {
			if (directNativeLeg(ctx)) {
				const direct = readSideChatMeta(sessionId, tabId);
				if (direct === void 0) {
					console.warn("[dsh-sidenote] meta 记录缺失（reconcile 应先已建），本次 meta 写入跳过:", tabId);
					return;
				}
				const next = mutate(parseSideChatMeta(direct));
				writeSideChatMeta({
					tabId,
					sessionId: direct.sessionId,
					...next.childId !== void 0 ? { childId: next.childId } : {},
					...next.parentSessionId !== void 0 ? { parentSessionId: next.parentSessionId } : {},
					...next.pendingDraft !== void 0 ? { pendingDraft: next.pendingDraft } : {},
					...next.boundarySeq !== void 0 ? { boundarySeq: next.boundarySeq } : {},
					...next.forkedMidTurn === true ? { forkedMidTurn: true } : {},
					...next.snapshotOnly === true ? { snapshotOnly: true } : {},
					...next.leakedPromptPrefix !== void 0 ? { leakedPromptPrefix: next.leakedPromptPrefix } : {},
					...next.inheritedPurged === true ? { inheritedPurged: true } : {},
					...next.topic !== void 0 ? { topic: next.topic } : {},
					number: direct.number,
					createdAt: direct.createdAt,
					...direct.runId !== void 0 ? { runId: direct.runId } : {}
				});
				return;
			}
			const bs = betterSidebarOf(ctx);
			if (bs === void 0) return;
			const current = parseSideChatMeta(readTab(ctx, sessionId, tabId)?.meta);
			bs.updateTab(tabId, { meta: mutate(current) });
		}
		/**
		* 写入内容身份（Delivery_05）：meta 双腿写 + legacy 腿补标题 patch
		* （native 芯片标题槽订阅 metaStore，meta 落库即免费响应；legacy 标题是
		* 布局快照里的静态字段，必须显式 patch；topic 在时编号不参与标题，
		* 故 legacy 侧无需反推编号）。sticky 守卫沉在 mutate 里（同帧连发两次
		* submit 时面板侧 ref 守卫有相位差，审查 L2）。
		*/
		function setSideChatTopic(ctx, sessionId, tabId, topic) {
			updateTabMeta(ctx, sessionId, tabId, (cur) => cur.topic !== void 0 ? cur : {
				...cur,
				topic
			});
			if (directNativeLeg(ctx)) return;
			const effective = parseSideChatMeta(readTab(ctx, sessionId, tabId)?.meta).topic ?? topic;
			betterSidebarOf(ctx)?.updateTab(tabId, { title: sideChatTitleOf({
				number: 1,
				topic: effective
			}) });
		}
		/** 关闭侧聊 tab：直连腿走 ISidebarRight.close，legacy 走 betterSidebar.closeTab。 */
		function closeSideTab(ctx, tabId, sessionId) {
			if (directNativeLeg(ctx)) {
				const face = sidebarRightOf(ctx);
				if (face !== void 0) {
					face.close(tabId);
					return;
				}
			}
			betterSidebarOf(ctx)?.closeTab(tabId, { sessionId });
		}
		/** A saved copy is a regular session; close the source tab before changing views. */
		async function saveSideChatSession(ctx, childId, tabId, parentSessionId, annotations) {
			const session = rootContext(ctx).sessions.binding(childId)?.session;
			const machine = resolveInput(rootContext(ctx), childId);
			const input = machine?.state.getSnapshot();
			if (session?.getSnapshot().running === true || (input?.queue?.length ?? 0) > 0 || input !== void 0 && input.phase !== "plain") throw new Error(t("promoteBusy"));
			if (input?.draft.trim() || machine !== void 0 && inputAttachmentIds(machine).length > 0 || (annotations?.countActive(childId) ?? 0) > 0) throw new Error(t("promoteDraftBusy"));
			const promoted = await rootContext(ctx).sessions.fork({
				sessionId: childId,
				increaseTitle: true
			});
			closeSideTab(ctx, tabId, parentSessionId);
			openSession(ctx, promoted);
		}
		/**
		* 程序化入口（/side、bridge 划选提问）打开 Tab 时面板可能处于折叠态——
		* 类型型 openTab 不自动展开（better-sidebar 只对 path/url 内容型打开展开）。
		* 幂等展开（off-face：store.update 是 SidebarStore 公开 mutator 面；
		* feature-check + 吞错，兜底失败不影响功能）。
		*/
		function ensurePanelOpen(store) {
			const mutable = store;
			try {
				mutable?.update?.((state) => {
					if (state.panelOpen === false) state.panelOpen = true;
				});
			} catch {}
		}
		/**
		* 0.1.7 自愈：旧版本插件把侧边子会话归档隐藏，ArchivedSessionGate 会拒跑它
		* 的模型步（turn/end blocked）。面板挂载时对 childId 幂等 unarchive；
		* 旧宿主无此 API 时 no-op。
		*/
		function unarchiveSideSession(ctx, sessionId) {
			if (sessionId === void 0) return;
			const unarchive = ctx.workspaces.unarchiveSession;
			if (typeof unarchive !== "function") return;
			unarchive.call(ctx.workspaces, sessionId).catch(() => {});
		}
		/**
		* 打开非 staged 会话的事件窗口（off-face：open() 在 concrete Session 上是
		* public 且幂等，但不在 SessionFace 契约上——契约面只有 staged 会话会被
		* 运行时自动 open）。feature-check + 吞错，运行时若移除则降级为只发不收。
		*/
		function openSessionWindow(session) {
			const openable = session;
			if (typeof openable?.open !== "function") return;
			openable.open().catch((error) => {
				console.warn("[dsh-sidenote] 会话窗口打开失败:", error);
			});
		}
		//#endregion
		//#region src/client/sidechat/recentClosed.ts
		const KEY_PREFIX = "dsh-sidenote:closed-side:v1:";
		const CAP = 5;
		function readAll(storageKey) {
			try {
				const raw = localStorage.getItem(storageKey);
				if (raw === null) return [];
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return [];
				return parsed.filter((e) => typeof e === "object" && e !== null && typeof e.childId === "string" && typeof e.parentSessionId === "string" && typeof e.title === "string");
			} catch {
				return [];
			}
		}
		function recordClosedSideChat(parentSessionId, entry) {
			try {
				const key = KEY_PREFIX + parentSessionId;
				const list = [entry, ...readAll(key).filter((e) => e.childId !== entry.childId)].slice(0, CAP);
				localStorage.setItem(key, JSON.stringify(list));
			} catch {}
		}
		/** 读某主会话的最近关闭列表（新者在前）。 */
		function listClosedSideChats(parentSessionId) {
			if (typeof localStorage === "undefined") return [];
			return readAll(KEY_PREFIX + parentSessionId);
		}
		/** Existing recovery records can seed the durable visibility index on upgrade. */
		function allClosedSideChats() {
			try {
				return Object.keys(localStorage).filter((key) => key.startsWith(KEY_PREFIX)).flatMap(readAll);
			} catch {
				return [];
			}
		}
		/** 重开消费：从列表移除（重开后若再关会重新入列）。 */
		function dropClosedSideChat(parentSessionId, childId) {
			try {
				const key = KEY_PREFIX + parentSessionId;
				const list = readAll(key).filter((e) => e.childId !== childId);
				if (list.length === 0) localStorage.removeItem(key);
				else localStorage.setItem(key, JSON.stringify(list));
			} catch {}
		}
		/** A newly opened native occurrence may reuse a tab id. Keep manual history,
		* but revoke that old occurrence's automatic restoration identity. */
		function forgetClosedTabBinding(parentSessionId, tabId) {
			try {
				const key = KEY_PREFIX + parentSessionId;
				const entries = readAll(key);
				if (!entries.some((entry) => entry.tabId === tabId)) return;
				localStorage.setItem(key, JSON.stringify(entries.map((entry) => {
					if (entry.tabId !== tabId) return entry;
					const { tabId: _oldTab, ...rest } = entry;
					return rest;
				})));
			} catch {}
		}
		//#endregion
		//#region src/client/annotations/submissionExtras.ts
		const extras = /* @__PURE__ */ new Map();
		function submissionExtrasOf(sessionId) {
			return extras.get(sessionId);
		}
		function registerSubmissionExtras(sessionId, value) {
			extras.set(sessionId, value);
			return () => {
				if (extras.get(sessionId) === value) extras.delete(sessionId);
			};
		}
		//#endregion
		//#region src/client/sidechat/toast.tsx
		/**
		* 全局瞬态通知（P4 确认反馈）：body 级独立 React 根，寿命不随任何 Tab——
		* 「保存为正式会话」后主视图跳转 + 侧聊 Tab 关闭，面板自己的组件树已卸载，
		* toast 必须挂在更长寿的宿主上（annotate overlay 同款 ctx.effect 模式：
		* HMR/插件禁用时 fiber 撤销即清理）。
		*/
		let current = null;
		const listeners = /* @__PURE__ */ new Set();
		function emit() {
			for (const fn of listeners) fn();
		}
		/** 全局瞬态通知入口（任何模块可调；未挂载宿主时静默丢弃）。 */
		function showToast(text) {
			current = {
				seq: (current?.seq ?? 0) + 1,
				text
			};
			emit();
		}
		function subscribe(fn) {
			listeners.add(fn);
			return () => {
				listeners.delete(fn);
			};
		}
		function ToastHost() {
			const snap = (0, react.useSyncExternalStore)(subscribe, () => current);
			if (snap === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: snap.text,
				onDone: () => {
					current = null;
					emit();
				}
			}, snap.seq);
		}
		/** 挂载全局 toast 宿主（registerSideChat 里调用一次）。 */
		function registerToastHost(ctx) {
			ctx.effect(() => {
				const host = document.createElement("div");
				host.dataset.dshSidenoteToast = "";
				document.body.appendChild(host);
				const root = (0, react_dom_client.createRoot)(host);
				root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ToastHost, {}));
				return () => {
					root.unmount();
					host.remove();
				};
			}, "dsh-sidenote: toast host");
		}
		//#endregion
		//#region src/client/sidechat/SideChatPanel.tsx
		/** Side-chat lifecycle and product extensions around the shared Conversation. */
		const NOOP_UNSUBSCRIBE = () => {};
		function SideChatPanel(props) {
			useLocaleTick();
			const { ctx, scope, tab, visible } = props;
			const meta = parseSideChatMeta(tab.meta);
			const childId = meta.childId;
			const [forkError, setForkError] = (0, react.useState)(null);
			const [reference, setReference] = (0, react.useState)();
			const forkStarted = (0, react.useRef)(false);
			const rootRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				ensurePanelOpen(props.store);
			}, [props.store]);
			(0, react.useEffect)(() => {
				if (childId !== void 0 || forkStarted.current) return;
				forkStarted.current = true;
				const controller = new AbortController();
				forkAndRegister(ctx, scope.sessionId, tab.id, controller.signal).catch((error) => {
					if (!controller.signal.aborted) setForkError(error instanceof Error ? error.message : String(error));
				});
				return () => {
					controller.abort();
				};
			}, [
				ctx,
				scope.sessionId,
				tab.id,
				childId
			]);
			(0, react.useEffect)(() => {
				if (childId === void 0) return;
				const acquired = retainSession(ctx, childId);
				setReference(acquired);
				unarchiveSideSession(ctx, childId);
				let active = true;
				acquired?.ready.catch((error) => {
					if (active) setForkError(String(error));
				});
				return () => {
					active = false;
					acquired?.release();
				};
			}, [ctx, childId]);
			const list = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => ctx.sessions.list.subscribe(notify), [ctx]), () => ctx.sessions.list.getSnapshot());
			const binding = childId === void 0 ? void 0 : ctx.sessions.binding(childId);
			const session = binding?.session;
			const phase = phaseOf({
				childId,
				forkError,
				bound: session !== void 0,
				listPhase: list.phase,
				listed: childId !== void 0 && list.byId?.[childId] !== void 0
			});
			(0, react.useEffect)(() => {
				if (meta.forkedMidTurn && !meta.inheritedPurged && childId && session) armInheritedTurnPurge(ctx, childId, scope.sessionId, tab.id, meta.leakedPromptPrefix, meta.boundarySeq);
				openSessionWindow(session);
			}, [
				ctx,
				session,
				childId,
				scope.sessionId,
				tab.id,
				meta.forkedMidTurn,
				meta.inheritedPurged,
				meta.leakedPromptPrefix,
				meta.boundarySeq
			]);
			const snapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => session?.subscribe(notify) ?? NOOP_UNSUBSCRIBE, [session]), () => session?.getSnapshot() ?? null);
			const chat = (0, react.useMemo)(() => chatSourceOf(ctx, binding), [
				ctx,
				childId,
				session
			]);
			const legacy = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => chat?.subscribe(notify) ?? NOOP_UNSUBSCRIBE, [chat]), () => chat?.getLegacy() ?? null);
			const messages = (0, react.useMemo)(() => transcriptOf(legacy ?? snapshot), [legacy, snapshot]);
			const metaRef = (0, react.useRef)(meta);
			metaRef.current = meta;
			const extras = (0, react.useMemo)(() => ({
				firstSendPrefix: () => {
					const current = metaRef.current;
					return current.forkedMidTurn && current.parentSessionId ? buildMainlineSnapshot(ctx, current.parentSessionId) : null;
				},
				onAccepted: () => {
					updateTabMeta(ctx, scope.sessionId, tab.id, (current) => ({
						...current,
						forkedMidTurn: void 0
					}));
				},
				onSubmitText: (text) => {
					const topic = topicOf(text);
					if (topic && metaRef.current.topic === void 0) setSideChatTopic(ctx, scope.sessionId, tab.id, topic);
				}
			}), [
				ctx,
				scope.sessionId,
				tab.id
			]);
			const composer = useComposer(ctx, session, childId);
			(0, react.useEffect)(() => childId === void 0 ? void 0 : registerSubmissionExtras(childId, extras), [childId, extras]);
			(0, react.useEffect)(() => {
				if (meta.topic !== void 0) return;
				const first = messages.find((message) => message.role === "user" && (message.seq ?? -1) > (meta.boundarySeq ?? -1));
				if (first) extras.onSubmitText(first.text);
			}, [
				messages,
				meta.topic,
				meta.boundarySeq,
				extras
			]);
			(0, react.useEffect)(() => {
				if (!meta.pendingDraft || phase !== "chat" || !composer.machine) return;
				composer.appendDraft(meta.pendingDraft);
				updateTabMeta(ctx, scope.sessionId, tab.id, clearPendingDraft);
				requestAnimationFrame(() => {
					if (rootRef.current) focusSideComposer(rootRef.current);
				});
			}, [
				meta.pendingDraft,
				phase,
				composer.machine,
				ctx,
				scope.sessionId,
				tab.id
			]);
			const live = (0, react.useRef)({
				composer,
				meta: tab.meta,
				phase,
				title: tab.title,
				childId,
				error: forkError ?? void 0,
				requestId: props.quoteRequestId
			});
			live.current = {
				composer,
				meta: tab.meta,
				phase,
				title: tab.title,
				childId,
				error: forkError ?? void 0,
				requestId: props.quoteRequestId
			};
			(0, react.useEffect)(() => {
				notifyLiveSideChats();
			}, [
				phase,
				childId,
				forkError,
				props.quoteRequestId
			]);
			(0, react.useEffect)(() => {
				if (childId) dropClosedSideChat(scope.sessionId, childId);
			}, [childId, scope.sessionId]);
			(0, react.useEffect)(() => {
				const dispose = registerLiveSideChat(scope.sessionId, tab.id, (text) => {
					if (live.current.phase !== "chat" || !live.current.composer.machine) updateTabMeta(ctx, scope.sessionId, tab.id, (current) => ({
						...current,
						pendingDraft: appendDraftText(current.pendingDraft ?? "", text)
					}));
					else {
						live.current.composer.appendDraft(text);
						requestAnimationFrame(() => {
							if (rootRef.current) focusSideComposer(rootRef.current);
						});
					}
				}, () => live.current.meta, () => live.current.title, () => ({
					phase: live.current.phase,
					childId: live.current.childId,
					error: live.current.error,
					requestId: live.current.requestId
				}));
				const remember = () => {
					const current = parseSideChatMeta(live.current.meta);
					if (!current.childId || !current.parentSessionId) return;
					recordClosedSideChat(current.parentSessionId, {
						childId: current.childId,
						parentSessionId: current.parentSessionId,
						title: live.current.title,
						tabId: tab.id,
						savedMeta: {
							...current,
							number: live.current.meta?.number
						},
						...current.topic ? { topic: current.topic } : {},
						closedAt: Date.now()
					});
				};
				window.addEventListener("pagehide", remember);
				return () => {
					dispose();
					window.removeEventListener("pagehide", remember);
					remember();
				};
			}, [
				ctx,
				scope.sessionId,
				tab.id
			]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const onKey = (event) => {
					if (!event.altKey || event.key.toLowerCase() !== "s") return;
					event.preventDefault();
					if (rootRef.current?.contains(document.activeElement)) focusMainComposer(document.body);
					else if (rootRef.current) focusSideComposer(rootRef.current);
				};
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("keydown", onKey);
				};
			}, [visible]);
			const parent = meta.parentSessionId ? ctx.sessions.binding(meta.parentSessionId)?.session : void 0;
			const parentSnapshot = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => parent?.subscribe(notify) ?? NOOP_UNSUBSCRIBE, [parent]), () => parent?.getSnapshot() ?? null);
			const parentChat = (0, react.useMemo)(() => chatSourceOf(ctx, ctx.sessions.binding(meta.parentSessionId ?? scope.sessionId)), [
				ctx,
				parent,
				meta.parentSessionId,
				scope.sessionId
			]);
			const parentLegacy = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => parentChat?.subscribe(notify) ?? NOOP_UNSUBSCRIBE, [parentChat]), () => parentChat?.getLegacy() ?? null);
			const savedProgress = (0, react.useMemo)(() => messages.filter((message) => message.role === "user" && (message.seq ?? -1) > (meta.boundarySeq ?? -1)).map((message) => splitSnapshotPrefix(message.text)).find(Boolean), [messages, meta.boundarySeq]);
			const progress = (0, react.useMemo)(() => savedProgress ? {
				entries: snapshotEntriesFromText(savedProgress.snapshot),
				takenAt: savedProgress.takenAt
			} : meta.forkedMidTurn ? { entries: snapshotEntriesOf(parentLegacy?.nodes ?? [], parentLegacy?.partial) } : void 0, [
				savedProgress,
				meta.forkedMidTurn,
				parentLegacy
			]);
			const status = sessionStatusSource(ctx);
			const parentPending = (0, react.useSyncExternalStore)((0, react.useCallback)((notify) => status?.subscribe(notify) ?? NOOP_UNSUBSCRIBE, [status]), () => status?.getSnapshot().get(meta.parentSessionId ?? scope.sessionId)?.pendingInteraction != null);
			const [saving, setSaving] = (0, react.useState)(false);
			const [saveError, setSaveError] = (0, react.useState)();
			const promote = async () => {
				if (!childId || saving) return;
				setSaving(true);
				setSaveError(void 0);
				try {
					await saveSideChatSession(ctx, childId, tab.id, scope.sessionId, props.annotations);
					showToast(t("promoteDone"));
				} catch (error) {
					setSaveError(error instanceof Error ? error.message : String(error));
				} finally {
					setSaving(false);
				}
			};
			(0, react.useSyncExternalStore)(props.reflow.subscribe, props.reflow.getSnapshot);
			(0, react.useSyncExternalStore)(props.annotations.subscribe, props.annotations.getSnapshot);
			if (phase === "fork-error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateScreen, {
				title: t("forkErrorTitle"),
				detail: forkError ?? void 0,
				hint: t("forkErrorHint")
			});
			if (phase === "missing") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateScreen, {
				title: t("missingTitle"),
				detail: t("missingDetail"),
				hint: t("missingHint")
			});
			if (phase !== "chat" || !reference || !childId) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StateScreen, { title: t("preparing") });
			const side = {
				sessionId: childId,
				parentSessionId: meta.parentSessionId ?? scope.sessionId,
				title: tab.title,
				boundarySeq: meta.boundarySeq,
				reflow: props.reflow,
				progress,
				contextPending: meta.forkedMidTurn && !savedProgress
			};
			const replies = finalReplies(messages, meta.boundarySeq, new Set(chat?.getCompletedReplySeqs?.() ?? []));
			const questions = pairQuestions(messages);
			const allAdded = replies.length > 0 && replies.every((reply) => isReplyAdded(side, reply, questions.get(reply.key)));
			const running = snapshot?.running === true;
			const hasDraft = composer.hasDraft || props.annotations.countActive(childId) > 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: sidechat_module_css_default.root,
				"data-sidenote-chat-session": childId,
				"data-sidenote-view-title": tab.title,
				"data-sidenote-context-pending": side.contextPending || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: sidechat_module_css_default.nativeToolbar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: sidechat_module_css_default.nativeAction,
							onClick: () => {
								openSession(ctx, side.parentSessionId);
							},
							children: t(parentPending ? "parentPending" : parentSnapshot?.running ? "parentRunning" : "parentIdle")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: sidechat_module_css_default.nativeToolbarActions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidechat_module_css_default.nativeAction,
								disabled: running || replies.length === 0 || allAdded,
								"aria-pressed": allAdded,
								onClick: () => {
									for (const reply of replies) addReply(side, reply, questions.get(reply.key));
								},
								children: t(allAdded ? "reflowAllDone" : "reflowAll")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: sidechat_module_css_default.nativeAction,
								disabled: running || composer.pending || hasDraft || saving,
								title: t(running || composer.pending ? "promoteBusy" : hasDraft ? "promoteDraftBusy" : "promoteTitle"),
								onClick: () => {
									promote();
								},
								children: t("promote")
							})]
						})]
					}),
					saveError && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.errorRow,
						role: "alert",
						children: saveError
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: sidechat_module_css_default.nativeConversation,
						"data-sidenote-transcript": true,
						children: props.renderConversation(reference, side)
					})
				]
			});
		}
		//#endregion
		//#region src/client/host/tabs.ts
		/** Public TabDomain navigation revision: 0 means restored/seeded, positive
		* means opened by address. Unknown shapes cannot reclaim another generation. */
		function isRestoredNativeTab(record) {
			return record.navigation.revision === 0;
		}
		//#endregion
		//#region src/client/sidechat/native-tab.tsx
		/**
		* 直连注册层（Workitem_02）：侧聊 tab 类型直连 DSH 原生右栏（≥ 0.1.5-rc.1）。
		*
		* better-sidebar 0.19+ 把右栏让渡给原生 sidebarRight 后只剩纯转发——本模块
		* 绕开转发层，把侧聊类型直接注册进原生面：
		*
		* - 类型注册必须**等服务**（ctx.inject(['sidebarRightTabs'])）而非等槽声明：
		*   原生栏先声明 sidebar.right.pane.tab 槽、约 3 秒后才 provide 注册表服务，
		*   等槽触发会永久静默不注册（better-sidebar native/index.ts 的真机教训）。
		* - 面板体挂 sidebar.right.pane.tab keyed 槽（key = 注册实现 id）；
		*   芯片活标题挂 sidebar.right.pane.tab.title 槽（编号读 metaStore）。
		* - meta 无原生面：全部走自有 metaStore；
		*   openTab → 面板挂载的窗口期内，初始值（parentSessionId/pendingDraft/恢复
		*   用的 childId）经 openTab params 随宿主管道投递，面板挂载时落进 store。
		*
		* 单实例语义（Delivery_01）：held 规则下同 pane 同 kind 去重，「新建」由
		* 编排层折叠为聚焦既有（open.ts），注册层不感知；多实例等 Delivery_02
		* 的 multiple（0.1.6+）放开。
		*/
		/** 原生注册表里的实现 id（槽 key；kind 沿用 SIDE_TAB_TYPE 保持自文档化）。 */
		const NATIVE_IMPL_ID = "dsh-sidenote:side-chat";
		function parseOpenParams(params) {
			if (typeof params !== "object" || params === null) return void 0;
			const p = params;
			if (typeof p.parentSessionId !== "string" || p.parentSessionId === "") return void 0;
			return {
				parentSessionId: p.parentSessionId,
				...typeof p.pendingDraft === "string" && p.pendingDraft !== "" ? { pendingDraft: p.pendingDraft } : {},
				...typeof p.childId === "string" && p.childId !== "" ? { childId: p.childId } : {},
				...typeof p.topic === "string" && p.topic !== "" ? { topic: p.topic } : {},
				...typeof p.quoteRequestId === "string" ? { quoteRequestId: p.quoteRequestId } : {},
				...typeof p.savedMeta === "object" && p.savedMeta !== null ? { savedMeta: {
					...parseSideChatMeta(p.savedMeta),
					...typeof p.savedMeta.number === "number" ? { number: p.savedMeta.number } : {}
				} } : {}
			};
		}
		/**
		* 渲染期把 params 的初始值幂等落进 metaStore（静默写，不 notify——渲染期
		* notify 会让订阅者（title 槽）触发 React「渲染中更新」警告；由调用方在
		* effect 里补 notify）。必须在渲染期完成：子组件 SideChatPanel 的 fork
		* effect 先于本组件的 effect 执行（React effect 自底向上），reopen 场景
		* 若在 effect 里登记，子面板会先按「无 childId」错误地重新 fork 出孤儿会话。
		* @returns true = 本次新建了记录（调用方 effect 里补 notify）。
		*/
		function reconcileMeta(record, sessionId) {
			const existing = readSideChatMeta(sessionId, record.id);
			if (existing !== void 0) return {
				created: false,
				meta: existing
			};
			const params = parseOpenParams(record.navigation.params);
			const candidate = takeRestoredSideChatMeta(sessionId, record.id);
			const restoredRecord = isRestoredNativeTab(record);
			const closed = restoredRecord ? listClosedSideChats(sessionId).find((entry) => entry.tabId === record.id && entry.parentSessionId === sessionId) : void 0;
			if (!restoredRecord) forgetClosedTabBinding(sessionId, record.id);
			const restored = restoredRecord ? candidate ?? (closed === void 0 ? void 0 : {
				...parseSideChatMeta(closed.savedMeta),
				childId: closed.childId,
				parentSessionId: sessionId,
				...closed.topic !== void 0 ? { topic: closed.topic } : {},
				number: closed.savedMeta?.number,
				createdAt: closed.closedAt
			}) : void 0;
			const meta = {
				...restored,
				...params?.savedMeta,
				tabId: record.id,
				sessionId,
				...params?.childId !== void 0 ? { childId: params.childId } : {},
				parentSessionId: params?.parentSessionId ?? sessionId,
				...params?.pendingDraft !== void 0 ? { pendingDraft: params.pendingDraft } : {},
				...params?.topic !== void 0 ? { topic: params.topic } : {},
				number: params?.savedMeta?.number ?? restored?.number ?? nextSideChatNumber(sessionId),
				createdAt: restored?.createdAt ?? Date.now(),
				runId: SIDENOTE_RUN_ID
			};
			writeSideChatMeta(meta, { silent: true });
			return {
				created: true,
				meta
			};
		}
		/** 芯片标题：metaStore 兑现（topic 优先，编号回退——Delivery_05 单源）。 */
		function titleOf(sessionId, tabId) {
			return sideChatTitleOf(readSideChatMeta(sessionId, tabId));
		}
		/** 面板体外壳：把 useTabInfo（可能对未提交 record throw）也包进错误边界。 */
		function NativeSideChatBody(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeTabBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NativeSideChatBodyInner, { ...props }) });
		}
		/** 面板体：原生 tab → SideChatPanel 的 TabComponentProps 合成适配。 */
		function NativeSideChatBodyInner(props) {
			const { ctx, sessionId, reflow, annotations, useTabInfo } = props;
			const nativeTab = useTabInfo().tab;
			const { created, meta: reconciledMeta } = reconcileMeta(nativeTab, sessionId);
			const createdRef = (0, react.useRef)(false);
			if (created) createdRef.current = true;
			(0, react.useEffect)(() => {
				if (createdRef.current) {
					createdRef.current = false;
					notifySideChatMetaListeners();
				}
			}, []);
			const cwd = useSessionCwd(ctx, sessionId);
			const scope = (0, react.useMemo)(() => ({
				sessionId,
				...cwd !== void 0 ? { cwd } : {}
			}), [sessionId, cwd]);
			(0, react.useSyncExternalStore)(sideChatMetaStore.subscribe, sideChatMetaStore.getSnapshot);
			const meta = readSideChatMeta(sessionId, nativeTab.id) ?? reconciledMeta;
			const tabSignal = nativeTab.signal;
			(0, react.useEffect)(() => {
				const onAbort = () => {
					dropSideChatMeta(sessionId, nativeTab.id);
				};
				if (tabSignal.aborted) {
					onAbort();
					return;
				}
				tabSignal.addEventListener("abort", onAbort, { once: true });
				return () => {
					tabSignal.removeEventListener("abort", onAbort);
				};
			}, [
				nativeTab.id,
				tabSignal,
				sessionId
			]);
			const tab = {
				id: nativeTab.id,
				type: SIDE_TAB_TYPE,
				title: titleOf(sessionId, nativeTab.id),
				...meta === void 0 ? {} : { meta }
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: sidechat_module_css_default.nativeHost,
				"data-dsh-sidenote-native-host": "",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideChatPanel, {
					ctx,
					store: void 0,
					scope,
					tab,
					visible: nativeTab.visible,
					reflow,
					annotations,
					renderConversation: (reference, side) => renderSideConversation(props, reference, side),
					quoteRequestId: parseOpenParams(nativeTab.navigation.params)?.quoteRequestId
				})
			});
		}
		/** 极简错误边界：渲染期 throw 兜成错误态，不逃到原生 seat（直连后不再有
		*  better-sidebar 的 RenderBoundary 包裹）。 */
		var NativeTabBoundary = class extends react.Component {
			state = { error: null };
			static getDerivedStateFromError(error) {
				return { error: error instanceof Error ? error.message : String(error) };
			}
			componentDidCatch(error) {
				console.warn("[dsh-sidenote] 侧聊面板渲染崩溃:", error);
			}
			render() {
				if (this.state.error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						padding: 16,
						fontSize: 13
					},
					children: [t("sideChatCrashed"), this.state.error]
				});
				return this.props.children;
			}
		};
		/** 芯片活标题：metaStore 订阅 + 编号标题。 */
		function NativeSideChatTitle(props) {
			const { useTabInfo } = props;
			const info = useTabInfo();
			(0, react.useSyncExternalStore)(sideChatMetaStore.subscribe, sideChatMetaStore.getSnapshot);
			return titleOf(props.sessionId, info.tab.id);
		}
		/** 会话工作区根（better-sidebar useSessionCwd 同款）。 */
		function useSessionCwd(ctx, sessionId) {
			return (0, react.useSyncExternalStore)((0, react.useMemo)(() => (listener) => ctx.sessions.list.subscribe(listener), [ctx]), () => {
				return (ctx.sessions.list.getSnapshot().byId?.[sessionId])?.cwd;
			});
		}
		/**
		* 直连注册：类型 + body/title 槽。返回 disposer（插件 fiber 撤销时清场）。
		* 探测与分腿在调用方（sidechat/index.tsx）；本函数只在 sidebarRightTabs
		* 存在时被调用。
		*/
		function registerNativeSideChatTab(ctx, reflow, annotations) {
			ctx.inject(["sidebarRightTabs"], (injected) => {
				const tabs = injected.get("sidebarRightTabs");
				if (tabs === void 0) return;
				const disposeType = tabs.register({
					id: NATIVE_IMPL_ID,
					kind: SIDE_TAB_TYPE,
					priority: "extension",
					title: () => t("tabBaseTitle"),
					guide: [{
						order: 60,
						title: () => t("menuTitle"),
						icon: (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconNewChatOutline16, { size: props.size ?? 16 })
					}]
				});
				const disposeBody = ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
					name: "sidebar.right.pane.tab",
					key: NATIVE_IMPL_ID,
					children: { "sidenote.conversation": {
						kind: "single",
						scope: "session"
					} },
					inject: (sessionId) => ({
						ctx,
						sessionId,
						reflow,
						annotations
					})
				}, NativeSideChatBody));
				const disposeTitle = ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
					name: "sidebar.right.pane.tab.title",
					key: NATIVE_IMPL_ID,
					inject: (sessionId) => ({
						ctx,
						sessionId,
						reflow,
						annotations
					})
				}, NativeSideChatTitle));
				return () => {
					disposeBody();
					disposeTitle();
					disposeType();
				};
			});
		}
		//#endregion
		//#region src/client/sidechat/target.ts
		function captureSideChatTarget(ctx, parentId) {
			const panel = lastLiveSideChat(parentId);
			const tabs = collectSideTabs(betterSidebarOf(ctx)?.getSnapshot().state);
			const choice = {
				tabId: panel?.tabId ?? tabs.at(-1)?.id,
				childId: panel?.readStatus().childId
			};
			return {
				title: sideChatTargetTitle(ctx, parentId),
				resolve: (signal) => ensureSideChatTarget(ctx, parentId, signal, choice)
			};
		}
		/** Freeze a tab first and wait for that panel's actual child, with no string seed. */
		function ensureSideChatTarget(ctx, parentId, signal, choice) {
			return new Promise((resolve, reject) => {
				if (signal.aborted || currentSessionIdOf(ctx) !== parentId) {
					reject(/* @__PURE__ */ new Error("引用来源会话已切换"));
					return;
				}
				let tabId = choice?.tabId ?? lastLiveSideChat(parentId)?.tabId;
				const native = directNativeLeg(ctx);
				const bs = betterSidebarOf(ctx);
				if (tabId === void 0 && !native) {
					const tabs = collectSideTabs(bs?.getSnapshot().state);
					tabId = tabs[tabs.length - 1]?.id;
				}
				const opening = native ? sideChatOpening(parentId) : void 0;
				const requestId = crypto.randomUUID();
				let settled = false;
				let seen = tabId === void 0 ? void 0 : liveSideChat(tabId, parentId);
				let timer;
				let unsubscribe = () => {};
				const cleanup = () => {
					unsubscribe();
					signal.removeEventListener("abort", cancel);
					if (timer !== void 0) clearTimeout(timer);
				};
				const fail = (text) => {
					if (settled) return;
					settled = true;
					cleanup();
					reject(new Error(text));
				};
				const cancel = () => {
					fail("已取消保存引用");
				};
				if (choice?.tabId !== void 0 && seen === void 0 && (native || !collectSideTabs(bs?.getSnapshot().state).some((tab) => tab.id === choice.tabId))) {
					fail("目标侧边聊天已关闭；注解仍在编辑器中");
					return;
				}
				const check = () => {
					if (settled) return;
					if (signal.aborted || currentSessionIdOf(ctx) !== parentId) {
						fail("引用来源会话已切换");
						return;
					}
					if (tabId === void 0) tabId = opening?.target?.tabId ?? liveSideChatsOf(parentId).find((panel) => panel.readStatus().requestId === requestId)?.tabId;
					const panel = tabId === void 0 ? void 0 : liveSideChat(tabId, parentId);
					if (panel === void 0) {
						if (seen !== void 0) fail("目标侧边聊天已关闭；注解仍在编辑器中");
						return;
					}
					seen = panel;
					const status = panel.readStatus();
					if (choice?.childId !== void 0 && status.childId !== void 0 && status.childId !== choice.childId) {
						fail("目标侧边会话已改变；请保留注解并重新选择");
						return;
					}
					if (status.phase === "fork-error" || status.phase === "missing") {
						fail(status.error ?? "目标侧边聊天未能就绪");
						return;
					}
					if (status.phase !== "chat" || status.childId === void 0) return;
					const childId = status.childId;
					settled = true;
					cleanup();
					resolve({
						childId,
						title: panel.readTitle(),
						isOpen: () => liveSideChat(panel.tabId, parentId) === panel && panel.readStatus().phase === "chat" && panel.readStatus().childId === childId
					});
				};
				unsubscribe = subscribeLiveSideChats(check);
				signal.addEventListener("abort", cancel, { once: true });
				timer = setTimeout(() => fail("目标侧边聊天尚未就绪；请保留注解并重试"), 15e3);
				try {
					if (native && tabId === void 0 && opening === void 0) {
						const sidebar = sidebarRightOf(ctx);
						if (sidebar === void 0) {
							fail("宿主侧边聊天能力不可用");
							return;
						}
						sidebar.openTab(SIDE_TAB_TYPE, { params: {
							parentSessionId: parentId,
							quoteRequestId: requestId
						} });
						markSideChatOpening(parentId);
					} else if (choice?.tabId !== void 0) {
						if (native) focusNativeTab(ctx, choice.tabId);
						else bs?.activateTab(choice.tabId, { sessionId: parentId });
					} else if (!native || tabId !== void 0) {
						if (!openOrFocusSideChat(ctx, parentId)) {
							fail("无法打开目标侧边聊天");
							return;
						}
						if (!native && tabId === void 0) {
							const tabs = collectSideTabs(bs?.getSnapshot().state);
							tabId = tabs[tabs.length - 1]?.id;
						}
					}
					check();
				} catch (error) {
					fail(error instanceof Error ? error.message : String(error));
				}
			});
		}
		//#endregion
		//#region src/client/sidechat/header.tsx
		/**
		* 顶栏「侧边」入口（Delivery_02 Workitem_02 发现性）：注册进宿主的
		* `conversation.session.header.utilities` 槽位（会话头部右上角的工具条，
		* 「Session log」所在处）——侧边聊天从此有一个永远可见的视觉入口，
		* 不再只有 /side 斜杠命令和「+」菜单。
		*
		* 行为 = 打开或聚焦侧边聊天（与 bridge 同一编排 openOrFocusSideChat）。
		* blank 着陆页会话（无已完成 turn、fork 必败）不渲染按钮。
		*/
		function HeaderSideButton({ ctx }) {
			useLocaleTick();
			(0, react.useSyncExternalStore)((notify) => ctx.sessions.list.subscribe(notify), () => ctx.sessions.list.getSnapshot());
			const sessionId = currentSessionIdOf(ctx);
			if (sessionId === "" || !canForkFrom(ctx, sessionId)) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: sidechat_module_css_default.headerSide,
				title: t("headerSideTitle"),
				"aria-label": t("headerSideTitle"),
				onClick: () => {
					openOrFocusSideChat(ctx, sessionId);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconNewChatOutline16, { size: 13 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("headerSide") })]
			});
		}
		function registerHeaderEntry(ctx) {
			try {
				ctx.slots.inject("conversation.session.header.utilities", () => {
					return ctx.slots.register({
						name: "conversation.session.header.utilities",
						id: "dsh-sidenote-header",
						order: 10,
						registrant: "dsh-sidenote"
					}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeaderSideButton, { ctx }));
				});
			} catch (error) {
				console.warn("[dsh-sidenote] 顶栏入口注册失败（Tab 与 /side 不受影响）:", error);
			}
		}
		//#endregion
		//#region src/client/sidechat/slash.ts
		/** 0.1.5 信号：`connection.api.sessions` 面在 0.1.5 被删（与模型面迁移同判据）。 */
		function isDsh015Plus(ctx) {
			const legacy = ctx.connection?.api?.sessions;
			return legacy === void 0 || legacy === null;
		}
		/** 单个命令名对应的完整贡献（side / 侧边 共用）。 */
		function makeContribution(ctx, name) {
			return {
				name,
				description: isDsh015Plus(ctx) ? () => t("cmdDesc") : t("cmdDesc"),
				available: (session) => canForkFrom(ctx, session.sessionId),
				ui: {
					kind: "popupSelect",
					options: (session) => {
						const options = [];
						const native = directNativeLeg(ctx);
						const lives = native ? liveSideChatsOf(session.sessionId) : [];
						const liveIds = new Set(lives.map((live) => live.tabId));
						const unloaded = native ? sideChatMetasOf(session.sessionId).filter((meta) => !liveIds.has(meta.tabId)) : [];
						if (!native || lives.length === 0) options.push({
							id: "new",
							label: t("cmdNew"),
							detail: t("cmdNewDetail")
						});
						if (native) {
							for (const live of lives) options.push({
								id: `focus:${live.tabId}`,
								label: t("cmdFocus", { title: live.readTitle() }),
								detail: t("cmdFocusDetail")
							});
							for (const meta of unloaded) options.push({
								id: `focus:${meta.tabId}`,
								label: t("cmdFocus", { title: sideChatTitleOf(meta) }),
								detail: t("cmdFocusDetail")
							});
						} else {
							const snapshot = betterSidebarOf(ctx)?.getSnapshot();
							if (snapshot !== void 0 && snapshot.sessionId === session.sessionId && snapshot.state !== void 0) for (const tab of collectSideTabs(snapshot.state)) options.push({
								id: `focus:${tab.id}`,
								label: t("cmdFocus", { title: tab.title }),
								detail: t("cmdFocusDetail")
							});
						}
						if (!(native && lives.length > 0)) for (const entry of listClosedSideChats(session.sessionId)) options.push({
							id: `reopen:${entry.childId}`,
							label: t("cmdReopen", { title: entry.topic ?? entry.title }),
							detail: formatClosedAt(entry.closedAt)
						});
						return Promise.resolve(options);
					},
					onSelect: (option, session) => {
						if (option.id === "new") {
							createSideChat(ctx, session.sessionId);
							return;
						}
						if (option.id.startsWith("focus:")) {
							const tabId = option.id.slice(6);
							if (!focusNativeTab(ctx, tabId)) betterSidebarOf(ctx)?.activateTab(tabId, { sessionId: session.sessionId });
							return;
						}
						if (option.id.startsWith("reopen:")) {
							const childId = option.id.slice(7);
							const entry = listClosedSideChats(session.sessionId).find((e) => e.childId === childId);
							const opts = entry === void 0 ? void 0 : {
								...entry.topic !== void 0 ? { topic: entry.topic } : {},
								...entry.savedMeta !== void 0 ? { savedMeta: entry.savedMeta } : {}
							};
							if (reopenSideChat(ctx, session.sessionId, childId, opts)) dropClosedSideChat(session.sessionId, childId);
						}
					}
				}
			};
		}
		/** 注册 /side 与中文别名「/侧边」；不可行时静默降级（不影响 Tab 入口）。 */
		function registerSideCommand(ctx) {
			let commandUi;
			try {
				commandUi = ctx.get("commandUi");
			} catch {
				return;
			}
			if (commandUi === void 0 || typeof commandUi.register !== "function") return;
			for (const name of ["side", "侧边"]) try {
				ctx.effect(() => commandUi.register(makeContribution(ctx, name)), `dsh-sidenote: /${name} command`);
			} catch (error) {
				console.warn(`[dsh-sidenote] /${name} 命令注册失败（Tab 入口不受影响）:`, error);
			}
		}
		//#endregion
		//#region src/client/sidechat/referenceSource.ts
		const TRIGGER = "@";
		const SOURCE = "sidenote-side-chats";
		/**
		* 候选名 → childId 的映射缓存，按会话分键（Delivery_05 碰撞护栏）：onPick
		* 只能拿到候选 name 字符串（宿主 API 形状），topic 化标题后撞名成为可能
		* （legacy 多实例两个同主题）。candidates() 每次计算时重建本会话的映射
		* 并对重名追加序号消歧；onPick 只按 (sessionId, name) 查——跨会话复用
		* 陈旧候选拿不到 ref（审查 M2：全局单映射会把 A 会话的 childId 插进 B）。
		*/
		const lastCandidateRefs = /* @__PURE__ */ new Map();
		/** 候选名消歧（导出纯可测）：重名依次追加「 · 2」「 · 3」，本批内唯一。 */
		function dedupeName(name, taken) {
			if (!taken.has(name)) {
				taken.add(name);
				return name;
			}
			for (let n = 2;; n += 1) {
				const candidate = `${name} · ${n}`;
				if (!taken.has(candidate)) {
					taken.add(candidate);
					return candidate;
				}
			}
		}
		/** 侧聊内容 → 结构化引用块（问答成对，全文不截断）。 */
		async function serializeSideChatRef(ctx, childId) {
			const snap = chatSourceOf(ctx, ctx.sessions.binding(childId))?.getLegacy();
			const messages = transcriptOf(snap);
			const pairs = pairQuestions(messages);
			const parts = [];
			for (const m of messages) {
				if (m.role !== "assistant" || m.text === "" || m.streaming === true) continue;
				const q = pairs.get(m.key);
				if (q !== void 0) parts.push(`<问>${q}</问>`);
				parts.push(`<答>${m.text}</答>`);
			}
			return `<side-chat-reference source="${xmlAttr((() => {
				try {
					if (directNativeLeg(ctx)) {
						const meta = sideChatMetasAll().find((m) => m.childId === childId);
						if (meta !== void 0) return sideChatTitleOf(meta);
					}
					for (const tab of collectSideTabs(betterSidebarOf(ctx)?.getSnapshot().state)) if (parseSideChatMeta(tab.meta).childId === childId) return tab.title;
				} catch {}
				return childId;
			})())}" note="用户 @ 引用的侧边聊天内容（问答成对）">\n${parts.join("\n")}\n</side-chat-reference>`;
		}
		/** 注册「@ 侧聊」触发源；服务缺席静默降级（不影响其他入口）。 */
		function registerSideChatReferenceSource(ctx) {
			let svc;
			try {
				svc = ctx.get("inputTriggers");
			} catch {
				return;
			}
			if (svc === void 0 || typeof svc.registerSource !== "function") return;
			try {
				ctx.effect(() => svc.registerSource({
					trigger: TRIGGER,
					name: SOURCE,
					order: 50,
					candidates: (session) => {
						if (session?.sessionId === void 0) return Promise.resolve([]);
						const sessionId = session.sessionId;
						try {
							const base = [];
							if (directNativeLeg(ctx)) {
								for (const meta of sideChatMetasOf(sessionId)) if (meta.childId !== void 0) base.push({
									name: sideChatTitleOf(meta),
									childId: meta.childId
								});
							} else {
								const snapshot = betterSidebarOf(ctx)?.getSnapshot();
								if (snapshot === void 0 || snapshot.sessionId !== sessionId || snapshot.state === void 0) {
									lastCandidateRefs.set(sessionId, /* @__PURE__ */ new Map());
									return Promise.resolve([]);
								}
								for (const tab of collectSideTabs(snapshot.state)) {
									const childId = parseSideChatMeta(tab.meta).childId;
									if (childId !== void 0) base.push({
										name: tab.title,
										childId
									});
								}
							}
							const taken = /* @__PURE__ */ new Set();
							const refs = /* @__PURE__ */ new Map();
							const out = base.map((entry) => {
								const name = dedupeName(entry.name, taken);
								refs.set(name, entry.childId);
								return {
									name,
									description: "侧边聊天",
									icon: "💬"
								};
							});
							lastCandidateRefs.set(sessionId, refs);
							return Promise.resolve(out);
						} catch {
							lastCandidateRefs.set(sessionId, /* @__PURE__ */ new Map());
							return Promise.resolve([]);
						}
					},
					onPick: (pick) => {
						const session = pick.session;
						if (session?.sessionId === void 0) return void 0;
						const childId = lastCandidateRefs.get(session.sessionId)?.get(pick.candidate.name);
						if (childId === void 0) return void 0;
						return { insert: {
							source: SOURCE,
							ref: childId,
							label: pick.candidate.name,
							clipboardText: `@${pick.candidate.name}`
						} };
					},
					codec: {
						clipboardText: (ref) => `@${ref}`,
						serialize: (ref, _signal) => serializeSideChatRef(ctx, ref)
					}
				}), "dsh-sidenote: @ side-chat reference source");
			} catch (error) {
				console.warn("[dsh-sidenote] @ 引用源注册失败:", error);
			}
		}
		//#endregion
		//#region src/client/sidechat/notify.ts
		function registerCompletionNotify(ctx) {
			ctx.effect(() => {
				const watchers = /* @__PURE__ */ new Map();
				const collectAlive = () => sideChatMetasAll().flatMap((meta) => meta.childId === void 0 ? [] : [{
					childId: meta.childId,
					title: sideChatTitleOf(meta)
				}]);
				const rescan = () => {
					let tabs = [];
					try {
						tabs = collectAlive();
					} catch {
						return;
					}
					const alive = /* @__PURE__ */ new Set();
					for (const { childId } of tabs) {
						alive.add(childId);
						if (watchers.has(childId)) continue;
						try {
							const session = ctx.sessions.binding(childId)?.session;
							if (session === void 0) continue;
							openSessionWindow(session);
							const chat = chatSourceOf(ctx, ctx.sessions.binding(childId));
							if (!chat?.getLastTurnEnd) continue;
							const status = sessionStatusSource(ctx);
							const runningNow = () => status?.getSnapshot().get(childId)?.running ?? session.getSnapshot().running === true;
							const watcher = {
								unsub: () => {},
								wasRunning: runningNow(),
								lastEndSeq: chat.getLastTurnEnd()?.seq ?? -1
							};
							const check = () => {
								const running = runningNow();
								if (isPurgingInheritedTurn(childId)) {
									watcher.wasRunning = running;
									return;
								}
								const end = chat?.getLastTurnEnd?.();
								if (end && end.seq > watcher.lastEndSeq) {
									if (end.reason === "completed" && watcher.wasRunning) showToast(t("sideChatDone", { title: collectAlive().find((entry) => entry.childId === childId)?.title ?? t("tabBaseTitle") }));
									watcher.lastEndSeq = end.seq;
									watcher.wasRunning = running;
								} else if (running) watcher.wasRunning = true;
							};
							const offSession = session.subscribe(check);
							const offChat = chat?.subscribe(check);
							const offStatus = status?.subscribe(check);
							watcher.unsub = () => {
								offSession();
								offChat?.();
								offStatus?.();
							};
							watchers.set(childId, watcher);
						} catch {}
					}
					for (const [id, w] of watchers) if (!alive.has(id)) {
						w.unsub();
						watchers.delete(id);
					}
				};
				const offState = sideChatMetaStore.subscribe(rescan);
				const offLive = subscribeLiveSideChats(rescan);
				rescan();
				return () => {
					offState();
					offLive();
					for (const w of watchers.values()) w.unsub();
					watchers.clear();
				};
			}, "dsh-sidenote: completion notify");
		}
		//#endregion
		//#region src/client/sidechat/index.tsx
		function registerSideChat(ctx, reflow, annotations) {
			registerNativeConversation(ctx);
			registerNativeSideChatTab(ctx, reflow, annotations);
			ctx.effect(() => {
				const impl = { captureTarget: (sessionId) => captureSideChatTarget(ctx, sessionId) };
				sideChatBridge.current = impl;
				return () => {
					if (sideChatBridge.current === impl) sideChatBridge.current = null;
				};
			}, "dsh-sidenote: annotate bridge");
			registerSideCommand(ctx);
			registerSideChatReferenceSource(ctx);
			registerHeaderEntry(ctx);
			registerToastHost(ctx);
			registerCompletionNotify(ctx);
		}
		//#endregion
		//#region src/client/annotations/source.ts
		/** Explicit side bodies are the sole exception to the legacy sidebar exclusion. */
		function quoteSourceOf(node, currentSessionId) {
			const element = elementOf(node);
			if (element?.closest("button, [role=\"button\"], input, textarea, select, [contenteditable=\"true\"], [data-code-block-banner], [data-variant=\"think\"], [data-sidenote-no-quote]") !== null) return null;
			const body = element?.closest("[data-sidenote-quote-body]");
			if (body !== void 0 && body !== null) {
				const anchor = body.closest("[data-sidenote-message-key][data-sidenote-message-role=\"assistant\"]");
				const view = body.closest("[data-sidenote-chat-session]");
				const sessionId = view?.dataset.sidenoteChatSession;
				if (!sessionId || anchor === null || view === null) return null;
				return {
					body,
					anchor,
					view,
					sessionId,
					surface: "side",
					key: anchor.dataset.sidenoteMessageKey,
					streaming: body.dataset.sidenoteStreaming === "true"
				};
			}
			const native = mainMessageOf(node, currentSessionId);
			const side = element?.closest("[data-sidenote-chat-session]");
			if (native && side && native.sessionId === side.dataset.sidenoteChatSession) return {
				...native,
				view: side,
				surface: "side"
			};
			if (element?.closest("[data-dsh-better-sidebar], [data-dsh-sidenote], [data-sidenote-chat-session]") !== null) return null;
			return mainMessageOf(node, currentSessionId);
		}
		function sourceKey(source) {
			return source.key;
		}
		function sourceBodies(sessionId, surface, anchorKey, currentSessionId) {
			if (surface === "main") return mainAnchorBodies(sessionId, anchorKey, currentSessionId);
			return [...document.querySelectorAll("[data-sidenote-quote-body]"), ...nativeAssistantBodies()].filter((body) => {
				const source = quoteSourceOf(body, currentSessionId);
				return source?.surface === "side" && source.sessionId === sessionId && sourceKey(source) === anchorKey;
			});
		}
		/** The same text-node projection is used at capture and when rebuilding anchors.
		* Browser selections contain block newlines; anchor offsets deliberately do not. */
		function quoteTextNodes(body) {
			const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
			const nodes = [];
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (node.parentElement?.closest("button, [role=\"button\"], input, textarea, select, [contenteditable=\"true\"], [data-code-block-banner], [data-variant=\"think\"], [data-sidenote-no-quote]") !== null) continue;
				if (node.parentElement !== null && getComputedStyle(node.parentElement).userSelect === "none") continue;
				nodes.push(node);
			}
			return nodes;
		}
		function projectedRangeText(body, range) {
			return quoteTextNodes(body).map((node) => {
				if (!range.intersectsNode(node)) return "";
				const start = node === range.startContainer ? range.startOffset : 0;
				const end = node === range.endContainer ? range.endOffset : node.length;
				return node.data.slice(start, end);
			}).join("");
		}
		function selectedQuoteText(range, browserText, anchorText) {
			if (browserText.replace(/\s/g, "") === anchorText.replace(/\s/g, "")) return browserText;
			const fragment = range.cloneContents();
			for (const element of fragment.querySelectorAll(NON_QUOTE)) element.remove();
			const textOf = (node) => {
				if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
				if (node instanceof Element && node.tagName === "BR") return "\n";
				const text = [...node.childNodes].map(textOf).join("");
				return node instanceof Element && /^(P|DIV|LI|PRE|BLOCKQUOTE|H[1-6])$/.test(node.tagName) ? text + "\n" : text;
			};
			return textOf(fragment).trimEnd();
		}
		function sourceClip(source) {
			return quoteClipOf(source.body, source.view);
		}
		function focusSourceComposer(source) {
			if (source.surface === "main") focusMainComposer(source.view);
			else focusSideComposer(source.view);
		}
		//#endregion
		//#region src/client/annotate/selection.ts
		/**
		* Selection capture layer (Workitem 02): document-level listeners validate
		* the live selection and publish the latest valid one to the floating
		* toolbar through a small external-store controller. Mirrors the
		* production-proven dsh-sidebar-qa contract, narrowed to assistant messages:
		*
		* - both selection endpoints must sit in the SAME `[data-chat-flow-kind=
		*   "assistant-step"]` message node (跨消息划选不弹);
		* - `[data-streaming]` messages (still streaming) are excluded;
		* - explicit side assistant bodies are admitted; other sidebar/plugin UI is
		*   excluded; both endpoints belong to the same message and source view;
		* - quote text is kept complete, while anchor offsets use one DOM projection.
		*
		* These are DSH-internal DOM attributes rather than a public contract — an
		* upstream redesign silently degrades the feature (no popup), never crashes.
		*/
		/**
		* The 0-based ordinal of the selection's text among its occurrences in the
		* anchor element — the disambiguator for repeated phrases (re-anchor key).
		*/
		function occurrenceOf(anchor, range, text) {
			try {
				const pre = document.createRange();
				pre.selectNodeContents(anchor);
				pre.setEnd(range.startContainer, range.startOffset);
				const before = projectedRangeText(anchor, pre);
				let occurrence = 0;
				let at = before.indexOf(text);
				while (at !== -1) {
					occurrence += 1;
					at = before.indexOf(text, at + text.length);
				}
				return occurrence;
			} catch {
				return 0;
			}
		}
		/** Capture and validate the current window selection, or null when invalid. */
		function captureSelection(currentSessionId) {
			const sel = window.getSelection();
			if (sel === null || sel.isCollapsed || sel.rangeCount === 0) return null;
			const range = sel.getRangeAt(0);
			const source = quoteSourceOf(range.startContainer, currentSessionId);
			const end = quoteSourceOf(range.endContainer, currentSessionId);
			if (source === null || end === null || source.body !== end.body || source.view !== end.view || source.streaming) return null;
			const anchorText = projectedRangeText(source.body, range);
			if (anchorText.trim() === "") return null;
			const text = selectedQuoteText(range, sel.toString(), anchorText);
			const rect = range.getBoundingClientRect();
			return {
				text,
				anchorText,
				anchorKey: sourceKey(source),
				occurrence: occurrenceOf(source.body, range, anchorText),
				rect: {
					left: rect.left,
					top: rect.top,
					width: rect.width
				},
				range: range.cloneRange(),
				sessionId: source.sessionId,
				source
			};
		}
		/** Debounce for selectionchange (ms). */
		const DEBOUNCE_MS = 200;
		/** Create one selection controller (call once per plugin activation). */
		function createSelectionController(getSessionId) {
			let selection = null;
			const listeners = /* @__PURE__ */ new Set();
			let debounceTimer;
			let state = { selection: null };
			const notify = () => {
				state = { selection };
				for (const fn of [...listeners]) fn();
			};
			const recompute = () => {
				let next = null;
				try {
					next = captureSelection(getSessionId());
				} catch {
					next = null;
				}
				if (!(selection === null !== (next === null) || selection !== null && next !== null && (selection.anchorText !== next.anchorText || selection.anchorKey !== next.anchorKey || selection.sessionId !== next.sessionId || selection.source.view !== next.source.view || selection.source.surface !== next.source.surface || selection.rect.top !== next.rect.top || selection.rect.left !== next.rect.left || selection.rect.width !== next.rect.width))) return;
				selection = next;
				notify();
			};
			const onSelectionChange = () => {
				if (debounceTimer !== void 0) window.clearTimeout(debounceTimer);
				debounceTimer = window.setTimeout(recompute, DEBOUNCE_MS);
			};
			document.addEventListener("selectionchange", onSelectionChange);
			document.addEventListener("mouseup", recompute);
			document.addEventListener("keyup", onSelectionChange);
			return {
				getSnapshot: () => state,
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				clear() {
					selection = null;
					notify();
				},
				dispose() {
					document.removeEventListener("selectionchange", onSelectionChange);
					document.removeEventListener("mouseup", recompute);
					document.removeEventListener("keyup", onSelectionChange);
					if (debounceTimer !== void 0) window.clearTimeout(debounceTimer);
				}
			};
		}
		//#endregion
		//#region src/client/annotate/anchor.ts
		/**
		* Rebuild a range covering the `occurrence`-th appearance of `text` inside
		* `root`'s text nodes. An ordinal no longer present is hidden rather than moved to another phrase.
		*/
		function rangeOfOccurrence(root, text, occurrence) {
			if (text === "") return null;
			const nodes = quoteTextNodes(root);
			const haystack = nodes.map((node) => node.data).join("");
			let start = -1;
			let at = haystack.indexOf(text);
			let seen = 0;
			while (at !== -1) {
				if (seen === occurrence) {
					start = at;
					break;
				}
				seen += 1;
				at = haystack.indexOf(text, at + text.length);
			}
			if (start === -1) return null;
			const end = start + text.length;
			let offset = 0;
			let startNode = null;
			let startOffset = 0;
			let endNode = null;
			let endOffset = 0;
			for (const node of nodes) {
				const length = (node.textContent ?? "").length;
				const next = offset + length;
				if (startNode === null && start < next) {
					startNode = node;
					startOffset = start - offset;
				}
				if (startNode !== null && end <= next) {
					endNode = node;
					endOffset = end - offset;
					break;
				}
				offset = next;
			}
			if (startNode === null || endNode === null) return null;
			const range = document.createRange();
			range.setStart(startNode, startOffset);
			range.setEnd(endNode, endOffset);
			return range;
		}
		function resolveRange(annotation, cache, currentSessionId = "") {
			try {
				const sessionId = annotation.sourceSessionId ?? annotation.sessionId;
				const surface = annotation.sourceSurface ?? "main";
				const valid = (range, view) => {
					if (!range.startContainer.isConnected || !range.endContainer.isConnected) return false;
					const source = quoteSourceOf(range.startContainer, currentSessionId);
					const end = quoteSourceOf(range.endContainer, currentSessionId);
					return source !== null && end?.body === source.body && source.view === view && source.sessionId === sessionId && source.surface === surface && sourceKey(source) === annotation.anchorKey && !source.streaming && projectedRangeText(source.body, range) === annotation.anchorText;
				};
				const cached = cache.get(annotation.id);
				if (cached !== void 0 && valid(cached.range, cached.view)) return cached.range;
				cache.delete(annotation.id);
				if (annotation.anchorKey === void 0 || annotation.anchorText === "") return null;
				const bodies = sourceBodies(sessionId, surface, annotation.anchorKey, currentSessionId).filter((body) => body.getClientRects().length > 0);
				if (bodies.length !== 1) return null;
				const body = bodies[0];
				const source = quoteSourceOf(body, currentSessionId);
				if (source === null || source.streaming) return null;
				const range = rangeOfOccurrence(body, annotation.anchorText, annotation.occurrence);
				if (range !== null) cache.set(annotation.id, {
					range,
					view: source.view
				});
				return range;
			} catch {
				return null;
			}
		}
		/**
		* The badge anchor point of a range: 选区矩形右缘 (max right edge across
		* client rects — the message column's right edge for full-line selections,
		* the selection's text end for inline ones) at 选区首行高度 (first rect's
		* vertical center). Null when the range lays out to nothing.
		*/
		function badgeAnchorOf(range) {
			try {
				const rects = range.getClientRects();
				if (rects.length === 0) return null;
				let right = -Infinity;
				for (const rect of rects) right = Math.max(right, rect.right);
				const first = rects[0];
				if (first === void 0 || !Number.isFinite(right)) return null;
				return {
					right,
					centerY: first.top + first.height / 2
				};
			} catch {
				return null;
			}
		}
		/**
		* 角标的 gutter 落点（Delivery_02 W03）：角标统一钉在**消息列内容右缘**、
		* 锚点首行的垂直中心——行内划选时旧策略（选区末端+6px）会压住后续文字
		* （B3-P2③「分❶治」），右缘 gutter 永不遮挡正文，多角标自然纵向排开
		* （Google Docs 页边评论同款心智）。找不到宿主消息容器时回退旧策略。
		*/
		function gutterAnchorOf(range, currentSessionId = "") {
			const base = badgeAnchorOf(range);
			if (base === null) return null;
			try {
				const source = quoteSourceOf(range.startContainer, currentSessionId);
				if (source === null) return base;
				const rect = source.anchor.getBoundingClientRect();
				const clip = sourceClip(source);
				if (!Number.isFinite(rect.right) || rect.right <= 0) return base;
				return {
					right: Math.min(rect.right + 6, clip.right - 2),
					centerY: base.centerY
				};
			} catch {
				return base;
			}
		}
		/** Client rects of a range for the active-highlight overlay (empty on failure). */
		function highlightRectsOf(range) {
			try {
				const out = [];
				for (const rect of range.getClientRects()) {
					if (rect.width <= 0 || rect.height <= 0) continue;
					out.push({
						left: rect.left,
						top: rect.top,
						width: rect.width,
						height: rect.height
					});
				}
				return out;
			} catch {
				return [];
			}
		}
		/**
		* 角标落点错开：与已放置角标（|Δx|、|Δy| 均小于碰撞半径）冲突时按
		* BADGE_SPREAD_STEP 逐级下移——同一选区/相邻行的多个注释角标不再叠罗汉
		* （叠放时上层角标拦截下层角标的点击）。
		*/
		function spreadBadgePoint(point, placed) {
			let out = point;
			for (let guard = 0; guard < 50; guard++) {
				if (!placed.some((p) => Math.abs(p.x - out.x) < 18 && Math.abs(p.y - out.y) < 18)) return out;
				out = {
					x: out.x,
					y: out.y + 24
				};
			}
			return out;
		}
		//#endregion
		//#region \0dsh-css:E:\AI图书馆\DSH-学习库\01-插件与技能调研\原始素材\2026-10-27-sidenote-github发布\dsh-sidenote\src\client\annotate\annotate.module.css.mjs
		const css$1 = ".Ph7I3q_toolbar{z-index:50;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#00000014);user-select:none;border-radius:10px;align-items:stretch;display:flex;position:fixed;overflow:hidden;transform:translate(-50%,-100%);box-shadow:0 4px 16px #0000001f}.Ph7I3q_toolbarBelow{transform:translate(-50%)}.Ph7I3q_toolbarButton{appearance:none;color:var(--dsw-alias-label-primary,#1f2329);cursor:pointer;white-space:nowrap;background:0 0;border:none;padding:7px 12px;font-size:13px;line-height:20px}.Ph7I3q_toolbarButton+.Ph7I3q_toolbarButton{border-left:1px solid var(--dsw-alias-border-l1,#00000014)}.Ph7I3q_toolbarButton:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000d)}.Ph7I3q_badge{z-index:50;color:#fff;text-align:center;cursor:pointer;user-select:none;background:#2f88ff;border:none;border-radius:999px;width:18px;height:18px;padding:0;font-size:11px;font-weight:600;line-height:18px;position:fixed;transform:translateY(-50%);box-shadow:0 1px 4px #2f88ff73}.Ph7I3q_badge:hover{background:#1f78f0}.Ph7I3q_highlight{z-index:49;pointer-events:none;background:#2f88ff38;border-radius:2px;position:fixed}.Ph7I3q_editorNew{z-index:50;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#00000014);border-radius:999px;align-items:center;gap:8px;padding:6px 8px 6px 12px;display:flex;position:fixed;box-shadow:0 6px 24px #00000024}.Ph7I3q_editorEdit{z-index:50;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#00000014);border-radius:14px;flex-direction:column;display:flex;position:fixed;overflow:hidden;box-shadow:0 8px 28px #00000029}.Ph7I3q_editorInput{min-width:0;color:var(--dsw-alias-label-primary,#1f2329);background:0 0;border:none;outline:none;flex:auto;font-size:13px;line-height:22px}.Ph7I3q_editorTextarea{resize:none;color:var(--dsw-alias-label-primary,#1f2329);background:0 0;border:none;outline:none;padding:10px 12px 4px;font-family:inherit;font-size:13px;line-height:20px}.Ph7I3q_editorInput::placeholder,.Ph7I3q_editorTextarea::placeholder{color:var(--dsw-alias-label-caption,#8f959e)}.Ph7I3q_editorAsk{z-index:50;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#00000014);border-radius:14px;flex-direction:column;gap:2px;padding:6px 8px 6px 12px;display:flex;position:fixed;box-shadow:0 6px 24px #00000024}.Ph7I3q_editorAskRow{align-items:center;gap:8px;display:flex}.Ph7I3q_editorTarget{color:var(--dsw-alias-label-caption,#8f959e);user-select:none;padding:2px 2px 0;font-size:11px;line-height:16px}.Ph7I3q_confirmButton{color:#fff;cursor:pointer;background:#1f2329;border:none;border-radius:999px;flex:none;place-items:center;width:26px;height:26px;padding:0;display:grid}.Ph7I3q_confirmButton:hover{background:#000}.Ph7I3q_editorFooter{align-items:center;gap:8px;padding:6px 10px 8px;display:flex}.Ph7I3q_editorSpacer{flex:auto}.Ph7I3q_deleteButton{width:26px;height:26px;color:var(--dsw-alias-label-tertiary,#8f959e);cursor:pointer;background:0 0;border:none;border-radius:999px;place-items:center;padding:0;display:grid}.Ph7I3q_deleteButton:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000d);color:var(--dsw-alias-state-error-primary,#d53f3f)}.Ph7I3q_cancelButton,.Ph7I3q_saveButton{cursor:pointer;border:none;border-radius:999px;padding:4px 14px;font-size:13px;line-height:20px}.Ph7I3q_cancelButton{background:var(--dsw-alias-interactive-bg-hover,#0000000d);color:var(--dsw-alias-label-primary,#1f2329)}.Ph7I3q_saveButton{color:#fff;background:#1f2329}.Ph7I3q_saveButton:hover{background:#000}.Ph7I3q_editorError{color:#e5484d;white-space:nowrap;font-size:12px;position:absolute;top:calc(100% + 4px);left:12px}.Ph7I3q_badgeSent{background:var(--dsw-alias-label-caption,#8f959e);box-shadow:none;opacity:.75}.Ph7I3q_badgeSent:hover{background:var(--dsw-alias-label-tertiary,#6b7075)}.Ph7I3q_sentChip{border:1px solid var(--dsw-alias-border-l1,#0000001a);background:var(--dsw-alias-interactive-bg-hover,#0000000d);color:var(--dsw-alias-label-secondary,#3f454d);cursor:default;user-select:none;border-radius:999px;align-items:center;gap:4px;margin:0 0 6px;padding:1px 10px;font-size:12px;line-height:18px;display:inline-flex}.Ph7I3q_sentCardTitle{color:var(--dsw-alias-label-tertiary,#8f959e);padding:2px 12px 0;font-size:12px;font-weight:600}.Ph7I3q_sentCardQuote{color:var(--dsw-alias-label-secondary,#3f454d);border-left:2px solid var(--dsw-alias-border-l1,#0000001f);word-break:break-word;margin:4px 12px 0;padding:4px 12px;font-size:13px;line-height:20px}.Ph7I3q_sentCardNote{color:var(--dsw-alias-label-primary,#1f2329);word-break:break-word;padding:4px 12px 10px;font-size:13px;line-height:20px}.Ph7I3q_hint{z-index:50;background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l1,#00000014);max-width:320px;color:var(--dsw-alias-label-secondary,#3f454d);border-radius:12px;align-items:center;gap:10px;padding:10px 12px;font-size:12px;line-height:18px;animation:.25s ease-out Ph7I3q_dshSidenoteHintIn;display:flex;position:fixed;bottom:160px;right:24px;box-shadow:0 8px 28px #00000024}.Ph7I3q_hintClose{width:20px;height:20px;color:var(--dsw-alias-label-tertiary,#8f959e);cursor:pointer;background:0 0;border:none;border-radius:999px;flex:none;place-items:center;padding:0;font-size:14px;line-height:1;display:grid}.Ph7I3q_hintClose:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000d);color:var(--dsw-alias-label-primary,#1f2329)}@keyframes Ph7I3q_dshSidenoteHintIn{0%{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.Ph7I3q_sentChipRow{align-items:center;gap:6px;margin:0 0 6px;display:inline-flex}.Ph7I3q_badgeSent{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-tertiary,#8f959e);border:1.5px solid var(--dsw-alias-label-caption,#b0b5bb);box-shadow:none;opacity:1;line-height:15px}.Ph7I3q_badgeSent:hover{background:var(--dsw-alias-interactive-bg-hover,#0000000a);color:var(--dsw-alias-label-secondary,#3f454d)}.Ph7I3q_hint{background:color-mix(in srgb, var(--dsw-alias-bg-layer-1,#fff) 88%, transparent);backdrop-filter:blur(8px);bottom:130px}";
		const tagId$1 = "dsh-sidenote/annotate.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidenote";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var annotate_module_css_default = {
			"editorError": "Ph7I3q_editorError",
			"sentCardQuote": "Ph7I3q_sentCardQuote",
			"dshSidenoteHintIn": "Ph7I3q_dshSidenoteHintIn",
			"editorSpacer": "Ph7I3q_editorSpacer",
			"sentChipRow": "Ph7I3q_sentChipRow",
			"toolbarBelow": "Ph7I3q_toolbarBelow",
			"editorTarget": "Ph7I3q_editorTarget",
			"saveButton": "Ph7I3q_saveButton",
			"editorAskRow": "Ph7I3q_editorAskRow",
			"editorEdit": "Ph7I3q_editorEdit",
			"editorAsk": "Ph7I3q_editorAsk",
			"badgeSent": "Ph7I3q_badgeSent",
			"sentChip": "Ph7I3q_sentChip",
			"sentCardTitle": "Ph7I3q_sentCardTitle",
			"editorFooter": "Ph7I3q_editorFooter",
			"sentCardNote": "Ph7I3q_sentCardNote",
			"hint": "Ph7I3q_hint",
			"hintClose": "Ph7I3q_hintClose",
			"toolbar": "Ph7I3q_toolbar",
			"editorNew": "Ph7I3q_editorNew",
			"highlight": "Ph7I3q_highlight",
			"badge": "Ph7I3q_badge",
			"editorInput": "Ph7I3q_editorInput",
			"editorTextarea": "Ph7I3q_editorTextarea",
			"toolbarButton": "Ph7I3q_toolbarButton",
			"confirmButton": "Ph7I3q_confirmButton",
			"deleteButton": "Ph7I3q_deleteButton",
			"cancelButton": "Ph7I3q_cancelButton"
		};
		//#endregion
		//#region src/client/annotate/hint.tsx
		/**
		* 首次使用引导（Delivery_02 Workitem_02 发现性）：划选注释对新用户零暗示
		* （B1 盲测 8 分钟才发现）——在「页面已出现会话消息且用户从未见过引导」
		* 时，于对话区右下浮出一张一次性提示卡：关闭或 12s 后自动消失，
		* localStorage 记账，终身只此一次。
		*/
		const HINT_KEY = "dsh-sidenote:hint:v1";
		function hintSeen() {
			try {
				return globalThis.localStorage?.getItem(HINT_KEY) === "1";
			} catch {
				return true;
			}
		}
		function markHintSeen() {
			try {
				globalThis.localStorage?.setItem(HINT_KEY, "1");
			} catch {}
		}
		/** 消息流已在屏（任意会话流节点）。 */
		const hasMessages = hasConversationMessages;
		function FirstUseHint() {
			useLocaleTick();
			const [visible, setVisible] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (visible || hintSeen()) return;
				const poll = window.setInterval(() => {
					if (!hasMessages()) return;
					markHintSeen();
					setVisible(true);
				}, 2e3);
				return () => {
					window.clearInterval(poll);
				};
			}, [visible]);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const timer = window.setTimeout(() => {
					setVisible(false);
				}, 12e3);
				return () => {
					window.clearTimeout(timer);
				};
			}, [visible]);
			if (!visible) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: annotate_module_css_default.hint,
				role: "note",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("hintText") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: annotate_module_css_default.hintClose,
					"aria-label": t("hintClose"),
					onClick: () => {
						setVisible(false);
					},
					children: "×"
				})]
			});
		}
		//#endregion
		//#region src/client/annotations/boundary.tsx
		/** Crash guard: a render failure must never take the host page down. */
		var AnnotationBoundary = class extends react.Component {
			state = { failed: false };
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error) {
				console.error("[dsh-sidenote] annotate overlay crashed:", error);
			}
			render() {
				return this.state.failed ? null : this.props.children;
			}
		};
		//#endregion
		//#region src/client/annotate/overlay.tsx
		/**
		* The annotation overlay (Workitem 02): an independent React root appended to
		* `document.body` (marked `data-dsh-sidenote` so the selection listener
		* excludes it) rendering three fixed-position layers over the conversation:
		*
		* - the selection toolbar (Add to conversation / Ask in side chat),
		* - the numbered badge layer (锚定在选区矩形右缘、选区首行高度) plus the
		*   激活态高亮 (editor open only — 关闭后高亮消退只留角标),
		* - the annotation editor popover (新建态 ✓ / 重开态 🗑 取消 保存).
		*
		* Every layer is pointer-safe (toolbar buttons preventDefault their mousedown
		* so the selection survives until the click commits) and failure-safe (an
		* error boundary around the tree; layout math is wrapped in anchor.ts).
		*/
		/** Badge anchor of a freshly captured selection (editor placement on create). */
		function selectionBadgePoint(snapshot) {
			const anchor = badgeAnchorOf(snapshot.range);
			if (anchor === null) {
				const rect = snapshot.range.getBoundingClientRect();
				return {
					x: rect.right,
					y: rect.top + 10
				};
			}
			return {
				x: anchor.right,
				y: anchor.centerY
			};
		}
		function AnnotateOverlay(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotationBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotateOverlayInner, { ...props }) });
		}
		function AnnotateOverlayInner({ ctx, store, controller }) {
			useLocaleTick();
			const diagnostics = hostDiagnostics(ctx);
			(0, react.useSyncExternalStore)(diagnostics.subscribe, diagnostics.getSnapshot);
			const selectionState = (0, react.useSyncExternalStore)((0, react.useCallback)((cb) => controller.subscribe(cb), [controller]), () => controller.getSnapshot());
			(0, react.useSyncExternalStore)((0, react.useCallback)((cb) => store.subscribe(cb), [store]), () => store.getSnapshot());
			(0, react.useSyncExternalStore)((0, react.useCallback)((cb) => ctx.sessions.list.subscribe(cb), [ctx]), () => ctx.sessions.list.getSnapshot());
			const currentSessionId = currentSessionIdOf(ctx);
			const [editor, setEditor] = (0, react.useState)(null);
			const [sideDraft, setSideDraft] = (0, react.useState)(null);
			const [, setGeometryTick] = (0, react.useState)(0);
			const rangeCache = (0, react.useRef)(/* @__PURE__ */ new Map());
			(0, react.useEffect)(() => {
				let raf = 0;
				let debounce = 0;
				const bumpNow = () => {
					if (raf !== 0) return;
					raf = window.requestAnimationFrame(() => {
						raf = 0;
						setGeometryTick((tick) => tick + 1);
					});
				};
				const bumpDebounced = () => {
					if (debounce !== 0) window.clearTimeout(debounce);
					debounce = window.setTimeout(() => {
						debounce = 0;
						bumpNow();
					}, 100);
				};
				const observer = new MutationObserver((records) => {
					if (records.every((record) => (record.target instanceof Element ? record.target : record.target.parentElement)?.closest("[data-dsh-sidenote]"))) return;
					bumpDebounced();
				});
				try {
					observer.observe(document.body, {
						childList: true,
						subtree: true,
						characterData: true,
						attributes: true,
						attributeFilter: [
							"hidden",
							"aria-expanded",
							"data-sidenote-streaming",
							"style",
							"class"
						]
					});
				} catch {}
				window.addEventListener("resize", bumpNow);
				document.addEventListener("scroll", bumpNow, true);
				return () => {
					observer.disconnect();
					window.removeEventListener("resize", bumpNow);
					document.removeEventListener("scroll", bumpNow, true);
					if (raf !== 0) window.cancelAnimationFrame(raf);
					if (debounce !== 0) window.clearTimeout(debounce);
				};
			}, []);
			const selection = selectionState.selection;
			const addToConversation = (snapshot) => {
				const anchor = selectionBadgePoint(snapshot);
				const annotation = store.add({
					sessionId: snapshot.sessionId,
					sourceSessionId: snapshot.sessionId,
					sourceSurface: snapshot.source.surface,
					anchorKey: snapshot.anchorKey,
					text: snapshot.text,
					anchorText: snapshot.anchorText,
					occurrence: snapshot.occurrence,
					note: ""
				});
				const cached = snapshot.range.cloneRange();
				rangeCache.current.set(annotation.id, {
					range: cached,
					view: snapshot.source.view
				});
				setEditor({
					annotationId: annotation.id,
					mode: "new",
					x: anchor.x,
					y: anchor.y,
					bounds: sourceClip(snapshot.source),
					...snapshot.source.surface === "side" ? { targetTitle: snapshot.source.view.dataset.sidenoteViewTitle } : {}
				});
				controller.clear();
				window.getSelection()?.removeAllRanges();
			};
			const askInSideChat = (snapshot) => {
				const anchor = selectionBadgePoint(snapshot);
				const target = sideChatBridge.current?.captureTarget(snapshot.sessionId);
				const targetTitle = target?.title;
				setSideDraft({
					snapshot,
					x: anchor.x,
					y: anchor.y,
					abort: new AbortController(),
					target,
					...targetTitle !== void 0 ? { targetTitle } : {}
				});
				controller.clear();
				window.getSelection()?.removeAllRanges();
			};
			const commitSideDraft = async (note) => {
				if (sideDraft === null) return false;
				if (sideDraft.target === void 0) return false;
				try {
					const target = await sideDraft.target.resolve(sideDraft.abort.signal);
					if (sideDraft.abort.signal.aborted || currentSessionIdOf(ctx) !== sideDraft.snapshot.sessionId || !target.isOpen()) return false;
					const snapshot = sideDraft.snapshot;
					const annotation = store.add({
						sessionId: target.childId,
						sourceSessionId: snapshot.sessionId,
						sourceSurface: "main",
						anchorKey: snapshot.anchorKey,
						text: snapshot.text,
						anchorText: snapshot.anchorText,
						occurrence: snapshot.occurrence,
						note
					});
					rangeCache.current.set(annotation.id, {
						range: snapshot.range.cloneRange(),
						view: snapshot.source.view
					});
					setSideDraft((current) => current === sideDraft ? null : current);
					return true;
				} catch {
					return false;
				}
			};
			const [viewer, setViewer] = (0, react.useState)(null);
			const reopenAnnotation = (annotation, point) => {
				if (store.getSubmission(annotation.sessionId).pending) return;
				if (annotation.state === "sent") {
					setViewer({
						annotationId: annotation.id,
						...point
					});
					return;
				}
				setEditor({
					annotationId: annotation.id,
					mode: "edit",
					...point
				});
			};
			const closeEditor = () => setEditor(null);
			const editingAnnotation = editor === null ? void 0 : store.get(editor.annotationId);
			const viewingAnnotation = viewer === null ? void 0 : store.get(viewer.annotationId);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(FirstUseHint, {}),
				selection !== null && editor === null && sideDraft === null && viewer === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectionToolbar, {
					snapshot: selection,
					addAvailable: selection.source.surface === "side" || probeInput(ctx, selection.sessionId).state === "available" && hostDiagnostics(ctx).getSnapshot().capabilities.some((capability) => capability.id === "dock" && capability.state === "available"),
					sideChatAvailable: selection.source.surface === "main" && sideChatBridge.current !== null,
					onAdd: () => {
						addToConversation(selection);
					},
					onAsk: () => {
						askInSideChat(selection);
					}
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BadgeLayer, {
					store,
					sessionId: currentSessionId,
					cache: rangeCache.current,
					editingId: editor?.annotationId ?? viewer?.annotationId ?? null,
					onOpen: reopenAnnotation
				}),
				editingAnnotation !== void 0 && editor !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotationEditor, {
					annotation: editingAnnotation,
					mode: editor.mode,
					x: editor.x,
					y: editor.y,
					bounds: editor.bounds,
					targetTitle: editor.targetTitle,
					onSave: (note) => {
						store.setNote(editingAnnotation.id, note);
						closeEditor();
						const range = rangeCache.current.get(editingAnnotation.id)?.range;
						const source = range === void 0 ? null : quoteSourceOf(range.startContainer, currentSessionId);
						if (source !== null) requestAnimationFrame(() => {
							if (document.activeElement === document.body) focusSourceComposer(source);
						});
					},
					onDelete: () => {
						store.remove(editingAnnotation.id);
						rangeCache.current.delete(editingAnnotation.id);
						closeEditor();
					},
					onCancel: () => {
						if (editor.mode === "new") {
							store.remove(editingAnnotation.id);
							rangeCache.current.delete(editingAnnotation.id);
						}
						closeEditor();
					}
				}, `${editor.annotationId}:${editor.mode}`),
				sideDraft !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SideChatNoteEditor, {
					x: sideDraft.x,
					y: sideDraft.y,
					targetTitle: sideDraft.targetTitle,
					bounds: sourceClip(sideDraft.snapshot.source),
					onSave: commitSideDraft,
					onCancel: () => {
						sideDraft.abort.abort();
						setSideDraft(null);
					}
				}),
				viewingAnnotation !== void 0 && viewer !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SentViewer, {
					annotation: viewingAnnotation,
					x: viewer.x,
					y: viewer.y,
					bounds: viewer.bounds,
					onClose: () => {
						setViewer(null);
					}
				})
			] });
		}
		/** sent 态注释的只读回看卡片（引用 + 注解，无编辑按钮；Esc/外点关闭）。 */
		function SentViewer(props) {
			useLocaleTick();
			const rootRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						props.onClose();
					}
				};
				const onMouseDown = (event) => {
					const root = rootRef.current;
					if (root === null || !(event.target instanceof Node)) return;
					if (root.contains(event.target)) return;
					if (event.target instanceof Element && event.target.closest("[data-dsh-sidenote]") !== null) return;
					props.onClose();
				};
				document.addEventListener("keydown", onKeyDown, true);
				document.addEventListener("mousedown", onMouseDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("mousedown", onMouseDown, true);
				};
			}, []);
			const width = popoverWidth(320, props.bounds);
			const left = popoverLeft(props.x, width, props.bounds);
			const top = popoverTop(props.y, 120, props.bounds);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: annotate_module_css_default.editorEdit,
				style: {
					left,
					top,
					width,
					maxHeight: (props.bounds?.bottom ?? window.innerHeight) - top - 8,
					overflowY: "auto"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.sentCardTitle,
						children: t("sentCardTitle", { n: props.annotation.number })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.sentCardQuote,
						children: props.annotation.text
					}),
					props.annotation.note !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.sentCardNote,
						children: props.annotation.note
					})
				]
			});
		}
		/**
		* 浮层水平落点（W03）：优先锚点右侧；右侧剩余空间不足（贴着展开的
		* better-sidebar 面板时必然不足——角标 gutter 就在消息列右缘）翻到左侧。
		* 右边界取面板左缘（[data-dsh-better-sidebar]，better-sidebar 的根锚点——
		* 仅在装了它的宿主上存在，查不到按视口）。
		*/
		function popoverWidth(width, bounds) {
			return Math.min(width, Math.max(0, (bounds?.right ?? window.innerWidth) - (bounds?.left ?? 0) - 16));
		}
		function popoverTop(y, height, bounds) {
			return Math.max((bounds?.top ?? 0) + 8, Math.min((bounds?.bottom ?? window.innerHeight) - height, y - 20));
		}
		function popoverLeft(x, width, bounds) {
			const rightBound = bounds?.right ?? window.innerWidth;
			const leftBound = bounds?.left ?? 0;
			const preferRight = x + 16;
			if (preferRight + width + 8 <= rightBound) return preferRight;
			return Math.max(leftBound + 8, Math.min(rightBound - width - 8, x - width - 16));
		}
		/** 「Ask in side chat」的注解编辑器（新建态同构：输入框 + ✓，允许空注解）。
		*  bridge 失败时不关编辑器、给出内联错误——用户写好的注解不丢。 */
		function SideChatNoteEditor(props) {
			useLocaleTick();
			const [note, setNote] = (0, react.useState)("");
			const [failed, setFailed] = (0, react.useState)(false);
			const [pending, setPending] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const latest = (0, react.useRef)({
				note,
				onSave: props.onSave,
				onCancel: props.onCancel
			});
			latest.current = {
				note,
				onSave: props.onSave,
				onCancel: props.onCancel
			};
			const saved = (0, react.useRef)(false);
			const failedRef = (0, react.useRef)(false);
			const cancelled = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				cancelled.current = false;
				return () => {
					cancelled.current = true;
				};
			}, []);
			const save = (outside = false) => {
				if (saved.current || cancelled.current || outside && failedRef.current) return;
				saved.current = true;
				const finish = (ok) => {
					if (cancelled.current) return;
					saved.current = ok;
					failedRef.current = !ok;
					setFailed(!ok);
					setPending(false);
				};
				try {
					const result = latest.current.onSave(latest.current.note);
					if (typeof result === "boolean") finish(result);
					else {
						setPending(true);
						result.then(finish, () => {
							finish(false);
						});
					}
				} catch {
					finish(false);
				}
			};
			const saveRef = (0, react.useRef)(save);
			saveRef.current = save;
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						cancelled.current = true;
						latest.current.onCancel();
					}
				};
				const onMouseDown = (event) => {
					const root = rootRef.current;
					if (root === null || !(event.target instanceof Node)) return;
					if (root.contains(event.target)) return;
					if (event.target instanceof Element && event.target.closest("[data-dsh-sidenote]") !== null) return;
					saveRef.current(true);
				};
				document.addEventListener("keydown", onKeyDown, true);
				document.addEventListener("mousedown", onMouseDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("mousedown", onMouseDown, true);
				};
			}, []);
			const width = popoverWidth(320, props.bounds);
			const left = popoverLeft(props.x, width, props.bounds);
			const top = popoverTop(props.y, 120, props.bounds);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: annotate_module_css_default.editorAsk,
				style: {
					left,
					top,
					width
				},
				children: [
					props.targetTitle !== void 0 && props.targetTitle !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.editorTarget,
						children: t("sendToTarget", { title: props.targetTitle })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: annotate_module_css_default.editorAskRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: annotate_module_css_default.editorInput,
							value: note,
							placeholder: t("sideNotePlaceholder"),
							"aria-label": t("sideNoteAria"),
							autoFocus: true,
							disabled: pending,
							onChange: (event) => {
								setNote(event.target.value);
								failedRef.current = false;
								setFailed(false);
							},
							onKeyDown: (event) => {
								if (event.key !== "Enter") return;
								if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
								event.preventDefault();
								save();
							}
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: annotate_module_css_default.confirmButton,
							title: t("confirmTitle"),
							"aria-label": t("confirmAskAria"),
							onClick: () => {
								save();
							},
							disabled: pending,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline16, { size: 14 })
						})]
					}),
					failed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.editorError,
						children: t("openSideFailed")
					}),
					pending && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.editorTarget,
						role: "status",
						children: t("sideTargetWaiting")
					})
				]
			});
		}
		/** The floating two-button toolbar above a validated selection. */
		function SelectionToolbar(props) {
			useLocaleTick();
			if (!props.snapshot.source.body.isConnected || props.snapshot.range.getClientRects().length === 0) return null;
			const rect = props.snapshot.range.getBoundingClientRect();
			const clip = sourceClip(props.snapshot.source);
			const halfWidth = Math.min(props.sideChatAvailable ? 160 : 80, (clip.right - clip.left - 16) / 2);
			const left = Math.max(clip.left + halfWidth + 8, Math.min(clip.right - halfWidth - 8, rect.left + rect.width / 2));
			const flipBelow = rect.top < clip.top + 64;
			const selectionBottom = props.snapshot.range.getBoundingClientRect().bottom;
			const top = flipBelow ? Math.max(clip.top + 4, Math.min(clip.bottom - 48, selectionBottom + 10)) : Math.max(clip.top + 44, rect.top - 10);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: flipBelow ? `${annotate_module_css_default.toolbar} ${annotate_module_css_default.toolbarBelow}` : annotate_module_css_default.toolbar,
				style: {
					left,
					top,
					maxWidth: Math.max(0, clip.right - clip.left - 16)
				},
				role: "toolbar",
				"aria-label": t("toolbarAria"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: annotate_module_css_default.toolbarButton,
						disabled: !props.addAvailable,
						title: !props.addAvailable ? t("quoteWorkflowWaiting") : void 0,
						onMouseDown: (event) => {
							event.preventDefault();
						},
						onClick: (event) => {
							event.preventDefault();
							event.stopPropagation();
							props.onAdd();
						},
						children: t("addToConversation")
					}),
					props.sideChatAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: annotate_module_css_default.toolbarButton,
						onMouseDown: (event) => {
							event.preventDefault();
						},
						onClick: (event) => {
							event.preventDefault();
							event.stopPropagation();
							props.onAsk();
						},
						children: t("askInSideChat")
					}),
					!props.addAvailable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: annotate_module_css_default.toolbarButton,
						role: "status",
						children: t("quoteWorkflowWaiting")
					})
				]
			});
		}
		/** The badge layer (one numbered circle per annotation) + the active highlight. */
		function BadgeLayer(props) {
			const annotations = props.store.sessions().flatMap((id) => props.store.list(id));
			const badges = [];
			const placed = [];
			let highlight = null;
			const [hoveredId, setHoveredId] = (0, react.useState)(null);
			const highlightId = props.editingId ?? hoveredId;
			for (const annotation of annotations) {
				const range = resolveRange(annotation, props.cache, props.sessionId);
				if (range === null) continue;
				const source = quoteSourceOf(range.startContainer, props.sessionId);
				if (source === null) continue;
				const clip = sourceClip(source);
				if (annotation.id === highlightId) highlight = highlightRectsOf(range).map((rect) => {
					const left = Math.max(rect.left, clip.left), top = Math.max(rect.top, clip.top);
					return {
						left,
						top,
						width: Math.min(rect.left + rect.width, clip.right) - left,
						height: Math.min(rect.top + rect.height, clip.bottom) - top
					};
				}).filter((rect) => rect.width > 0 && rect.height > 0).map((rect, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: annotate_module_css_default.highlight,
					style: {
						left: rect.left,
						top: rect.top,
						width: rect.width,
						height: rect.height
					}
				}, `hl-${index}`));
				const anchor = gutterAnchorOf(range, props.sessionId);
				if (anchor === null) continue;
				if (anchor.centerY < clip.top + 9 || anchor.centerY > clip.bottom - 9 || anchor.right - 18 < clip.left || anchor.right > clip.right) continue;
				const point = spreadBadgePoint({
					x: anchor.right,
					y: anchor.centerY
				}, placed);
				if (point.y > clip.bottom - 9) continue;
				placed.push(point);
				badges.push(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: annotation.state === "sent" ? `${annotate_module_css_default.badge} ${annotate_module_css_default.badgeSent}` : annotate_module_css_default.badge,
					style: {
						left: point.x - 18,
						top: point.y
					},
					title: annotation.state === "sent" ? t("sentBadgeTitle", { n: annotation.number }) : annotation.note === "" ? annotation.text : `${annotation.text}\n${t("noteLine", { note: annotation.note })}`,
					"aria-label": source.surface === "side" ? `${annotation.number} · ${source.view.dataset.sidenoteViewTitle ?? ""}` : void 0,
					onMouseEnter: () => {
						setHoveredId(annotation.id);
					},
					onMouseLeave: () => {
						setHoveredId(null);
					},
					onClick: (event) => {
						event.preventDefault();
						event.stopPropagation();
						props.onOpen(annotation, {
							...point,
							bounds: clip,
							targetTitle: source.view.dataset.sidenoteViewTitle
						});
					},
					children: annotation.number
				}, annotation.id));
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [highlight, badges] });
		}
		/**
		* The annotation editor popover. 新建态: input + ✓ 确认 (允许空注解直接保存;
		* 点击外部 = 确认、Esc = 取消，无显式取消按钮). 重开态: 已有注解 + 🗑 删除 +
		* 取消/保存.
		*
		* 导出供单测直接挂载（tests/annotate-editor.spec.tsx）。
		*/
		function AnnotationEditor(props) {
			useLocaleTick();
			const [note, setNote] = (0, react.useState)(props.annotation.note);
			const rootRef = (0, react.useRef)(null);
			const noteRef = (0, react.useRef)(note);
			noteRef.current = note;
			(0, react.useEffect)(() => {
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						props.onCancel();
					}
				};
				const onMouseDown = (event) => {
					const root = rootRef.current;
					if (root === null || !(event.target instanceof Node)) return;
					if (root.contains(event.target)) return;
					if (event.target instanceof Element && event.target.closest("[data-dsh-sidenote]") !== null) return;
					if (props.mode === "new") {
						if (noteRef.current.trim() === "") props.onCancel();
						else props.onSave(noteRef.current);
					} else props.onCancel();
				};
				document.addEventListener("keydown", onKeyDown, true);
				document.addEventListener("mousedown", onMouseDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("mousedown", onMouseDown, true);
				};
			}, []);
			const width = popoverWidth(props.mode === "new" ? 320 : 340, props.bounds);
			const left = popoverLeft(props.x, width, props.bounds);
			const top = popoverTop(props.y, 120, props.bounds);
			const save = () => {
				props.onSave(note);
			};
			if (props.mode === "new") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: props.targetTitle === void 0 ? annotate_module_css_default.editorNew : annotate_module_css_default.editorAsk,
				style: {
					left,
					top,
					width
				},
				children: [props.targetTitle !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: annotate_module_css_default.editorTarget,
					children: t("sendToTarget", { title: props.targetTitle })
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: annotate_module_css_default.editorAskRow,
					style: { flex: 1 },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						className: annotate_module_css_default.editorInput,
						value: note,
						placeholder: t("notePlaceholder"),
						autoFocus: true,
						onChange: (event) => {
							setNote(event.target.value);
						},
						onKeyDown: (event) => {
							if (event.key !== "Enter") return;
							if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
							event.preventDefault();
							save();
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: annotate_module_css_default.confirmButton,
						title: t("confirmTitle"),
						"aria-label": t("saveNoteAria"),
						onClick: save,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline16, { size: 14 })
					})]
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: annotate_module_css_default.editorEdit,
				style: {
					left,
					top,
					width
				},
				children: [
					props.targetTitle !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: annotate_module_css_default.editorTarget,
						children: t("sendToTarget", { title: props.targetTitle })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
						className: annotate_module_css_default.editorTextarea,
						value: note,
						placeholder: t("notePlaceholder"),
						rows: 3,
						autoFocus: true,
						onChange: (event) => {
							setNote(event.target.value);
						},
						onKeyDown: (event) => {
							if (event.key !== "Enter" || event.shiftKey) return;
							if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
							event.preventDefault();
							save();
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: annotate_module_css_default.editorFooter,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: annotate_module_css_default.deleteButton,
								title: t("deleteNote"),
								"aria-label": t("deleteNote"),
								onClick: props.onDelete,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrashOutline16, { size: 14 })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: annotate_module_css_default.editorSpacer }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: annotate_module_css_default.cancelButton,
								onClick: props.onCancel,
								children: t("cancel")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: annotate_module_css_default.saveButton,
								onClick: save,
								children: t("save")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:E:\AI图书馆\DSH-学习库\01-插件与技能调研\原始素材\2026-10-27-sidenote-github发布\dsh-sidenote\src\client\annotations\annotations.module.css.mjs
		const css = ".Z_5OxW_chipWrap{box-sizing:border-box;width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px));max-width:var(--dsh-composer-card-max-width,780px);background:var(--dsw-alias-bg-base);flex-wrap:wrap;align-items:center;gap:6px;margin:0 auto;padding:2px 0;display:flex}.Z_5OxW_chip{--chip-surface:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);background:var(--chip-surface);color:var(--dsw-alias-label-secondary);border-radius:10px;align-items:center;transition:background .12s,color .12s;display:inline-flex;position:relative}.Z_5OxW_chip:hover,.Z_5OxW_chip:focus-within,.Z_5OxW_chip[data-open]{--chip-surface:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.Z_5OxW_chipMain{border-radius:inherit;min-height:28px;color:inherit;font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:5px;padding:3px 9px;font-size:12px;line-height:18px;display:inline-flex}.Z_5OxW_chipDismissShade{border-radius:inherit;background:linear-gradient(to right, transparent, var(--chip-surface) 45%);opacity:0;pointer-events:none;justify-content:flex-end;align-items:center;width:38px;transition:opacity .16s ease-out;display:flex;position:absolute;inset:0 3px 0 auto}.Z_5OxW_chipDismiss{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;transition:transform .16s ease-out,background .12s,color .12s;display:inline-flex;transform:translate(2px)scale(.94)}.Z_5OxW_chip:hover .Z_5OxW_chipDismissShade,.Z_5OxW_chip:focus-within .Z_5OxW_chipDismissShade{opacity:1}.Z_5OxW_chip:hover .Z_5OxW_chipDismiss,.Z_5OxW_chip:focus-within .Z_5OxW_chipDismiss{pointer-events:auto;transform:none}.Z_5OxW_chipDismiss:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.Z_5OxW_chipDismiss:disabled{opacity:.45;cursor:default}.Z_5OxW_contextPanel{box-sizing:border-box;z-index:1000;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:14px;padding:4px;animation:.12s ease-out Z_5OxW_contextAppear;position:fixed;overflow:auto;box-shadow:0 8px 28px #0000001f}.Z_5OxW_contextList{margin:0;padding:0;list-style:none}.Z_5OxW_contextItem{border-radius:10px;align-items:flex-start;gap:10px;margin:0;padding:8px 10px;transition:background .12s;display:flex}.Z_5OxW_contextItem+.Z_5OxW_contextItem{border-top:1px solid var(--dsw-alias-border-l1)}.Z_5OxW_contextItem:hover,.Z_5OxW_contextItem:focus-within{background:var(--dsw-alias-interactive-bg-hover)}.Z_5OxW_contextNumber{min-width:16px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex:none;font-size:12px;line-height:21px}.Z_5OxW_contextContent{flex:1;min-width:0}.Z_5OxW_contextLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.Z_5OxW_contextLabel:not(:first-child){margin-top:6px}.Z_5OxW_contextSource{color:var(--dsw-alias-label-secondary);margin-bottom:8px;font-size:12px}.Z_5OxW_contextText{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text;font-size:13px;line-height:1.6}.Z_5OxW_contextActions{flex:none;gap:2px;display:flex}.Z_5OxW_contextAction{width:26px;height:26px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:8px;justify-content:center;align-items:center;padding:0;transition:color .12s,background .12s;display:inline-flex}.Z_5OxW_contextAction:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.Z_5OxW_contextAction:disabled,.Z_5OxW_chipClearAll:disabled{opacity:.45;cursor:default}.Z_5OxW_contextEditor{box-sizing:border-box;resize:vertical;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);width:100%;min-height:64px;color:inherit;font:inherit;border-radius:6px;margin-top:4px;padding:6px 8px;font-size:13px;line-height:1.6;display:block}.Z_5OxW_contextFooter{padding:2px 10px 4px}.Z_5OxW_chipClearAll{color:var(--dsw-alias-label-tertiary);cursor:pointer;font:inherit;background:0 0;border:0;border-radius:6px;padding:4px 6px;font-size:12px}.Z_5OxW_chipClearAll:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-error-primary)}.Z_5OxW_chipMain:focus-visible,.Z_5OxW_chipDismiss:focus-visible,.Z_5OxW_contextAction:focus-visible,.Z_5OxW_chipClearAll:focus-visible,.Z_5OxW_contextEditor:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.Z_5OxW_storageNotice{color:var(--dsw-alias-label-secondary);flex-basis:100%;font-size:12px}@keyframes Z_5OxW_contextAppear{0%{opacity:0;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}@media (hover:none){.Z_5OxW_chipMain{padding-right:32px}.Z_5OxW_chipDismissShade{opacity:1}.Z_5OxW_chipDismiss{pointer-events:auto;transform:none}}@media (prefers-reduced-motion:reduce){.Z_5OxW_contextPanel{animation:none}.Z_5OxW_chip,.Z_5OxW_chipDismissShade,.Z_5OxW_chipDismiss,.Z_5OxW_contextItem,.Z_5OxW_contextAction{transition:none}}.Z_5OxW_sentContext{color:var(--dsw-alias-label-secondary);margin:8px 0;font-size:13px}.Z_5OxW_sentContext summary{cursor:pointer}.Z_5OxW_sentContext pre,.Z_5OxW_sentContext blockquote{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.Z_5OxW_userContextHost{display:contents}[data-sidenote-context-replaced]{display:none!important}.Z_5OxW_sentChips{white-space:normal;display:inline}.Z_5OxW_sentChipGroup{display:inline}.Z_5OxW_sentChip{vertical-align:middle;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font:inherit;border:0;border-radius:6px;align-items:center;gap:4px;margin:0 6px 2px 0;padding:2px 6px;font-size:12px;line-height:18px;transition:background .14s,color .14s;display:inline-flex}button.Z_5OxW_sentChip{cursor:pointer}button.Z_5OxW_sentChip:hover,button.Z_5OxW_sentChip[aria-expanded=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover-solid)}button.Z_5OxW_sentChip:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}.Z_5OxW_sentChevron,.Z_5OxW_sentChevronOpen{opacity:.65;flex:none;transition:transform .14s}.Z_5OxW_sentChevronOpen{transform:rotate(180deg)}.Z_5OxW_sentPreview{text-align:left;white-space:normal}@media (prefers-reduced-motion:reduce){.Z_5OxW_sentChip,.Z_5OxW_sentChevron,.Z_5OxW_sentChevronOpen{transition:none}}";
		const tagId = "dsh-sidenote/annotations.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidenote";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var annotations_module_css_default = {
			"chipDismiss": "Z_5OxW_chipDismiss",
			"userContextHost": "Z_5OxW_userContextHost",
			"contextItem": "Z_5OxW_contextItem",
			"chipMain": "Z_5OxW_chipMain",
			"contextContent": "Z_5OxW_contextContent",
			"chip": "Z_5OxW_chip",
			"contextText": "Z_5OxW_contextText",
			"storageNotice": "Z_5OxW_storageNotice",
			"contextSource": "Z_5OxW_contextSource",
			"sentChips": "Z_5OxW_sentChips",
			"chipWrap": "Z_5OxW_chipWrap",
			"contextPanel": "Z_5OxW_contextPanel",
			"contextNumber": "Z_5OxW_contextNumber",
			"sentChipGroup": "Z_5OxW_sentChipGroup",
			"sentChevron": "Z_5OxW_sentChevron",
			"contextAction": "Z_5OxW_contextAction",
			"chipDismissShade": "Z_5OxW_chipDismissShade",
			"contextList": "Z_5OxW_contextList",
			"contextFooter": "Z_5OxW_contextFooter",
			"contextAppear": "Z_5OxW_contextAppear",
			"sentContext": "Z_5OxW_sentContext",
			"sentChevronOpen": "Z_5OxW_sentChevronOpen",
			"contextLabel": "Z_5OxW_contextLabel",
			"contextEditor": "Z_5OxW_contextEditor",
			"chipClearAll": "Z_5OxW_chipClearAll",
			"sentChip": "Z_5OxW_sentChip",
			"sentPreview": "Z_5OxW_sentPreview",
			"contextActions": "Z_5OxW_contextActions"
		};
		//#endregion
		//#region src/client/annotations/chip.tsx
		/** Shared, compact context dock for both native composers. */
		function AnnotationDetail({ item, store, pending, onEdit }) {
			const [editing, setEditing] = (0, react.useState)(false);
			const [note, setNote] = (0, react.useState)(item.note);
			const cancelled = (0, react.useRef)(false);
			const save = () => {
				if (!cancelled.current) store.setNote(item.id, note);
				setEditing(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: annotations_module_css_default.contextItem,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: annotations_module_css_default.contextNumber,
						children: [item.number, "."]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: annotations_module_css_default.contextContent,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: annotations_module_css_default.contextLabel,
								children: t("selectedText")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: annotations_module_css_default.contextText,
								children: item.text
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: annotations_module_css_default.contextLabel,
								children: t("userComment")
							}),
							editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
								autoFocus: true,
								rows: 3,
								className: annotations_module_css_default.contextEditor,
								"aria-label": t("userComment"),
								value: note,
								onChange: (event) => {
									setNote(event.target.value);
								},
								onBlur: save,
								onKeyDown: (event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										event.stopPropagation();
										cancelled.current = true;
										setEditing(false);
									}
									if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
										event.preventDefault();
										save();
									}
								}
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: annotations_module_css_default.contextText,
								children: item.note || /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: annotations_module_css_default.contextLabel,
									children: t("noNote")
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: annotations_module_css_default.contextActions,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: annotations_module_css_default.contextAction,
							disabled: pending,
							"aria-label": t(editing ? "saveNoteAria" : "editNoteAria"),
							title: t(editing ? "saveNoteAria" : "editNoteAria"),
							onMouseDown: (event) => {
								if (editing) event.preventDefault();
							},
							onClick: () => {
								if (editing) save();
								else {
									cancelled.current = false;
									setNote(item.note);
									setEditing(true);
									onEdit();
								}
							},
							children: editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline16, { size: 16 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconEditOutline16, { size: 16 })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: annotations_module_css_default.contextAction,
							disabled: pending,
							"aria-label": t("removeAria", { n: item.number }),
							title: t("removeTitle"),
							onClick: () => {
								store.remove(item.id);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrashOutline16, { size: 16 })
						})]
					})
				]
			});
		}
		function ContextChips({ ctx, store, reflow, sessionId }) {
			useLocaleTick();
			(0, react.useSyncExternalStore)(store.subscribe, store.getSnapshot);
			(0, react.useSyncExternalStore)(reflow.subscribe, reflow.getSnapshot);
			const diagnostics = hostDiagnostics(ctx);
			const capabilities = (0, react.useSyncExternalStore)(diagnostics.subscribe, diagnostics.getSnapshot);
			const [open, setOpen] = (0, react.useState)(null);
			const [position, setPosition] = (0, react.useState)({ visibility: "hidden" });
			const root = (0, react.useRef)(null);
			const panel = (0, react.useRef)(null);
			const timer = (0, react.useRef)(void 0);
			const id = (0, react.useId)();
			const clearTimer = () => {
				clearTimeout(timer.current);
				timer.current = void 0;
			};
			const active = store.listActive(sessionId);
			const reflows = reflow.list(sessionId);
			const submission = store.getSubmission(sessionId);
			const hasItems = open?.kind === "annotations" ? active.length > 0 : reflows.length > 0;
			const shown = open !== null && hasItems;
			const label = (kind) => kind === "annotations" ? t(active.length === 1 ? "chipOne" : "chipMany", { n: active.length }) : t(reflows.length === 1 ? "reflowChipOne" : "reflowChipMany", { n: reflows.length });
			(0, react.useEffect)(() => {
				setOpen(null);
				return clearTimer;
			}, [sessionId]);
			(0, react.useEffect)(() => {
				if (!submission.pending && submission.error === t("inputUnavailable") && resolveInput(ctx, sessionId)) store.setSubmission(sessionId, { pending: false });
			}, [capabilities, sessionId]);
			(0, react.useEffect)(() => {
				if (!hasItems) setOpen(null);
			}, [hasItems]);
			(0, react.useLayoutEffect)(() => {
				if (!shown) return;
				const place = () => {
					const rect = root.current.getBoundingClientRect();
					const width = Math.min(480, rect.width, window.innerWidth - 24);
					setPosition({
						width,
						left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
						bottom: window.innerHeight - rect.top + 8,
						maxHeight: Math.min(280, window.innerHeight / 3, rect.top - 16)
					});
				};
				place();
				window.addEventListener("resize", place);
				window.addEventListener("scroll", place, true);
				return () => {
					window.removeEventListener("resize", place);
					window.removeEventListener("scroll", place, true);
				};
			}, [shown, open?.kind]);
			(0, react.useLayoutEffect)(() => {
				if (shown && open.pinned && root.current?.contains(document.activeElement)) panel.current?.focus();
			}, [
				shown,
				open?.kind,
				open?.pinned
			]);
			(0, react.useEffect)(() => {
				if (!shown) return;
				const outside = (event) => {
					if (!root.current?.contains(event.target) && !panel.current?.contains(event.target)) {
						clearTimer();
						setOpen(null);
					}
				};
				const escape = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					clearTimer();
					setOpen(null);
					root.current?.querySelector(`[data-context-kind="${open?.kind}"]`)?.focus();
				};
				document.addEventListener("pointerdown", outside);
				document.addEventListener("keydown", escape);
				return () => {
					document.removeEventListener("pointerdown", outside);
					document.removeEventListener("keydown", escape);
				};
			}, [shown, open?.kind]);
			const leave = () => {
				clearTimer();
				if (!open?.pinned) timer.current = setTimeout(() => {
					if (!panel.current?.contains(document.activeElement)) setOpen(null);
				}, 220);
			};
			const clear = (kind) => {
				clearTimer();
				if (kind === "annotations") for (const item of active) store.remove(item.id);
				else reflow.clearSession(sessionId);
				if (open?.kind === kind) setOpen(null);
			};
			const chip = (kind) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: annotations_module_css_default.chip,
				"data-open": shown && open.kind === kind || void 0,
				onPointerEnter: (event) => {
					if (event.pointerType === "touch") return;
					clearTimer();
					if (!open?.pinned) timer.current = setTimeout(() => {
						setOpen({
							kind,
							pinned: false
						});
					}, 160);
				},
				onPointerLeave: leave,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: annotations_module_css_default.chipMain,
					"data-context-kind": kind,
					"aria-haspopup": "dialog",
					"aria-expanded": shown && open.kind === kind,
					"aria-controls": id,
					onClick: () => {
						clearTimer();
						setOpen(open?.kind === kind && open.pinned ? null : {
							kind,
							pinned: true
						});
					},
					children: [kind === "annotations" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconListPenOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconShareOutline16, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label(kind) })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: annotations_module_css_default.chipDismissShade,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: annotations_module_css_default.chipDismiss,
						disabled: submission.pending,
						"aria-label": t(kind === "annotations" ? "clearAnnotations" : "clearReflows"),
						title: t(kind === "annotations" ? "clearAnnotations" : "clearReflows"),
						onClick: () => {
							clear(kind);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCloseOutline16, { size: 14 })
					})
				})]
			});
			if (!active.length && !reflows.length && !submission.error) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: root,
				className: annotations_module_css_default.chipWrap,
				"data-sidenote-context-dock": true,
				"data-sidenote-annotation-ui": true,
				children: [
					active.length > 0 && chip("annotations"),
					reflows.length > 0 && chip("reflows"),
					store.getStorageStatus(sessionId) === "memory" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: annotations_module_css_default.storageNotice,
						role: "status",
						children: t("annotationStorageMemory")
					}),
					submission.error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: annotations_module_css_default.storageNotice,
						role: "alert",
						children: submission.error
					}),
					shown && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: panel,
						id,
						role: "dialog",
						tabIndex: -1,
						"aria-label": label(open.kind),
						className: annotations_module_css_default.contextPanel,
						style: position,
						"data-sidenote-context-preview": true,
						"data-sidenote-no-quote": true,
						onPointerEnter: clearTimer,
						onPointerLeave: leave,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: annotations_module_css_default.contextList,
							children: open.kind === "annotations" ? active.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotationDetail, {
								item,
								store,
								pending: submission.pending,
								onEdit: () => {
									setOpen({
										kind: "annotations",
										pinned: true
									});
								}
							}, item.id)) : reflows.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								className: annotations_module_css_default.contextItem,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: annotations_module_css_default.contextNumber,
										children: [index + 1, "."]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: annotations_module_css_default.contextContent,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: annotations_module_css_default.contextSource,
												children: item.sideTitle
											}),
											item.question && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: annotations_module_css_default.contextLabel,
												children: t("contextrequest")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: annotations_module_css_default.contextText,
												children: item.question
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: annotations_module_css_default.contextLabel,
												children: t("contextreply")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: annotations_module_css_default.contextText,
												children: item.text
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: annotations_module_css_default.contextActions,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: annotations_module_css_default.contextAction,
											disabled: submission.pending,
											"aria-label": t("reflowRemoveTitle"),
											title: t("reflowRemoveTitle"),
											onClick: () => {
												reflow.remove(item.id);
											},
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrashOutline16, { size: 16 })
										})
									})
								]
							}, item.id))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: annotations_module_css_default.contextFooter,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: annotations_module_css_default.chipClearAll,
								disabled: submission.pending,
								onClick: () => {
									clear(open.kind);
								},
								children: t("clearAll")
							})
						})]
					}), document.body)
				]
			});
		}
		function createContextChips(ctx, store, reflow) {
			return function ContextChipsEntry(props) {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotationBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextChips, {
					ctx,
					store,
					reflow,
					sessionId: props.session.sessionId
				}, props.session.sessionId) });
			};
		}
		//#endregion
		//#region src/client/annotations/send.ts
		/** Main and side composers use this same native transaction and acceptance boundary. */
		async function submitAnnotations(options) {
			const { ctx, store, sessionId, input, annotations } = options;
			cancelInputRollback(input);
			const parts = [...options.leadingBlocks ?? []];
			if (annotations.length > 0) parts.push(buildProtocolBlock(annotations));
			const block = parts.join("\n\n");
			if (block === "") return false;
			const draftBeforeWait = input.state.getSnapshot();
			let prefix = "";
			let receipt;
			try {
				receipt = await prepareSubmission(ctx, sessionId, input, block);
				const draft = input.state.getSnapshot();
				if (draft.draft !== draftBeforeWait.draft || draft.draftRev !== draftBeforeWait.draftRev) throw new Error("等待会话就绪期间草稿已改变；正文和注释已保留，请重新发送");
				prefix = block + (draft.draft === "" ? "" : "\n\n");
				if (!prependInputText(input, prefix)) throw new Error("宿主输入尚未就绪，无法安全加入引用；内容已保留");
				receipt.submit(options.mode);
				await receipt.outcome;
				store.markSent(annotations.filter((annotation) => store.get(annotation.id) === annotation).map((annotation) => annotation.id));
				return true;
			} catch (error) {
				rollbackInputPrefix(input, prefix);
				const text = error instanceof Error ? error.message : String(error);
				store.setSubmission(sessionId, {
					pending: false,
					error: text
				});
				try {
					if (typeof input.notify === "function") input.notify("error", text);
				} catch {}
				return false;
			} finally {
				receipt?.dispose();
			}
		}
		/** Shared by native input gestures and the explicit annotation/reflow actions. */
		async function submitControlledInput(ctx, store, reflow, sessionId, mode) {
			if (store.getSubmission(sessionId).pending) return false;
			const input = resolveInput(ctx, sessionId);
			if (!input) {
				store.setSubmission(sessionId, {
					pending: false,
					error: t("inputUnavailable")
				});
				return false;
			}
			const draft = input.state.getSnapshot();
			if (draft.phase !== "plain" || draft.draft.trimStart().startsWith("/")) return false;
			const active = store.listActive(sessionId);
			const reflows = reflow.list(sessionId);
			if (draft.draft.trim() === "" && inputAttachmentIds(input).length === 0 && active.length === 0 && reflows.length === 0) return false;
			const extras = submissionExtrasOf(sessionId);
			const prefix = extras?.firstSendPrefix();
			store.setSubmission(sessionId, { pending: true });
			try {
				const { injectedIds } = await tryInjectReflows(sessionId, reflows);
				for (const id of injectedIds) reflow.remove(id);
				const hitchhikers = reflows.filter((item) => !injectedIds.has(item.id));
				if (active.length === 0 && hitchhikers.length === 0 && !prefix) {
					if (input.state.getSnapshot().draft.trim() !== "" || inputAttachmentIds(input).length > 0) input.submit(mode);
					return true;
				}
				const accepted = await submitAnnotations({
					ctx,
					store,
					sessionId,
					input,
					annotations: active,
					leadingBlocks: [...prefix ? [prefix] : [], ...hitchhikers.map(buildReflowBlock)],
					mode
				});
				if (accepted) {
					for (const item of hitchhikers) reflow.remove(item.id);
					extras?.onSubmitText(draft.draft);
					extras?.onAccepted();
				}
				return accepted;
			} catch (error) {
				store.setSubmission(sessionId, {
					pending: false,
					error: error instanceof Error ? error.message : String(error)
				});
				return false;
			} finally {
				store.setSubmission(sessionId, {
					...store.getSubmission(sessionId),
					pending: false
				});
			}
		}
		//#endregion
		//#region src/client/annotations/NativeComposer.tsx
		/** The host has already resolved Enter/click, menus, IME and busy delivery mode. */
		function submitNativeWithContext(ctx, annotations, reflow, sessionId, native, mode, source) {
			if (annotations.getSubmission(sessionId).pending) return;
			const hasContext = annotations.countActive(sessionId) > 0 || reflow.list(sessionId).length > 0;
			const input = resolveInput(ctx, sessionId);
			if (!input) {
				if (hasContext || submissionExtrasOf(sessionId)?.firstSendPrefix()) annotations.setSubmission(sessionId, {
					pending: false,
					error: t("inputUnavailable")
				});
				else native(mode, source);
				return;
			}
			const draft = input.state.getSnapshot();
			if (draft.phase !== "plain" || draft.draft.trimStart().startsWith("/")) {
				native(mode, source);
				return;
			}
			const hasMessage = draft.draft.trim() !== "" || inputAttachmentIds(input).length > 0;
			if (hasContext || hasMessage && submissionExtrasOf(sessionId)?.firstSendPrefix()) submitControlledInput(ctx, annotations, reflow, sessionId, mode);
			else native(mode, source);
		}
		function ContextComposer({ Original, props, ctx, annotations, reflow }) {
			(0, react.useSyncExternalStore)(annotations.subscribe, annotations.getSnapshot);
			(0, react.useSyncExternalStore)(reflow.subscribe, reflow.getSnapshot);
			const input = props.useInput((state) => state);
			const session = props.useSession((state) => state);
			const busyMode = props.useBusyEnter((mode) => mode);
			const sessionId = props.sessionId ?? "";
			const pending = annotations.getSubmission(sessionId).pending;
			const contextOnly = (annotations.countActive(sessionId) > 0 || reflow.list(sessionId).length > 0) && input?.draft.trim() === "" && (input.attachmentIds ?? input.imageIds ?? []).length === 0;
			const root = (0, react.useRef)(null);
			const [seat] = (0, react.useState)(() => document.createElement("span"));
			const [nativeButton, setNativeButton] = (0, react.useState)(null);
			const keyboard = (0, react.useMemo)(() => props.keyboard && new Proxy(props.keyboard, { get(target, property) {
				if (property === "submit") return (mode, source) => submitNativeWithContext(ctx, annotations, reflow, sessionId, target.submit.bind(target), mode, source);
				const value = Reflect.get(target, property, target);
				return typeof value === "function" ? value.bind(target) : value;
			} }), [
				props.keyboard,
				ctx,
				annotations,
				reflow,
				sessionId
			]);
			const useInput = (0, react.useCallback)((select) => props.useInput((state) => select(pending && state?.phase === "plain" ? {
				...state,
				phase: "submitting"
			} : state)), [props.useInput, pending]);
			(0, react.useLayoutEffect)(() => {
				if (!contextOnly || !root.current) return;
				const button = findSendButtonInCard(root.current);
				if (!button) return;
				setNativeButton(button);
				seat.style.display = "contents";
				button.parentElement.append(seat);
				if (!session?.running) button.dataset.sidenoteContextReplaced = "";
				return () => {
					delete button.dataset.sidenoteContextReplaced;
					seat.remove();
				};
			}, [
				contextOnly,
				session?.running,
				sessionId,
				props.variant,
				seat
			]);
			const offline = session?.subagent?.address.mode === "continuable" && session.subagent.parentAvailable !== true;
			const disabled = pending || input?.phase !== "plain" || props.disabled || props.blocked !== void 0 || session?.removed || offline || !keyboard || !props.inputActions;
			const mode = session?.running ? busyMode : void 0;
			const label = props.t(session?.running ? mode === "steer" ? "input.send.steer" : "input.send.queue" : "input.send");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: annotations_module_css_default.userContextHost,
				ref: root,
				children: [(0, react.createElement)(Original, {
					...props,
					keyboard,
					useInput
				}), contextOnly && nativeButton && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					"data-sidenote-submit": true,
					className: nativeButton.className,
					disabled,
					"aria-label": label,
					title: label,
					onClick: () => {
						keyboard?.submit(mode, "click");
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "20",
						height: "20",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "2",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12 19V5m-6 6 6-6 6 6" })
					})
				}), seat)]
			});
		}
		/** Keep the native editor and controls; replace only its empty submit seat
		* while plugin-owned context exists, and retain a separate native Stop. */
		function registerNativeComposer(ctx, annotations, reflow) {
			const slots = ctx.slots;
			ctx.slots.inject("conversation.composer.bar", () => {
				const patched = /* @__PURE__ */ new Map();
				const patch = () => {
					for (const entry of slots.entries("conversation.composer.bar")) {
						if (patched.has(entry)) continue;
						const Original = entry.component;
						const Wrapped = (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextComposer, {
							Original,
							props,
							ctx,
							annotations,
							reflow
						});
						entry.component = Wrapped;
						patched.set(entry, {
							original: Original,
							wrapped: Wrapped
						});
					}
				};
				patch();
				const off = slots.subscribe("conversation.composer.bar", patch);
				return () => {
					off();
					for (const [entry, value] of patched) if (entry.component === value.wrapped) entry.component = value.original;
				};
			});
		}
		//#endregion
		//#region src/client/annotations/NativeUserContext.tsx
		const CONTEXT_NODE = "dsh-sidenote-context";
		/** Injected notices and their following human input are one admitted batch.
		* Project its reflows into that bubble without changing or resending history. */
		function injectedReflowPrefix(nodes, seq) {
			const prefixes = [];
			for (let i = nodes.findIndex((node) => node.seq === seq) - 1; i >= 0; i--) {
				const node = nodes[i];
				if (node.kind !== "context") break;
				if (node.source?.kind !== "dsh-sidenote") continue;
				const text = (node.content ?? []).filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
				const start = text.indexOf("<reflow ");
				if (start < 0) continue;
				const prefix = splitProtocolPrefix(text.slice(start));
				if (prefix?.reflows.length) prefixes.unshift(text.slice(start, start + prefix.length));
			}
			return prefixes.join("\n\n");
		}
		/** One prefix node leaves the body, @ references and attachments to the host. */
		const sentContextRule = {
			id: CONTEXT_NODE,
			order: 0,
			match(text, from) {
				const snapshot = splitSnapshotPrefix(text);
				const start = snapshot ? text.length - snapshot.rest.length : 0;
				if (from > start) return void 0;
				const protocol = splitProtocolPrefix(text.slice(start));
				return protocol ? {
					id: CONTEXT_NODE,
					start,
					end: start + protocol.length,
					data: protocol
				} : void 0;
			}
		};
		function ContextChip({ label, icon, children, interactive }) {
			const [open, setOpen] = (0, react.useState)(null);
			const [position, setPosition] = (0, react.useState)({ visibility: "hidden" });
			const anchor = (0, react.useRef)(null);
			const panel = (0, react.useRef)(null);
			const timer = (0, react.useRef)(void 0);
			const clearTimer = () => {
				clearTimeout(timer.current);
				timer.current = void 0;
			};
			const leave = () => {
				clearTimer();
				if (!open?.pinned) timer.current = setTimeout(() => {
					if (!panel.current?.contains(document.activeElement)) setOpen(null);
				}, 160);
			};
			const id = (0, react.useId)();
			const expanded = open !== null;
			(0, react.useEffect)(() => clearTimer, []);
			(0, react.useLayoutEffect)(() => {
				if (!expanded) return;
				const place = () => {
					const rect = anchor.current.getBoundingClientRect();
					const view = conversationViewOf(anchor.current).getBoundingClientRect();
					const left = Math.max(12, view.left + 12), right = Math.min(window.innerWidth - 12, view.right - 12);
					const top = Math.max(12, view.top + 12), bottom = Math.min(window.innerHeight - 12, view.bottom - 12);
					if (rect.bottom < top || rect.top > bottom) {
						setOpen(null);
						return;
					}
					const width = Math.min(420, right - left);
					const above = rect.top - top - 8, below = bottom - rect.bottom - 8;
					const preferAbove = above >= Math.min(280, window.innerHeight / 3) || above >= below;
					setPosition({
						width,
						left: Math.max(left, Math.min(rect.left, right - width)),
						maxHeight: Math.min(280, window.innerHeight / 3, preferAbove ? above : below),
						...preferAbove ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [expanded]);
			(0, react.useEffect)(() => {
				if (!expanded) return;
				const outside = (event) => {
					if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) {
						clearTimer();
						setOpen(null);
					}
				};
				const escape = (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						clearTimer();
						setOpen(null);
						anchor.current?.focus();
					}
				};
				document.addEventListener("pointerdown", outside);
				document.addEventListener("keydown", escape);
				return () => {
					document.removeEventListener("pointerdown", outside);
					document.removeEventListener("keydown", escape);
				};
			}, [expanded]);
			(0, react.useLayoutEffect)(() => {
				if (open?.pinned && document.activeElement === anchor.current) panel.current?.focus();
			}, [open?.pinned]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: annotations_module_css_default.sentChipGroup,
				children: [interactive ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					ref: anchor,
					type: "button",
					className: annotations_module_css_default.sentChip,
					"aria-haspopup": "dialog",
					"aria-expanded": expanded,
					"aria-controls": id,
					onPointerEnter: (event) => {
						if (event.pointerType === "touch") return;
						clearTimer();
						if (!open && !document.querySelector("[data-sidenote-sent-preview][data-pinned]")) timer.current = setTimeout(() => {
							setOpen({ pinned: false });
						}, 180);
					},
					onPointerLeave: leave,
					onClick: () => {
						clearTimer();
						setOpen(open?.pinned ? null : { pinned: true });
					},
					children: [
						icon,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDownOutline14, {
							size: 12,
							className: expanded ? annotations_module_css_default.sentChevronOpen : annotations_module_css_default.sentChevron
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: annotations_module_css_default.sentChip,
					children: [icon, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
				}), interactive && expanded && (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: panel,
					id,
					role: "dialog",
					tabIndex: -1,
					"aria-label": label,
					className: `${annotations_module_css_default.contextPanel} ${annotations_module_css_default.sentPreview}`,
					style: position,
					"data-sidenote-sent-preview": true,
					"data-pinned": open.pinned || void 0,
					"data-sidenote-no-quote": true,
					onPointerEnter: clearTimer,
					onPointerLeave: leave,
					children
				}), document.body)]
			});
		}
		function SentContext({ protocol, interactive = true }) {
			useLocaleTick();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: annotations_module_css_default.sentChips,
				"data-dsh-sidenote-bubble": true,
				"data-sidenote-no-quote": true,
				children: [protocol.annotations.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextChip, {
					label: t("sentChipLabel", { n: protocol.annotations.length }),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconListPenOutline16, { size: 12 }),
					interactive,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: annotations_module_css_default.contextList,
						children: protocol.annotations.map((annotation) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: annotations_module_css_default.contextItem,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: annotations_module_css_default.contextNumber,
								children: [annotation.id, "."]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: annotations_module_css_default.contextContent,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: annotations_module_css_default.contextLabel,
										children: t("selectedText")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: annotations_module_css_default.contextText,
										children: annotation.quote
									}),
									annotation.note && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: annotations_module_css_default.contextLabel,
										children: t("userComment")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: annotations_module_css_default.contextText,
										children: annotation.note
									})] })
								]
							})]
						}, annotation.id))
					})
				}), protocol.reflows.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ContextChip, {
					label: t("reflowBubbleLabel"),
					icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconShareOutline16, { size: 12 }),
					interactive,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						className: annotations_module_css_default.contextList,
						children: protocol.reflows.map((reflow, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
							className: annotations_module_css_default.contextItem,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: annotations_module_css_default.contextNumber,
								children: [index + 1, "."]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: annotations_module_css_default.contextContent,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: annotations_module_css_default.contextSource,
									children: reflow.source
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: annotations_module_css_default.contextText,
									children: flattenReflowContent(reflow.content)
								})]
							})]
						}, index))
					})
				})]
			});
		}
		function LegacyContext({ Original, props, protocol }) {
			const root = (0, react.useRef)(null);
			const [seat] = (0, react.useState)(() => document.createElement("span"));
			(0, react.useLayoutEffect)(() => root.current ? mountUserBubbleAddon(root.current, seat) : void 0, [seat, props.node]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: root,
				className: annotations_module_css_default.userContextHost,
				children: [(0, react.createElement)(Original, props), (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SentContext, { protocol }), seat)]
			});
		}
		/** Keep contextual chips inside the native bubble on both main and side chat.
		* Only the progress snapshot remains outside its owning user message. */
		function registerUserContext(ctx) {
			ctx.inject(["uiConversation"], () => {
				const ui = ctx.get("uiConversation");
				const nativeText = ui.userText !== void 0;
				if (nativeText) ctx.slots.inject("conversation.user.text.node", () => {
					const offRenderer = ctx.slots.register({
						name: "conversation.user.text.node",
						key: CONTEXT_NODE
					}, (props) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SentContext, {
						protocol: props.node.data,
						interactive: props.interactive
					}));
					const offRule = ui.userText.register(sentContextRule);
					return () => {
						offRule();
						offRenderer();
					};
				});
				const slots = ctx.slots;
				ctx.slots.inject("conversation.chat.node", () => {
					const patched = /* @__PURE__ */ new Map();
					const patch = () => {
						for (const entry of slots.entries("conversation.chat.node")) {
							if (!["user", "steering"].includes(entry.options.key ?? "") || patched.has(entry)) continue;
							const Original = entry.component;
							function ContextUser(props) {
								const injected = injectedReflowPrefix(props.useChat((state) => state.legacy.nodes), props.node.data.seq);
								const blocks = props.node.data.content;
								const at = blocks.findIndex((block) => block.type === "text");
								const text = blocks[at]?.text ?? "";
								const snapshot = splitSnapshotPrefix(text);
								const afterSnapshot = (injected ? injected + "\n\n" : "") + (snapshot?.rest ?? text);
								const protocol = nativeText ? null : splitProtocolPrefix(afterSnapshot);
								if (!snapshot && !protocol && !injected) return (0, react.createElement)(Original, props);
								const displayText = (protocol ? afterSnapshot.slice(protocol.length).trimStart() : afterSnapshot) || (protocol ? "⁠" : "");
								const content = at < 0 ? [...blocks, {
									type: "text",
									text: displayText
								}] : blocks.map((block, index) => index === at ? {
									...block,
									text: displayText
								} : block);
								const projected = {
									...props,
									node: {
										...props.node,
										data: {
											...props.node.data,
											content
										}
									}
								};
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [snapshot && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
									className: annotations_module_css_default.sentContext,
									"data-sidenote-progress-snapshot": true,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: t("snapshotContext") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", { children: snapshot.snapshot })]
								}), protocol ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegacyContext, {
									Original,
									props: projected,
									protocol
								}) : (0, react.createElement)(Original, projected)] });
							}
							entry.component = ContextUser;
							patched.set(entry, {
								original: Original,
								wrapped: ContextUser
							});
						}
					};
					patch();
					const off = slots.subscribe("conversation.chat.node", patch);
					return () => {
						off();
						for (const [entry, value] of patched) if (entry.component === value.wrapped) entry.component = value.original;
					};
				});
			});
		}
		//#endregion
		//#region src/client/annotate/index.tsx
		/**
		* 划选注释（Delivery_02 重构后）：selection listener + numbered badges +
		* annotation editor + the composer「N 条注释」chip + 发送拦截器 + 气泡留痕
		* 手术。Wiring only: one annotation store（localStorage 持久化）, one
		* selection controller, one overlay React root (appended to document.body
		* and marked `data-dsh-sidenote` so the listener excludes our own DOM), and
		* one `conversation.input.dock` slot entry. 全部 additive, and every seam
		* degrades to a logged no-op instead of crashing the host page.
		*
		* 整个模块包在一个 ctx.effect 里：HMR/插件禁用时 fiber 撤销即全部清理
		* （store 退订、document 监听器移除、overlay unmount、host div 移除）——
		* 否则重挂后双重挂载（两层工具条、双份监听、新旧 store 分裂）。slot 注册
		* 的 disposer 由 cordis 服务代理路由进调用方 fiber，无需手动回收。
		*/
		function registerAnnotations(ctx, reflow, store) {
			ctx.effect(() => {
				try {
					const controller = createSelectionController(() => currentSessionIdOf(ctx));
					const host = document.createElement("div");
					host.dataset.dshSidenote = "";
					document.body.appendChild(host);
					const root = (0, react_dom_client.createRoot)(host);
					root.render(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AnnotateOverlay, {
						ctx,
						store,
						controller
					}));
					registerNativeComposer(ctx, store, reflow);
					registerUserContext(ctx);
					ctx.slots.inject("conversation.input.dock", () => {
						const offContext = ctx.slots.register({
							name: "conversation.input.dock",
							id: "dsh-sidenote-annotations",
							order: 10,
							registrant: "dsh-sidenote"
						}, createContextChips(ctx, store, reflow));
						hostDiagnostics(ctx).dockRegistered();
						return () => {
							offContext();
						};
					});
					return () => {
						controller.dispose();
						setTimeout(() => {
							root.unmount();
						});
						host.remove();
					};
				} catch (error) {
					console.error("[dsh-sidenote] annotate setup failed:", error);
					return () => {};
				}
			}, "dsh-sidenote: annotations");
		}
		//#endregion
		//#region src/client/host/sessionList.tsx
		const SLOT = "sidebar.workspaces";
		/**
		* Runtime seam: the host exposes mutable slot entries, but no per-session hide API.
		* Preserve the native entry's store, injection, children and locale. Unknown shapes
		* retain the original list; disposal restores only components we still own.
		*/
		function registerSessionListFilter(ctx, visibility) {
			const slots = ctx.slots;
			if (typeof slots.entries !== "function" || typeof slots.subscribe !== "function") return;
			const entries = slots.entries.bind(slots);
			const subscribe = slots.subscribe.bind(slots);
			slots.inject(SLOT, () => {
				const originals = /* @__PURE__ */ new Map();
				function patch() {
					for (const entry of entries(SLOT)) {
						if (originals.has(entry) || typeof entry.component !== "function") continue;
						if (!entry.children?.["sidebar.workspaces.directoryFlow"]) continue;
						const Original = entry.component;
						function Projection({ props, useSessions }) {
							const all = useSessions((value) => value);
							const snapshot = (0, react.useSyncExternalStore)(visibility.subscribe, visibility.getSnapshot);
							const visible = (0, react.useMemo)(() => visibleSessionList(all, snapshot), [all, snapshot]);
							const projected = (0, react.useCallback)((selector) => selector(visible), [visible]);
							return (0, react.createElement)(Original, {
								...props,
								useSessions: projected
							});
						}
						function FilteredWorkspace(props) {
							return typeof props.useSessions === "function" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Projection, {
								props,
								useSessions: props.useSessions
							}) : (0, react.createElement)(Original, props);
						}
						try {
							entry.component = FilteredWorkspace;
							originals.set(entry, {
								original: Original,
								wrapped: FilteredWorkspace
							});
						} catch {}
					}
				}
				patch();
				const off = subscribe(SLOT, patch);
				const wake = slots.register({
					name: SLOT,
					priority: 1e4,
					id: "dsh-sidenote-list-filter-wake"
				}, () => null);
				return () => {
					off();
					for (const [entry, { original, wrapped }] of originals) if (entry.component === wrapped) entry.component = original;
					wake();
				};
			});
		}
		//#endregion
		//#region src/client/sidechat/visibility.tsx
		function VisibilitySetting({ visibility }) {
			useLocaleTick();
			const { show, saved } = (0, react.useSyncExternalStore)(visibility.subscribe, visibility.getSnapshot);
			const description = (0, react.useId)();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: sidechat_module_css_default.visibilitySetting,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t("showSideSessions") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						id: description,
						children: t("showSideSessionsDescription")
					}),
					!saved && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: t("sideSessionsUnsaved")
					})
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					role: "switch",
					"aria-label": t("showSideSessions"),
					"aria-describedby": description,
					checked: show,
					onChange: (event) => visibility.setShow(event.currentTarget.checked)
				})]
			});
		}
		/** Run before orphan-meta cleanup so previous live/closed children can migrate. */
		function registerSideSessionVisibility(ctx) {
			const visibility = sessionVisibilityOf(ctx);
			const ids = [...sideChatMetasAll(), ...allClosedSideChats()].flatMap((record) => record.childId ? [record.childId] : []);
			visibility.hide(...ids);
			ctx.effect(() => visibility.watch(), "dsh-sidenote: side session visibility");
			registerSessionListFilter(ctx, visibility);
			if (typeof ctx.workspaces.unarchiveSession !== "function") return;
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "dsh-sidenote-side-sessions-setting",
				order: 119,
				registrant: "dsh-sidenote"
			}, () => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(VisibilitySetting, { visibility })));
		}
		//#endregion
		//#region src/client/index.tsx
		const inject = [
			"sessions",
			"workspaces",
			"slots",
			"connection",
			"locale"
		];
		function apply(ctx) {
			ctx.effect(() => {
				setRootContext(ctx);
				return () => {
					clearNativeRuntime();
				};
			}, "dsh-sidenote: native bridge");
			attachLocale(ctx.locale);
			registerCompatibilityStatus(ctx);
			registerSideSessionVisibility(ctx);
			sweepOrphanedSideChatMeta();
			const reflow = createReflowStore();
			const annotations = createAnnotationStore();
			registerSideChat(ctx, reflow, annotations);
			registerAnnotations(ctx, reflow, annotations);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map