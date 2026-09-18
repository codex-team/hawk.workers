import type { ReleaseDBScheme } from '@hawk.so/types';

/**
 * Group chronologically ordered releases by project.
 *
 * @param releases - releases ordered from oldest to newest
 */
export function groupReleasesByProject(releases: ReleaseDBScheme[]): Map<string, ReleaseDBScheme[]> {
  const releasesByProject = new Map<string, ReleaseDBScheme[]>();

  for (const release of releases) {
    const projectReleases = releasesByProject.get(release.projectId) || [];

    projectReleases.push(release);
    releasesByProject.set(release.projectId, projectReleases);
  }

  return releasesByProject;
}
