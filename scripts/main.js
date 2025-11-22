import { LT } from "./localization.js";

export const MODULE_ID = "pf2e-lock-pick";


const { ApplicationV2, DialogV2 } = foundry.applications.api;

Hooks.once("init", () => {
	game.settings.register(MODULE_ID, "debugLevel", {
		name: "Debug Level",
		hint: "Set the debug level for console logging from the PF2e Lock-Pick module.",
		scope: "world",
		config: false,
		type: String,
		choices: {
			"none": "None",
			"error": "Error",
			"warn": "Warn",
			"all": "All"
		},
		default: "none"
	});
});

/*
function debugLog(...args) {
	try {
		console.log(`${MODULE_ID} |`, ...args);
	} catch (e) {
		// noop
	}
}
*/
export function debugLog(intLogType, stringLogMsg, objObject = null) {
	
	// Get Timestamps
	const now = new Date();
	const timestamp = now.toTimeString().split(' ')[0]; // "HH:MM:SS"
	
	// Handle the case where the first argument is a string
	if (typeof intLogType === "string") {
		objObject = stringLogMsg; // Shift arguments
		stringLogMsg = intLogType;
		intLogType = 1; // Default log type to 'all'
	}
	let debugLevel = "all"; // default until setting exists
	try {
		// Only read after it’s registered
		if (game?.settings?.settings?.has?.(`${MODULE_ID}.debugLevel`)) {
			debugLevel = game.settings.get(MODULE_ID, "debugLevel");
		}
	} catch (e) {
		// Swallow: setting not registered yet
	}

	// Map debugLevel setting to numeric value for comparison
	const levelMap = {
		"none": 4,
		"error": 3,
		"warn": 2,
		"all": 1
	};

	const currentLevel = levelMap[debugLevel] || 4; // Default to 'none' if debugLevel is undefined

	// Check if the log type should be logged based on the current debug level
	if (intLogType < currentLevel) return;

	// Capture stack trace to get file and line number
	const stack = new Error().stack.split("\n");
	let fileInfo = "";
	for (let i = 2; i < stack.length; i++) {
		const line = stack[i].trim();
		const fileInfoMatch = line.match(/(\/[^)]+):(\d+):(\d+)/); // Match file path and line number
		if (fileInfoMatch) {
			const [, filePath, lineNumber] = fileInfoMatch;
			const fileName = filePath.split("/").pop(); // Extract just the file name
		}
	}

	// Prepend the file and line info to the log message
	const formattedLogMsg = `${stringLogMsg}`;
	
	if (objObject) {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%Lock-Pick+ [${timestamp}] | ${formattedLogMsg}`, "color: purple; font-weight: bold;", objObject);
				break;
			case 2: // Warning
				console.log(`%Lock-Pick+ [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;", objObject);
				break;
			case 3: // Critical/Error
				console.log(`%Lock-Pick+ [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;", objObject);
				break;
			default:
				console.log(`%Lock-Pick+ [${timestamp}] | ${formattedLogMsg}`, "color: purple; font-weight: bold;", objObject);
		}
	} else {
		switch (intLogType) {
			case 1: // Info/Log (all)
				console.log(`%Lock-Pick+ [${timestamp}] | ${formattedLogMsg}`, "color: purple; font-weight: bold;");
				break;
			case 2: // Warning
				console.log(`%Lock-Pick+ [${timestamp}] | WARNING: ${formattedLogMsg}`, "color: orange; font-weight: bold;");
				break;
			case 3: // Critical/Error
				console.log(`%Lock-Pick+ [${timestamp}] | ERROR: ${formattedLogMsg}`, "color: red; font-weight: bold;");
				break;
			default:
				console.log(`%Lock-Pick+ [${timestamp}] | ${formattedLogMsg}`, "color: purple; font-weight: bold;");
		}
	}
}

class LockPickChallengeManager {
	static challenges = new Map();

	static createChallenge({ actor, dc, requiredAttempts, gmId, playerId }) {
		const id = randomID();
		const challenge = {
            id,
            actorUuid: actor.uuid,
            dc,
            requiredAttempts,
            successCount: 0,
            gmId,
            playerId,
            toolSelection: null
        };
		this.challenges.set(id, challenge);
		return challenge;
	}

	static getChallenge(id) {
		return this.challenges.get(id) ?? null;
	}

	static endChallenge(id) {
		this.challenges.delete(id);
	}
}

class LockPickChallengeApp extends ApplicationV2 {
	static DEFAULT_OPTIONS = {
		...ApplicationV2.DEFAULT_OPTIONS,
		id: `${MODULE_ID}-challenge`,
		title: LT.titleLPC(),
		position: {
			width: 600,
			height: "auto"
		},
		window: {
			frame: true,
			titleBar: true,
			controls: [
				{
					icon: "fa-solid fa-eye",
					label: LT.showToPlayer(),
					action: "showToPlayer"
				}
			]
		},
		actions: {
			pickLock: LockPickChallengeApp.pickLock,
			gmIncSuccess: LockPickChallengeApp.gmIncSuccess,
			gmDecSuccess: LockPickChallengeApp.gmDecSuccess,
			gmRestorePickToolkit: LockPickChallengeApp.gmRestorePickToolkit,
			showToPlayer: LockPickChallengeApp.showToPlayer
		}
	};

    static instances = new Map();

	static registerInstance(app) {
		const id = app.challengeId;
		if (!id) return;
		let set = this.instances.get(id);
		if (!set) {
			set = new Set();
			this.instances.set(id, set);
		}
		set.add(app);
	}

	static unregisterInstance(app) {
		const id = app.challengeId;
		if (!id) return;
		const set = this.instances.get(id);
		if (!set) return;
		set.delete(app);
		if (!set.size) this.instances.delete(id);
	}

	static updateFromChallengeData(challenge) {
		if (!challenge || !challenge.id) return;

		LockPickChallengeManager.challenges.set(challenge.id, challenge);

		const set = this.instances.get(challenge.id);
		if (!set) return;

		for (const app of set) {
			app.challenge = challenge;
			app.render(true);
		}
	}

	constructor(challenge, options = {}) {
		super(options);
		this.challengeId = challenge.id;
		this.challenge = challenge;
		this.isGMView = options.isGMView ?? game.user.isGM;
		LockPickChallengeApp.registerInstance(this);
	}

	get title() {
		return LT.titleLPC();
	}

	static async openForUsers(challenge) {
		// GM local view
		const gmApp = new LockPickChallengeApp(challenge, { isGMView: true });
		gmApp.render(true);

		// Broadcast full challenge to other clients; they decide if they should show it
		game.socket.emit(`module.${MODULE_ID}`, {
			type: "openChallenge",
			payload: {
				challenge
			}
		});
	}

	async _updateChallengeRef() {
		const updated = LockPickChallengeManager.getChallenge(this.challengeId);
		if (updated) this.challenge = updated;
	}

    async getData(options) {
        await this._updateChallengeRef();

        const challenge = this.challenge;
        const actor = await fromUuid(challenge.actorUuid);
        if (!actor) {
            debugLog("Actor not found for challenge", challenge);
            return {
                actorName: `<${LT.missingActor()}>`,
                isGMView: this.isGMView,
                successCount: challenge.successCount,
                requiredAttempts: challenge.requiredAttempts,
                dc: challenge.dc,
                remainingPicks: 0,
                isUnlocked: challenge.successCount >= challenge.requiredAttempts,
                canAttempt: false,
                toolOptions: []
            };
        }

        const toolsData = getThievesToolsData(actor);
        const isUnlocked = challenge.successCount >= challenge.requiredAttempts;

        // If no toolkit selected yet, auto-select the first available non-broken toolkit
        if (!challenge.toolSelection && toolsData.toolsNonBroken.length > 0) {
            challenge.toolSelection = toolsData.toolsNonBroken[0].id;
            LockPickChallengeManager.challenges.set(challenge.id, challenge);
        }

        const canAttempt = toolsData.totalPicks > 0 && !isUnlocked;

        const toolOptions = toolsData.toolsNonBroken.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.system.quantity ?? 1,
            selected: challenge.toolSelection === item.id
        }));

        return {
            actorName: actor.name,
            isGMView: this.isGMView,
            successCount: challenge.successCount,
            requiredAttempts: challenge.requiredAttempts,
            dc: challenge.dc,
            remainingPicks: toolsData.totalPicks,
            isUnlocked,
            canAttempt,
            toolOptions
        };
    }

	render(force, options) {
		return super.render(force, options);
	}

	async _renderHTML(context, options) {
		const data = await this.getData(options);

		const progressFraction = Math.min(
			1,
			data.requiredAttempts > 0 ? data.successCount / data.requiredAttempts : 0
		);
		const lockImageSrc = getProgressImagePath(progressFraction);

		const toolOptionsHtml = data.toolOptions.map(opt => {
			const label = `${opt.name} (x${opt.quantity})`;
			const selectedAttr = opt.selected ? " selected" : "";
			return `<option value="${opt.id}"${selectedAttr}>${foundry.utils.escapeHTML(label)}</option>`;
		}).join("");

		const dcRow = data.isGMView
			? `<div class="lp-row">
					<label>${LT.DC()}:</label>
					<span data-lock-dc>${data.dc}</span>
				</div>`
			: "";

		const requiredRow = data.isGMView
			? `<div class="lp-row">
					<label>${LT.reqSuccesses()}:</label>
					<span data-required-attempts>${data.requiredAttempts}</span>
				</div>`
			: "";

		const successesLabel = data.isGMView
			? `<span data-success-count>${data.successCount}</span> / <span data-required-attempts>${data.requiredAttempts}</span>`
			: `<span data-success-count>${data.successCount}</span>`;
		
		const gmControlsRow = data.isGMView
			? `<div class="lp-row lp-gm-controls">
					<label>GM Adjust:</label>
					<div class="lp-gm-buttons">
						<button type="button" data-action="gmDecSuccess" class="lp-gm-btn">-</button>
						<button type="button" data-action="gmIncSuccess" class="lp-gm-btn">+</button>
						<button type="button" data-action="gmRestorePickToolkit" class="lp-gm-btn">${LT.restorePickToolkit()}</button>
					</div>
				</div>`
			: "";

		const buttonLabel = data.isUnlocked ? LT.close() : LT.pickLock();
        const canClickButton = data.isUnlocked || data.canAttempt;
        const buttonDisabled = canClickButton ? "" : "disabled";

		// Build the root element for this application content
		const root = document.createElement("div");
		root.classList.add("lp-challenge", "flexrow");
        // Force top alignment for image + text column
        root.style.alignItems = "flex-start";
		root.innerHTML = `
			<div class="lp-lock-image">
				<img src="${lockImageSrc}" data-lock-image />
			</div>
			<div class="lp-controls flexcol" style="margin-left: 1rem; align-items: flex-start;">
				<div class="lp-row">
					<label>${LT.character()}:</label>
					<span data-actor-name>${foundry.utils.escapeHTML(data.actorName)}</span>
				</div>
				${dcRow}
				${requiredRow}
				<div class="lp-row">
					<label>${LT.successes()}:</label>
					${successesLabel}
				</div>
				${gmControlsRow}
				<div class="lp-row">
					<label>${LT.remainingPicks()}:</label>
					<span data-remaining-picks>${data.remainingPicks}</span>
				</div>
				<div class="lp-row">
					<label>${LT.toolkit()}:</label>
					<select name="toolSelection" data-tool-select>
						${toolOptionsHtml}
					</select>
				</div>
				<div class="lp-row lp-button-row">
					<button type="button" data-action="pickLock" class="lp-pick-button" style="padding: 0.5rem 1.5rem; font-size: 1.1rem;" ${buttonDisabled}>${buttonLabel}</button>
				</div>
			</div>
		`;

		return root;
	}

    _replaceHTML(result, content, options) {
		// Clear existing content
		content.innerHTML = "";

		if (result instanceof HTMLElement) {
			content.appendChild(result);
		} else if (typeof result === "string") {
			// Fallback if we ever accidentally return a string
			content.innerHTML = result;
		}
	}

    // Pick Lock button handler
	static async pickLock(event, target) {
		event?.preventDefault?.();

		if (!this || !(this instanceof LockPickChallengeApp)) return;

		await this._onClickPickLock();
	}

	// Header control: GM can re-show the challenge to the player
	static async showToPlayer(event, target) {
		event?.preventDefault?.();

		if (!this || !(this instanceof LockPickChallengeApp)) return;

		if (!game.user.isGM) {
			debugLog("LockPickChallengeApp::showToPlayer – non-GM attempted Show to player");
			return;
		}

		await this._updateChallengeRef();
		const challenge = this.challenge;
		if (!challenge) {
			debugLog("LockPickChallengeApp::showToPlayer – no challenge found to broadcast");
			return;
		}

		debugLog("LockPickChallengeApp::showToPlayer – broadcasting openChallenge to player", { challengeId: challenge.id });

		game.socket.emit(`module.${MODULE_ID}`, {
			type: "openChallenge",
			payload: {
				challenge
			}
		});
	}

	// GM: increase success count by 1 (up to requiredAttempts)
	static async gmIncSuccess(event, target) {
		event?.preventDefault?.();

		if (!this || !(this instanceof LockPickChallengeApp)) return;
		if (!game.user.isGM) {
			debugLog("gmIncSuccess called by non-GM user, ignoring");
			return;
		}

		await this._updateChallengeRef();
		const challenge = this.challenge;
		if (!challenge) {
			debugLog("gmIncSuccess – no challenge found");
			return;
		}

		const current = challenge.successCount ?? 0;
		const max = challenge.requiredAttempts ?? current;
		challenge.successCount = Math.min(max, current + 1);

		LockPickChallengeManager.challenges.set(challenge.id, challenge);

		try {
			game.socket.emit(`module.${MODULE_ID}`, {
				type: "updateChallenge",
				payload: { challenge }
			});
		} catch (err) {
			debugLog("gmIncSuccess – failed to emit updateChallenge", err);
		}

		this.render(true);
	}

	// GM: decrease success count by 1 (down to 0)
	static async gmDecSuccess(event, target) {
		event?.preventDefault?.();

		if (!this || !(this instanceof LockPickChallengeApp)) return;
		if (!game.user.isGM) {
			debugLog("gmDecSuccess called by non-GM user, ignoring");
			return;
		}

		await this._updateChallengeRef();
		const challenge = this.challenge;
		if (!challenge) {
			debugLog("gmDecSuccess – no challenge found");
			return;
		}

		const current = challenge.successCount ?? 0;
		challenge.successCount = Math.max(0, current - 1);

		LockPickChallengeManager.challenges.set(challenge.id, challenge);

		try {
			game.socket.emit(`module.${MODULE_ID}`, {
				type: "updateChallenge",
				payload: { challenge }
			});
		} catch (err) {
			debugLog("gmDecSuccess – failed to emit updateChallenge", err);
		}

		this.render(true);
	}

	// GM: restore a pick or toolkit after a crit fail (best-effort undo)
	static async gmRestorePickToolkit(event, target) {
		event?.preventDefault?.();

		if (!this || !(this instanceof LockPickChallengeApp)) return;
		if (!game.user.isGM) {
			debugLog("gmRestorePickToolkit called by non-GM user, ignoring");
			return;
		}

		await this._updateChallengeRef();
		const challenge = this.challenge;
		if (!challenge) {
			debugLog("gmRestorePickToolkit – no challenge found");
			return;
		}

		const actor = await fromUuid(challenge.actorUuid);
		if (!actor) {
			debugLog("gmRestorePickToolkit – actor not found for challenge", { challenge });
			return;
		}

		await restorePickOrToolkit(actor);

		// Challenge itself doesn't change, but we still broadcast so other clients re-render
		LockPickChallengeManager.challenges.set(challenge.id, challenge);

		try {
			game.socket.emit(`module.${MODULE_ID}`, {
				type: "updateChallenge",
				payload: { challenge }
			});
		} catch (err) {
			debugLog("gmRestorePickToolkit – failed to emit updateChallenge", err);
		}

		this.render(true);
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);

		// For ApplicationV2, rely on this.element as the root
		const root = this.element;
		if (!root) {
			debugLog("LockPickChallengeApp::activateListeners – no root element");
			return;
		}

		const btn = root.querySelector('[data-action="pick-lock"]');
		const select = root.querySelector('[data-tool-select]');

		debugLog("LockPickChallengeApp::activateListeners", {
			hasBtn: !!btn,
			hasSelect: !!select
		});

		if (select) {
			select.addEventListener("change", ev => {
				const value = ev.currentTarget.value || null;
				this.challenge.toolSelection = value;
				const stored = LockPickChallengeManager.getChallenge(this.challengeId);
				if (stored) stored.toolSelection = value;
			});
		}

		if (btn) {
			btn.addEventListener("click", async ev => {
				ev.preventDefault();
				debugLog("LockPickChallengeApp::activateListeners – Pick Lock button clicked");
				await this._onClickPickLock();
			});
		}
	}

    async _onClickPickLock() {
        debugLog("LockPickChallengeApp::_onClickPickLock – click received", {
            challengeId: this.challengeId
        });

        const root = this.element;
        if (!root) {
            debugLog("LockPickChallengeApp::_onClickPickLock – no root element");
            return;
        }

        await this._updateChallengeRef();
        const challenge = this.challenge;

        if (!challenge) {
            debugLog("LockPickChallengeApp::_onClickPickLock – no challenge found");
            return;
        }

        const actor = await fromUuid(challenge.actorUuid);
        if (!actor) {
            debugLog("LockPickChallengeApp::_onClickPickLock – actor missing for challenge", { challenge });
            return;
        }

        const isUnlocked = challenge.successCount >= challenge.requiredAttempts;
        if (isUnlocked) {
            debugLog("LockPickChallengeApp::_onClickPickLock – challenge already unlocked, closing");
			// End this lock-pick session now that the lock has been picked
			LockPickChallengeManager.endChallenge(challenge.id);
            this.close();
            return;
        }

        const toolsData = getThievesToolsData(actor);
        debugLog("LockPickChallengeApp::_onClickPickLock – tools data", {
            totalPicks: toolsData.totalPicks,
            toolsNonBroken: toolsData.toolsNonBroken.map(t => ({
                id: t.id,
                name: t.name,
                qty: t.system?.quantity
            }))
        });

        if (toolsData.totalPicks <= 0) {
            debugLog("LockPickChallengeApp::_onClickPickLock – no picks available, cannot attempt");
            return;
        }

        const select = root.querySelector('[data-tool-select]');
        const selectedToolkitId = select?.value || null;
        debugLog("LockPickChallengeApp::_onClickPickLock – selected toolkit", {
            selectedToolkitId,
            rawValue: select?.value
        });

        if (!selectedToolkitId) {
            debugLog("LockPickChallengeApp::_onClickPickLock – no toolkit selected, aborting roll");
            return;
        }

        let rollResult;
        try {
            rollResult = await rollThieveryCheck(actor, challenge.dc);
            debugLog("LockPickChallengeApp::_onClickPickLock – thievery roll result", rollResult);

            // If rollThieveryCheck failed silently or was cancelled, don't continue
            if (!rollResult) {
                debugLog("LockPickChallengeApp::_onClickPickLock – rollThieveryCheck returned no result, aborting");
                return;
            }
        } catch (err) {
            debugLog("LockPickChallengeApp::_onClickPickLock – error during rollThieveryCheck", err);
            return;
        }

        try {
            applyLockPickResult(challenge, rollResult.degree);
            debugLog("LockPickChallengeApp::_onClickPickLock – after applyLockPickResult", {
                successCount: challenge.successCount,
                requiredAttempts: challenge.requiredAttempts
            });

            const unlockedNow = challenge.successCount >= challenge.requiredAttempts;

            if (rollResult.degree === "criticalFailure") {
                debugLog("LockPickChallengeApp::_onClickPickLock – critical failure, handling pick break");
                await handleCriticalFailure(actor, selectedToolkitId);
            }

            // Persist change locally
            LockPickChallengeManager.challenges.set(challenge.id, challenge);

            // Broadcast updated challenge so other clients (GM/player) sync their UIs
            try {
                game.socket.emit(`module.${MODULE_ID}`, {
                    type: "updateChallenge",
                    payload: {
                        challenge
                    }
                });
            } catch (err) {
                debugLog("LockPickChallengeApp::_onClickPickLock – failed to emit updateChallenge", err);
            }

            // Per-attempt result message
            postLockPickChatMessage(actor, rollResult);

            // Final success message when the lock is actually picked
            if (unlockedNow) {
                postLockPickedChatMessage(actor);
            }
        } catch (err) {
            debugLog("LockPickChallengeApp::_onClickPickLock – error after roll (apply/chat/update)", err);
            return;
        }

        // Re-render this client’s UI (lock image, success count, etc.)
        this.render(true);
    }

    async close(options) {
		LockPickChallengeApp.unregisterInstance(this);
		return super.close(options);
	}
}

// Helper: generate a random alphanumeric ID of length 16
function randomID() {
	return randomIDBase(16);
}

// Helper: generate a random alphanumeric ID of given length
function randomIDBase(length) {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let out = "";
	for (let i = 0; i < length; i++) {
		out += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return out;
}

// Helper: post lock-picked chat message
function postLockPickedChatMessage(actor) {
	const escapedName = foundry.utils.escapeHTML(actor.name);
	const content = `
		<p><strong>${escapedName}</strong> ${LT.successLockPick()}.</p>
	`;

	ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content,
		whisper: [] 
	});
}

// Helper: get the lock image path based on progress fraction (0.0 to 1.0)
function getProgressImagePath(progressFraction) {
	const pct = Math.floor(progressFraction * 100);
	if (pct >= 100) return `modules/${MODULE_ID}/assets/lock100.webp`;
	if (pct >= 80) return `modules/${MODULE_ID}/assets/lock80.webp`;
	if (pct >= 60) return `modules/${MODULE_ID}/assets/lock60.webp`;
	if (pct >= 40) return `modules/${MODULE_ID}/assets/lock40.webp`;
	if (pct >= 20) return `modules/${MODULE_ID}/assets/lock20.webp`;
	return `modules/${MODULE_ID}/assets/lock0.webp`;
}

// Helper: apply the result of a lock-pick attempt to the challenge
function applyLockPickResult(challenge, degree) {
	if (degree === "criticalSuccess") {
		challenge.successCount += 2;
	} else if (degree === "success") {
		challenge.successCount += 1;
	} else if (degree === "failure") {
		// No progress, no pick broken here
	} else if (degree === "criticalFailure") {
		// No progress; pick breaking handled separately
	}
	if (challenge.successCount < 0) challenge.successCount = 0;
}

// Helper: get all thieves' tools and replacement picks for an actor
function getThievesToolsData(actor) {
	// Actual slugs from PF2e Remaster + Otari variant
	const TOOL_SLUGS = [
		"thieves-toolkit",            // Standard thieves' toolkit
		"thieves-tools",              // Legacy/compat
		"thieves-toolkit-infiltrator",
		"thieves-tools-infiltrator",   
		"thieves-tools-concealable"
	];

	const REPLACEMENT_SLUGS = [
		"thieves-toolkit-replacement-picks", // Remaster replacement picks
		"replacement-picks",                  // Legacy/compat
		"thieves-toolkit-infiltrator-picks",
		"thieves-tools-concealable-picks"
	];

	const allTools = actor.items.filter(i =>
		i.type === "equipment" &&
		TOOL_SLUGS.includes(i.slug ?? i.system?.slug ?? "")
	);

	const allReplacements = actor.items.filter(i =>
		i.type === "equipment" &&
		REPLACEMENT_SLUGS.includes(i.slug ?? i.system?.slug ?? "")
	);

	// Broken vs non-broken toolkits are now determined by name suffix, NOT flags
	const toolsBroken = allTools.filter(i => i.name?.includes(" (broken)"));
	const toolsNonBroken = allTools.filter(i => !i.name?.includes(" (broken)"));

	const totalNonBrokenTools = toolsNonBroken.reduce((n, i) => {
		const qty = i.system?.quantity ?? 1;
		return n + qty;
	}, 0);

	const totalReplacements = allReplacements.reduce((n, i) => {
		const qty = i.system?.quantity ?? 1;
		return n + qty;
	}, 0);

	const totalPicks = totalNonBrokenTools + totalReplacements;

	return {
		toolsNonBroken,
		toolsBroken,
		allTools,
		allReplacements,
		totalNonBrokenTools,
		totalReplacements,
		totalPicks
	};
}

//  Helper: handle critical failure: consume one replacement pick if available; else break one toolkit
async function handleCriticalFailure(actor, selectedToolkitId) {
	const toolsData = getThievesToolsData(actor);

	// First, try to consume a replacement pick if any exist
	const replacement = toolsData.allReplacements.find(i => (i.system?.quantity ?? 1) > 0);
	if (replacement) {
		const qty = replacement.system?.quantity ?? 1;
		const newQty = qty - 1;

		if (newQty > 0) {
			await replacement.update({ "system.quantity": newQty });
		} else {
			await replacement.delete();
		}

		debugLog("Consumed one replacement pick on crit failure", replacement);
		return;
	}

	// No replacement picks left; break a toolkit instead
	if (!selectedToolkitId) {
		debugLog("handleCriticalFailure: no selected toolkit id to break");
		return;
	}

	const toolkit = actor.items.get(selectedToolkitId);
	if (!toolkit) {
		debugLog("handleCriticalFailure: selected toolkit not found on actor", { selectedToolkitId });
		return;
	}

	const qty = toolkit.system?.quantity ?? 1;
	const brokenName = toolkit.name?.includes(" (broken)") ? toolkit.name : `${toolkit.name} (broken)`;

	if (qty > 1) {
		// Split the stack: reduce the main stack by 1, create a separate broken toolkit with quantity 1
		await toolkit.update({ "system.quantity": qty - 1 });

		const brokenData = duplicate(toolkit.toObject());
		brokenData.name = brokenName;
		brokenData.system = brokenData.system ?? {};
		brokenData.system.quantity = 1;

		await actor.createEmbeddedDocuments("Item", [brokenData]);
		debugLog("Created a separate broken toolkit from stacked tools", { originalId: toolkit.id, brokenName });
	} else {
		// Single toolkit: just rename it as broken
		await toolkit.update({ name: brokenName });
		debugLog("Marked toolkit as broken by renaming", { toolkitId: toolkit.id, brokenName });
	}
}

// Helper: best-effort restore a pick or toolkit (GM manual fix after reroll, etc.)
async function restorePickOrToolkit(actor) {
	const toolsData = getThievesToolsData(actor);

	// First, try to un-break a toolkit (reverse the "(broken)" rename)
	const brokenToolkit = toolsData.toolsBroken[0];
	if (brokenToolkit) {
		const originalName = brokenToolkit.name?.replace(" (broken)", "") ?? brokenToolkit.name;
		await brokenToolkit.update({ name: originalName });
		debugLog("Restored broken toolkit to usable state", { toolkitId: brokenToolkit.id, originalName });
		return;
	}

	// Next, if no broken toolkits, try to restore a replacement pick by increasing quantity
	const replacement = toolsData.allReplacements[0];
	if (replacement) {
		const qty = replacement.system?.quantity ?? 1;
		const newQty = qty + 1;
		await replacement.update({ "system.quantity": newQty });
		debugLog("Restored one replacement pick on actor", { itemId: replacement.id, newQty });
		return;
	}

	// Nothing to restore – log and bail
	debugLog("restorePickOrToolkit: no broken toolkits or replacement picks found to restore");
}

//  Helper: post chat message for a lock-pick attempt
function postLockPickChatMessage(actor, rollResult) {
	const dsText = {
		criticalSuccess: LT.criticalSuccess(),
		success: LT.success(),
		failure: LT.failure(),
		criticalFailure: LT.failure()
	}[rollResult.degree] ?? rollResult.degree;



	const escapedName = foundry.utils.escapeHTML(actor.name);
	let content = `
		<p><strong>${escapedName}</strong> ${LT.attemptLockPick()}.</p>
		<p>${LT.result()}: <strong>${dsText}</strong>.</p>
	`;

    // If critical falure, show pick destroyed message
    if (rollResult.degree === "criticalFailure") {
		content += `
		<p>${LT.lockPickDestroyed()}.</p>
		`;
	}
    
	ChatMessage.create({
		speaker: ChatMessage.getSpeaker({ actor }),
		content,
		whisper: []
	});
}

//  Helper: Roll a Thievery check using the PF2e skill's own roll method, with:
async function rollThieveryCheck(actor, dc) {
	// Try to grab the Thievery statistic from PF2e (various possible locations)
	const skill =
		actor.skills?.thievery ??
		actor.skills?.thi ??
		actor.system?.skills?.thievery ??
		actor.system?.skills?.thi ??
		null;

	let usedRoll = null;

	// Preferred path: use PF2e statistic's own check.roll({ dc, callback })
	if (skill?.check?.roll) {
		try {
			await skill.check.roll({
				dc: { value: dc },
				callback: roll => {
					// PF2e calls this with the evaluated CheckRoll
					usedRoll = roll;
				}
			});
		} catch (err) {
			debugLog("rollThieveryCheck: skill.check.roll failed, falling back", err);
		}
	}

	// If we got a roll from the callback, use it
	if (usedRoll) {
		const total = usedRoll.total ?? 0;

		// Try to detect the d20 result for nat 20 / nat 1 logic
		let d20 = null;
		const dice = usedRoll.dice ?? [];
		for (const term of dice) {
			// Look for a d20 term
			if (term.faces === 20 && Array.isArray(term.results) && term.results.length > 0) {
				const r = term.results[0];
				d20 = r.result ?? r.value ?? null;
				break;
			}
		}

		const diff = total - dc;

		// Base degree from diff only
		// 0 = crit fail, 1 = fail, 2 = success, 3 = crit success
		let degreeIndex;
		if (diff >= 10) degreeIndex = 3;
		else if (diff >= 0) degreeIndex = 2;
		else if (diff <= -10) degreeIndex = 0;
		else degreeIndex = 1;

		// Apply nat 20 / nat 1 upgrade/downgrade if we could find the d20
		if (typeof d20 === "number") {
			if (d20 === 20) {
				// Upgrade one step, max crit success
				degreeIndex = Math.min(3, degreeIndex + 1);
			} else if (d20 === 1) {
				// Downgrade one step, min crit failure
				degreeIndex = Math.max(0, degreeIndex - 1);
			}
		}

		let degree;
		if (degreeIndex === 3) degree = "criticalSuccess";
		else if (degreeIndex === 2) degree = "success";
		else if (degreeIndex === 1) degree = "failure";
		else degree = "criticalFailure";

		return {
			roll: usedRoll,
			total,
			degree
		};
	}

	// Fallback: simple 1d20 + Thievery modifier if PF2e path fails completely
	let mod = 0;
	const fallbackSkill =
		actor.system?.skills?.thi ??
		actor.system?.skills?.thievery ??
		null;

	if (fallbackSkill) {
		mod = Number(fallbackSkill.totalModifier ?? fallbackSkill.mod ?? fallbackSkill.value ?? 0) || 0;
	}

	const roll = await (new Roll("1d20 + @mod", { mod })).evaluate({ async: true });
	const total = roll.total ?? 0;
	const diff = total - dc;

	let degreeIndex;
	if (diff >= 10) degreeIndex = 3;
	else if (diff >= 0) degreeIndex = 2;
	else if (diff <= -10) degreeIndex = 0;
	else degreeIndex = 1;

	// Try to pull d20 result from fallback as well
	let d20 = null;
	const dice = roll.dice ?? [];
	for (const term of dice) {
		if (term.faces === 20 && Array.isArray(term.results) && term.results.length > 0) {
			const r = term.results[0];
			d20 = r.result ?? r.value ?? null;
			break;
		}
	}
	if (typeof d20 === "number") {
		if (d20 === 20) degreeIndex = Math.min(3, degreeIndex + 1);
		else if (d20 === 1) degreeIndex = Math.max(0, degreeIndex - 1);
	}

	let degree;
	if (degreeIndex === 3) degree = "criticalSuccess";
	else if (degreeIndex === 2) degree = "success";
	else if (degreeIndex === 1) degree = "failure";
	else degree = "criticalFailure";

	return {
		roll,
		total,
		degree
	};
}


//  GM Dialog: Start Lock-Pick Challenge
async function startLockPickChallenge(skipExistingCheck = false) {
	if (!skipExistingCheck) {
		const openChallenges = [];

		for (const challenge of LockPickChallengeManager.challenges.values()) {
			if (!challenge) continue;

			// Only consider challenges created by this GM
			if (challenge.gmId !== game.user.id) continue;

			// Only consider challenges that aren't fully unlocked yet
			if (challenge.successCount >= challenge.requiredAttempts) continue;

			let actorName = "";
			try {
				const actor = await fromUuid(challenge.actorUuid);
				actorName = actor?.name ?? `<${LT.missingActor()}>`;
			} catch (err) {
				actorName = `<${LT.missingActor()}>`;
			}

			const escapedName = foundry.utils.escapeHTML(actorName);
			const label = `${escapedName} – DC ${challenge.dc}, ${challenge.successCount}/${challenge.requiredAttempts}`;

			openChallenges.push({ challenge, label });
		}

		if (openChallenges.length > 0) {
			let listItems = "";
			for (const entry of openChallenges) {
				listItems += `<li><strong>${entry.label}</strong></li>`;
			}

			let selectHtml = "";
			if (openChallenges.length > 1) {
				const options = openChallenges.map(entry =>
					`<option value="${entry.challenge.id}">${entry.label}</option>`
				).join("");
				selectHtml = `
					<div class="form-group">
						<label>${LT.chooseExisting()}:</label>
						<select name="challengeId">
							${options}
						</select>
					</div>
				`;
			}

			const html = `
				<p>${LT.inProgress()}.</p>
				<ul>
					${listItems}
				</ul>
				${selectHtml}
				<p>${LT.existingOrNew()}?</p>
			`;

			const dlg = new DialogV2({
				window: {
					title: LT.titleStartChallenge()
				},
				position: {
					width: 600
				},
				content: html,
				buttons: [
					{
						label: LT.openExisting(),
						action: "open",
						icon: "fa-solid fa-eye",
						callback: async (event, button, dialog) => {
							let chosen = null;

							if (openChallenges.length === 1) {
								chosen = openChallenges[0].challenge;
							} else {
								const form = button.form;
								const challengeId = form.elements.challengeId?.value;
								chosen = openChallenges.find(entry => entry.challenge.id === challengeId)?.challenge ?? null;
							}

							if (!chosen) {
								debugLog("startLockPickChallenge – Open existing selected but no challenge resolved");
								return;
							}

							// Make sure this client has the latest copy stored
							LockPickChallengeManager.challenges.set(chosen.id, chosen);
							LockPickChallengeApp.openForUsers(chosen);
						}
					},
					{
						label: LT.startNew(),
						action: "startNew",
						icon: "fa-solid fa-lock-open",
						callback: async () => {
							// Re-run without checking for existing challenges
							await startLockPickChallenge(true);
						}
					},
					{
						label: LT.cancel(),
						action: "cancel"
					}
				],
				default: "open"
			});

			dlg.render(true);
			return;
		}
	}

	const actors = game.actors.contents.filter(a => a.hasPlayerOwner);
	let defaultActor = null;

	// Prefer controlled token's actor
	const controlled = canvas.tokens.controlled;
	if (controlled.length === 1) {
		defaultActor = controlled[0].actor;
	}

	const actorOptions = actors.map(a => {
		const selectedAttr = defaultActor && a.id === defaultActor.id ? " selected" : "";
		return `<option value="${a.uuid}"${selectedAttr}>${foundry.utils.escapeHTML(a.name)}</option>`;
	}).join("");

	const html = `
		<div class="form-group">
			<label>${LT.character()}</label>
			<select name="actorUuid">
				${actorOptions}
			</select>
		</div>
		<div class="form-group">
			<label>${LT.lockDC()}</label>
			<input type="number" name="dc" min="0" value="20" />
		</div>
		<div class="form-group">
			<label>${LT.reqSuccessesNum()}</label>
			<input type="number" name="requiredAttempts" min="2" max="6" value="2" />
		</div>
	`;

	const dlg = new DialogV2({
		window: {
			title: LT.titleStartChallenge()
		},
		position: {
			width: 600
		},
		content: html,
		buttons: [
			{
                label: LT.start(),
                action: "start",
                icon: "fa-solid fa-lock-open",
                callback: async (event, button, dialog) => {
                    const form = button.form;
                    if (!form) {
                        debugLog("DialogV2: no form found in Start button callback");
                        return;
                    }

                    const actorUuid = form.elements.actorUuid?.value;
                    const dc = Number(form.elements.dc?.value);
                    let requiredAttempts = Number(form.elements.requiredAttempts?.value);

                    if (!actorUuid) {
                        debugLog("No actor selected");
                        return;
                    }
                    if (!Number.isFinite(dc) || dc <= 0) {
                        debugLog("Invalid DC", dc);
                        return;
                    }
                    if (!Number.isFinite(requiredAttempts) || requiredAttempts < 2) {
                        requiredAttempts = 2;
                    }
                    if (requiredAttempts > 6) requiredAttempts = 6;

                    const actor = await fromUuid(actorUuid);
                    if (!actor) {
                        debugLog("Actor not found for UUID", actorUuid);
                        return;
                    }

                    const gmId = game.user.id;
                    let playerId = null;

                    // Try to pick the primary owner of this actor as the "player"
					const ownership = actor.ownership ?? {};
					const ownerEntries = Object.entries(ownership).filter(([userId, level]) => {
						if (userId === "default") return false;
						return level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
					});

					// Prefer a non-GM owner as the player; fall back to any owner
					const nonGmOwner = ownerEntries.find(([userId]) => {
						const user = game.users.get(userId);
						return user && !user.isGM;
					});

					const chosenOwner = nonGmOwner ?? ownerEntries[0] ?? null;
					if (chosenOwner) {
						playerId = chosenOwner[0];
					}

                    const challenge = LockPickChallengeManager.createChallenge({
                        actor,
                        dc,
                        requiredAttempts,
                        gmId,
                        playerId
                    });

                    LockPickChallengeApp.openForUsers(challenge);
                }
            },
			{
				label: LT.cancel(),
				action: "cancel"
			}
		],
		default: "start"
	});

	dlg.render(true);
}

//  Socket handling
function handleSocketMessage(msg) {
	if (!msg || typeof msg !== "object") return;

	if (msg.type === "openChallenge") {
		const challenge = msg.payload?.challenge;
		if (!challenge) return;

		const isGM = game.user.isGM;
		const isOwnerPlayer = game.user.id === challenge.playerId;

		// GMs can see it, but skip the GM who originally created it (they already opened locally)
		if (!isOwnerPlayer && !(isGM && game.user.id !== challenge.gmId)) {
			return;
		}

		// Store challenge locally on this client
		LockPickChallengeManager.challenges.set(challenge.id, challenge);

		const app = new LockPickChallengeApp(challenge, { isGMView: isGM });
		app.render(true);
		return;
	}

	if (msg.type === "updateChallenge") {
		const challenge = msg.payload?.challenge;
		if (!challenge) return;
		LockPickChallengeApp.updateFromChallengeData(challenge);
		return;
	}
}

/* HOOKS ==================================================================== */
Hooks.once("ready", () => {
	debugLog("Module ready");

	game.socket.on(`module.${MODULE_ID}`, handleSocketMessage);

	// Simple API so you can call from a macro:
	// game.modules.get("pf2e-lock-pick")?.api?.startLockPickChallenge();
	const mod = game.modules.get(MODULE_ID);
	if (mod) {
		mod.api = mod.api || {};
		mod.api.startLockPickChallenge = startLockPickChallenge;
	}
});