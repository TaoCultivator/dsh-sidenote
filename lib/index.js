//#region node_modules/.pnpm/@deepseek-ai+dsh-util-crypt_830fd80fa8b629b60ae174002b3c0162/node_modules/@deepseek-ai/dsh-util-crypto/lib/index.js
/**
* Random v4 UUID, minted from `crypto.getRandomValues`.
* @returns the UUID string.
*/
function randomUUID() {
	const bytes = globalThis.crypto.getRandomValues(/* @__PURE__ */ new Uint8Array(16));
	const hex = Array.from(bytes, (byte, index) => {
		return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
	}).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-brand@0.1.5-rc.2_@deepseek-ai+cordis@4.0.2/node_modules/@deepseek-ai/dsh-brand/lib/index.js
/**
* Duplicate-install-safe nominal primitive helpers.
*
* A brand makes structurally identical strings or numbers non-interchangeable
* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
* expected, and an event sequence cannot be passed as a log offset. Comparison,
* logging, and serialization retain the underlying primitive behavior.
*
* This package owns no concrete domain value and keeps no runtime identity or mutable
* state, so independently installed copies produce interchangeable values.
*
* @module @deepseek-ai/dsh-brand
*/
/**
* Apply a compile-time string brand without changing the value.
* @param value - string admitted by the domain that owns the target brand.
* @returns the same string with the requested compile-time brand.
*/
function brandString(value) {
	return value;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-util-value_aed02913c628bcf928b988ccfcf546eb/node_modules/@deepseek-ai/dsh-util-values/lib/index.js
/**
* Deep-freeze an object graph in place while leaving live AbortSignal objects mutable.
* @param value - value to freeze.
* @returns the same value after every reachable enumerable child is frozen.
*/
function deepFreeze(value) {
	const seen = /* @__PURE__ */ new WeakSet();
	const pending = [{
		kind: "visit",
		node: value
	}];
	while (pending.length > 0) {
		const task = pending.pop();
		/* v8 ignore next -- the loop condition guarantees one pending task. */
		if (task === void 0) continue;
		if (task.kind === "property") {
			pending.push({
				kind: "visit",
				node: task.source[task.key]
			});
			continue;
		}
		const node = task.node;
		if (node === null || typeof node !== "object") continue;
		if (node instanceof AbortSignal) continue;
		if (seen.has(node)) continue;
		seen.add(node);
		Object.freeze(node);
		const keys = Object.keys(node);
		for (let index = keys.length - 1; index >= 0; index--) {
			const key = keys[index];
			/* v8 ignore next -- the loop is bounded by the captured key count. */
			if (key === void 0) continue;
			pending.push({
				kind: "property",
				source: node,
				key
			});
		}
	}
	return value;
}
//#endregion
//#region node_modules/.pnpm/@deepseek-ai+dsh-llm@0.1.5-rc.2_@deepseek-ai+cordis@4.0.2/node_modules/@deepseek-ai/dsh-llm/lib/types/message.js
/** Message value types, identity, and immutable construction helpers. */
/**
* Detach and deep-freeze a message whose identity already exists.
* @param message - complete message, including its stable identity.
* @returns an immutable snapshot that preserves the identity.
*/
function freezeMessage(message) {
	return deepFreeze(structuredClone(message));
}
/**
* Create one identified message and freeze it before publication.
* @param input - complete role, content, and source for a new message.
* @returns an immutable message with a fresh stable identity.
*/
function createMessage(input) {
	return freezeMessage({
		...input,
		id: brandString(randomUUID())
	});
}
/**
* Create one identified user-role message and freeze it before publication.
* @param input - complete content and source for a new user message.
* @returns an immutable user message with a fresh stable identity.
*/
function createUserMessage(input) {
	return createMessage({
		...input,
		role: "user"
	});
}
//#endregion
//#region src/trust-fence.ts
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
/** Whether a normalized URL hostname names the local loopback authority. */
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
/** Canonical authority form: hostname, or hostname:port when a port was written. */
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
/** Whether the request authority matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* Decide whether one sidebar request may reach the plugin routes.
* @param request - node HTTP request facts (headers).
* @param trustedHosts - non-loopback authorities this deployment serves.
* @returns true when the Host is ours (loopback or trusted) and browser markers are same-origin.
*/
function isTrustedApiRequest(request, trustedHosts) {
	const host = header(request.headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(request.headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).hostname === hostUrl.hostname;
	} catch {
		return false;
	}
}
//#endregion
//#region src/index.ts
/** Plugin identity for cordis.yml rows. */
const name = "dsh-sidenote";
const MAX_BODY_BYTES = 65536;
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new Error("request body too large");
		chunks.push(buffer);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	return JSON.parse(new TextDecoder().decode(bytes));
}
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
/** reflow 注入处理：父会话 agent 在 → inject；不在 → ok:false（客户端回落搭车）。
*  导出供单测（宿主 handler 的 fence/校验/降级路径）。 */
function makeReflowHandler(ctx) {
	return async (req, res) => {
		if (req.method !== "POST") {
			writeJson(res, 405, {
				ok: false,
				error: "method-not-allowed"
			});
			return;
		}
		if (!isTrustedApiRequest(req, ctx.get("webRuntime")?.trustedHosts ?? [])) {
			writeJson(res, 403, {
				ok: false,
				error: "forbidden"
			});
			return;
		}
		let body;
		try {
			body = await readJsonBody(req);
		} catch {
			writeJson(res, 400, {
				ok: false,
				error: "bad-request"
			});
			return;
		}
		const valid = (Array.isArray(body.items) ? body.items : []).map((item, index) => ({
			item,
			index
		})).filter(({ item }) => typeof item.text === "string" && item.text !== "");
		if (typeof body.parentSessionId !== "string" || body.parentSessionId === "" || valid.length === 0) {
			writeJson(res, 400, {
				ok: false,
				error: "bad-request: parentSessionId/items required"
			});
			return;
		}
		const agent = ctx.get("agents")?.get(body.parentSessionId);
		if (agent === void 0 || typeof agent.inject !== "function") {
			writeJson(res, 200, {
				ok: false,
				error: "no-live-agent"
			});
			return;
		}
		const injectedIndexes = [];
		for (const { item, index } of valid) {
			const sideTitle = typeof item.sideTitle === "string" ? item.sideTitle : "";
			const summary = (sideTitle === "" ? "侧边聊天的结论回流" : `来自「${sideTitle}」的结论回流`).slice(0, 120);
			try {
				agent.inject(createUserMessage({
					content: [{
						type: "text",
						text: item.text
					}],
					source: {
						kind: "dsh-sidenote",
						form: "notice",
						summary
					}
				}));
				injectedIndexes.push(index);
			} catch (error) {
				console.warn("[dsh-sidenote] reflow 注入单条失败:", error);
			}
		}
		writeJson(res, 200, {
			ok: injectedIndexes.length === valid.length,
			injectedIndexes
		});
	};
}
function apply(ctx) {
	const host = ctx;
	const injectDyn = host.inject;
	if (typeof injectDyn !== "function") {
		console.warn("[dsh-sidenote] 宿主半包：ctx.inject 面缺席，reflow 路由未注册（客户端回落搭车）");
		return;
	}
	injectDyn.call(ctx, ["webServer"], (injected) => {
		const webServer = injected.get("webServer");
		if (webServer === void 0 || typeof webServer.register !== "function") return;
		console.log("[dsh-sidenote] 宿主半包已装载，注册 /sidenote/reflow");
		return webServer.register({
			kind: "exact",
			path: "/sidenote/reflow",
			handler: makeReflowHandler(host)
		});
	});
}
//#endregion
export { apply, makeReflowHandler, name };
