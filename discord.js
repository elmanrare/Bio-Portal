const DISCORD_ID = "673555425198866443"; // Replace with your Discord user ID

const STATUS_CONFIG = {
	online: { color: "bg-emerald-500", text: "Online" },
	idle: { color: "bg-amber-500", text: "Idle" },
	dnd: { color: "bg-rose-500", text: "Do Not Disturb" },
	offline: { color: "bg-gray-400", text: "Offline" }
};

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
		}
	} catch (error) {
		console.error("Lanyard status could not be loaded:", error);
	}
}
