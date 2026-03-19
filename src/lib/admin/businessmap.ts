const API_BASE = 'https://smagile.kanbanize.com/api/v2';

/**
 * Create a card on Board 5 (Leads/Work Opportunities).
 * Returns the new card_id, or null if creation fails.
 */
export async function createBoard5Card(
  title: string,
  description: string,
): Promise<number | null> {
  const apiKey = process.env.BUSINESSMAP_API_KEY;

  if (!apiKey) {
    console.error('[Businessmap] Missing BUSINESSMAP_API_KEY env var');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/cards`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        board_id: 5,
        workflow_id: 9,
        column_id: 74,
        lane_id: 10,
        title,
        description,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Businessmap] Card creation failed (${response.status}):`, text);
      return null;
    }

    const result = await response.json();
    const cardId = result?.data?.[0]?.card_id ?? result?.data?.card_id ?? null;

    if (!cardId) {
      console.error('[Businessmap] No card_id in response:', JSON.stringify(result));
      return null;
    }

    return cardId;
  } catch (err) {
    console.error('[Businessmap] Card creation error:', err);
    return null;
  }
}
