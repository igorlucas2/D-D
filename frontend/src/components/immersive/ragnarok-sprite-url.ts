export function ragnarokSpriteUrl(
  jobId: number,
  gender: string,
  hairStyle: number,
) {
  const style = Math.max(1, Math.min(20, hairStyle || 1));
  const sex = gender === "F" ? "female" : "male";
  return `/ragassets/characters/job-${jobId}-${sex}-${style}.png`;
}
