export function messageThreadId(advertId: string, otherUserId: string) {
  return `${advertId}--${otherUserId}`;
}

export function parseMessageThreadId(threadId: string) {
  const [advertId, otherUserId] = threadId.split("--");

  if (!advertId || !otherUserId) {
    return null;
  }

  return { advertId, otherUserId };
}
