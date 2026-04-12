/** YouTube Data API v3 JSON 조각 (내부용) */
export type SearchList = {
  error?: { code: number; message: string };
  items?: Array<{
    id: { videoId?: string; kind?: string };
    snippet: { title: string; channelTitle: string; description: string; publishedAt: string };
  }>;
};

export type VideoList = {
  error?: { code: number; message: string };
  items?: Array<{
    id: string;
    contentDetails: { duration: string };
    statistics?: { viewCount: string };
    snippet: { title: string; channelTitle: string; description: string; publishedAt: string };
  }>;
};

export type ChannelsList = {
  error?: { code: number; message: string };
  items?: Array<{ id: string }>;
};
