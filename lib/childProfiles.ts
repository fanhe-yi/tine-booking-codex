export type ChildProfileInput = {
  age: string;
  gender: string;
  nickname: string;
  address: string;
  preferences: string;
  personality: string;
};

export type ChildProfile = ChildProfileInput & {
  id: string;
};

export function normalizeChildProfile(input: Partial<ChildProfileInput> | null) {
  return {
    age: input?.age?.trim() || "",
    gender: input?.gender?.trim() || "",
    nickname: input?.nickname?.trim() || "",
    address: input?.address?.trim() || "",
    preferences: input?.preferences?.trim() || "",
    personality: input?.personality?.trim() || "",
  };
}

export function isCompleteChildProfile(profile: ChildProfileInput) {
  return Boolean(
    profile.age &&
      profile.gender &&
      profile.nickname &&
      profile.personality,
  );
}

export function formatChildProfileSummary(profile: ChildProfileInput) {
  return [
    `年齡：${profile.age}`,
    `性別：${profile.gender}`,
    `稱呼：${profile.nickname}`,
    profile.address ? `地址：${profile.address}` : "",
    profile.preferences ? `喜好：${profile.preferences}` : "",
    `個性：${profile.personality}`,
  ].filter(Boolean).join("\n");
}
