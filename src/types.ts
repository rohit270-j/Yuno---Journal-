export interface Interaction {
  id: string;
  prompt: string;
  response: string;
  createdAt: any;
}

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}
