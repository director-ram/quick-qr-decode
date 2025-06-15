
/**
 * Fetch the user's public IP using a free API.
 * Returns a string IP address (e.g., "123.123.123.123")
 */
export async function getUserIp(): Promise<string | null> {
  try {
    // You may replace this with any free IP API if rate-limited.
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch (error) {
    console.error("Failed to fetch user IP:", error);
    return null;
  }
}
