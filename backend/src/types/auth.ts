export type AuthenticatedUser = {
  id: string;
  googleId: string | null;
  name: string;
  email: string;
  avatar: string | null;
};

export type SessionPayload = {
  userId: string;
};
