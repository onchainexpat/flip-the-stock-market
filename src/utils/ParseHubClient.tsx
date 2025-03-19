interface ParseHubConfig {
  apiKey: string;
  projectToken: string;
}

export interface ParseHubRun {
  project_token: string;
  run_token: string;
  status: 'initialized' | 'queued' | 'running' | 'cancelled' | 'complete' | 'error';
  data_ready: boolean;
  start_time: string;
  end_time: string | null;
  pages: number;
  md5sum: string | null;
  start_url: string;
  start_template: string;
  start_value: string;
}

export interface ParseHubProject {
  token: string;
  title: string;
  templates_json: string;
  main_template: string;
  main_site: string;
  options_json: string;
  last_run: string;
  last_ready_run: string;
}

interface ParseHubResponse {
  data: any;
  status: string;
}

export class ParseHubClient {
  private apiKey: string;
  private baseUrl = 'https://parsehub.com/api/v2';

  constructor(config: ParseHubConfig) {
    this.apiKey = config.apiKey;
  }

  async getLastReadyData(projectToken: string, format: 'json' | 'csv' = 'json'): Promise<ParseHubResponse> {
    const url = new URL(`${this.baseUrl}/projects/${projectToken}/last_ready_run/data`);
    url.searchParams.append('api_key', this.apiKey);
    url.searchParams.append('format', format);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept-Encoding': 'gzip',
      },
    });

    if (!response.ok) {
      throw new Error(`ParseHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async getProjectRuns(projectToken: string): Promise<ParseHubRun[]> {
    const url = new URL(`${this.baseUrl}/projects/${projectToken}`);
    url.searchParams.append('api_key', this.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`ParseHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async cancelRun(runToken: string): Promise<ParseHubRun> {
    const url = new URL(`${this.baseUrl}/runs/${runToken}/cancel`);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
      body: new URLSearchParams({
        api_key: this.apiKey,
      }),
    });

    if (!response.ok) {
      throw new Error(`ParseHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteRun(runToken: string): Promise<{ run_token: string }> {
    const url = new URL(`${this.baseUrl}/runs/${runToken}`);
    url.searchParams.append('api_key', this.apiKey);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`ParseHub API error: ${response.statusText}`);
    }

    return await response.json();
  }

  async listProjects(): Promise<ParseHubProject[]> {
    const url = new URL(`${this.baseUrl}/projects`);
    url.searchParams.append('api_key', this.apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`ParseHub API error: ${response.statusText}`);
    }

    return await response.json();
  }
} 