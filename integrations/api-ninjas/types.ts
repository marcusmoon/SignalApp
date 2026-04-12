export type NinjasTranscriptResult = {
  transcript: string | null;
  /** 0 = 요청 안 함(키 없음 등) */
  httpStatus: number;
};
