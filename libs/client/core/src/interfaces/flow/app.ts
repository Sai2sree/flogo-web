import { AppProperty } from '../app';

export interface App {
  id: string;
  name: string;
  version?: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  properties?: AppProperty[];
}
