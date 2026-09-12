  // --- Live local time for Georgia (Tbilisi) ---
  const localTimeElem = document.getElementById('local-time');
  if (localTimeElem) {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tbilisi'
    });
    function updateLocalTime() {
      const now = new Date();
      localTimeElem.textContent = timeFormatter.format(now);
    }
    updateLocalTime();
    setInterval(updateLocalTime, 60000); // Update every minute
  }