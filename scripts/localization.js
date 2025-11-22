/* 
Localization — dynamic LT
- Works with any key path found in en.json
*/
import { debugLog } from "./main.js";

/*
	L: localize a key (no placeholders)
*/
export function L(key) {
	try {
		// If translations not loaded yet, just return the key without warning
		if (!game?.i18n?.translations || Object.keys(game.i18n.translations).length === 0) {
			return key;
		}
		const s = game.i18n.localize(key);
		if (s === key) debugLog(2, "L(): missing key", { key });
		return s;
	} catch (err) {
		debugLog(3, "L(): error", err);
		return key;
	}
}

/*
	LF: format a key with {placeholders}
*/
export function LF(key, data = {}) {
	// Debug
	//debugLog("LF(): start");
	try {
		const out = game.i18n.format(key, data);
		if (out === key) debugLog(2, "LF(): missing key", { key, data });
		return out;
	} catch (err) {
		debugLog(3, "LF(): error", err);
		return key;
	}
}

/*
	Dynamic LT:
	- Any property chain becomes a key path under MUDULE_ID
	- Call with no args => L()
	- Call with an object => LF()
*/
function makeNode(key) {
	// Callable function: LT.something(...) -> localize/format
	const fn = (data) => {
		return data && typeof data === "object" ? LF(key, data) : L(key);
	};

	return new Proxy(fn, {
		get(_target, prop) {
			// Avoid prototype noise
			if (prop === "prototype" || prop === "name" || prop === "length") return undefined;
			// Allow peeking at full key if ever needed
			if (prop === "_key") return key;
			// Build nested path
			const nextKey = key ? key + "." + String(prop) : String(prop);
			return makeNode(nextKey);
		}
	});
}

// Start all lookups from the root MODULE_ID
export const LT = makeNode("pf2e-lock-pick");