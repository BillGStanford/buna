export type CompletionInput = {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  country: string | null;
  professional_role: string | null;
  founder_status?: string | null;
  startup_intent?: string | null;
  interests: string[] | null;
};

export type CompletionItem = { key: string; label: string; done: boolean };

/** A placeholder username is generated at signup; choosing your own counts as progress. */
export function hasChosenUsername(username: string | null | undefined): boolean {
  return Boolean(username) && !String(username).startsWith("user-");
}

export function profileCompletion(p: CompletionInput): { percent: number; items: CompletionItem[] } {
  const items: CompletionItem[] = [
    { key: "display_name", label: "Add your name", done: Boolean(p.display_name?.trim()) },
    { key: "username", label: "Choose a username", done: hasChosenUsername(p.username) },
    { key: "avatar_url", label: "Upload a photo", done: Boolean(p.avatar_url) },
    { key: "country", label: "Add your country", done: Boolean(p.country) },
    { key: "founder_status", label: "Tell us your role in the startup ecosystem", done: Boolean(p.founder_status) },
    { key: "startup_intent", label: "Set your Buna goal", done: Boolean(p.startup_intent) },
    { key: "professional_role", label: "Say what you do", done: Boolean(p.professional_role?.trim()) },
    { key: "interests", label: "Pick your interests", done: (p.interests?.length ?? 0) > 0 },
    { key: "bio", label: "Write a short bio", done: Boolean(p.bio?.trim()) },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
