import type { ProjectTaskManagerConfig as ProjectTaskManagerConfigType } from '@hawk.so/types';

interface LegacyDelegatedUser {
  accessToken: string;
  accessTokenExpiresAt: Date | null;
  refreshToken: string;
  refreshTokenExpiresAt: Date | null;
  status: 'active' | 'revoked' | 'missing';
}

/**
 * Project task manager config with the legacy delegated user data still used
 * by the API and task-manager worker.
 */
export type ProjectTaskManagerConfig = ProjectTaskManagerConfigType & {
  config: ProjectTaskManagerConfigType['config'] & {
    delegatedUser?: LegacyDelegatedUser;
  };
};
