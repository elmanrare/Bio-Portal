const DISCORD_ID = "673555425198866443"; // Replace with your Discord user ID

const STATUS_CONFIG = {
	online: { color: "bg-emerald-500", text: "Online" },
	idle: { color: "bg-amber-500", text: "Idle" },
	dnd: { color: "bg-rose-500", text: "Do Not Disturb" },
	offline: { color: "bg-gray-400", text: "Offline" }
};

// Discord's activity "type" enum: 0 Playing, 1 Streaming, 2 Listening, 3 Watching, 5 Competing.
const ACTIVITY_VERB = { 0: "Playing", 1: "Streaming", 2: "Listening to", 3: "Watching", 5: "Competing in" };

function assetUrl(activity, image) {
	if (!image) return "";
	if (image.startsWith("mp:external/")) return `https://media.discordapp.net/${image.replace("mp:external/", "external/")}`;
	return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}.png`;
}

function renderActivity(data) {
	const wrap = document.getElementById("discord-activity");
	const art = document.getElementById("activity-art");
	const nameEl = document.getElementById("activity-name");
	const detailEl = document.getElementById("activity-detail");
	const stateEl = document.getElementById("activity-state");
	if (!wrap || !nameEl) return;

	// Prefer Spotify, then the first non-custom activity.
	const spotify = data.listening_to_spotify ? data.spotify : null;
	const activity = (data.activities || []).find(a => a.type !== 4);

	const hideArt = () => { if (art) { art.hidden = true; art.removeAttribute("src"); } };

	if (spotify) {
		nameEl.textContent = "Listening to Spotify";
		detailEl.textContent = spotify.song || "";
		stateEl.textContent = spotify.artist ? `by ${spotify.artist}` : "";
		if (art && spotify.album_art_url) {
			art.src = spotify.album_art_url;
			art.alt = `${spotify.album || "Album"} cover`;
			art.hidden = false;
		} else {
			hideArt();
		}
		wrap.hidden = false;
		return;
	}

	if (activity) {
		const verb = ACTIVITY_VERB[activity.type] || "Playing";
		nameEl.textContent = `${verb} ${activity.name}`;
		detailEl.textContent = activity.details || "";
		stateEl.textContent = activity.state || "";
		const image = assetUrl(activity, activity.assets?.large_image || activity.assets?.small_image);
		if (art && image) {
			art.src = image;
			art.alt = `${activity.name} artwork`;
			art.hidden = false;
		} else {
			hideArt();
		}
		wrap.hidden = false;
		return;
	}

	wrap.hidden = true;
	hideArt();
}

export async function fetchDiscordStatus() {
	const statusDot = document.getElementById("status-dot");
	const statusText = document.getElementById("status-text");

	try {
		const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_ID}`);
		const result = await response.json();

		if (result.success) {
			const statusInfo = STATUS_CONFIG[result.data.discord_status] || STATUS_CONFIG.offline;

			if (statusDot) {
				statusDot.className = `w-2.5 h-2.5 rounded-full transition-colors duration-300 ${statusInfo.color}`;
			}
			if (statusText) {
				statusText.textContent = statusInfo.text;
			}

			renderActivity(result.data);
		}
	} catch (error) {
		console.error("Lanyard status could not be loaded:", error);
	}
}

// Keep the presence fresh so activity/Spotify updates without a reload.
export function startDiscordPolling(intervalMs = 30000) {
	setInterval(fetchDiscordStatus, intervalMs);
}
