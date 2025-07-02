interface DuneQueryResult {
  result?: {
    rows: any[];
  };
}

export class DuneClient {
  private apiKey: string;
  private baseUrl = 'https://api.dune.com/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getLatestResult({
    queryId,
  }: { queryId: number }): Promise<DuneQueryResult> {
    try {
      const response = await fetch(`${this.baseUrl}/query/${queryId}/results`, {
        headers: {
          'x-dune-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(
          `Dune API error: ${response.status} ${response.statusText}. Body: ${errorBody}`,
        );
        throw new Error(`Dune API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching Dune data:', error);
      throw error;
    }
  }
}
